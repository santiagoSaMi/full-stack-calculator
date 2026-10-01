import { isUnaryRequest, OPERATIONS, UNARY_OPERATIONS } from './operations.ts'
import type {
  BinaryOperation,
  CalculationRequest,
  CalculatorAction,
  CalculatorState,
  Digit,
  InputAction,
  UnaryOperation,
  Validation,
} from './types.ts'

/** Maximum number of digits accepted in a single operand. */
export const MAX_DIGITS = 15

export const initialState: CalculatorState = {
  firstOperand: null,
  operation: null,
  currentInput: '0',
  inputIsResult: false,
  calculation: { status: 'idle' },
}

/** Messages for input that cannot be submitted yet. */
export const VALIDATION_MESSAGES = {
  missingOperation: 'Choose an operation first.',
  missingSecondOperand: 'Enter a second number.',
  invalidNumber: 'Enter a valid number.',
} as const

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'clear':
      return initialState

    case 'submit':
      if (state.calculation.status === 'pending') return state
      return {
        ...state,
        calculation: { status: 'pending', requestId: action.requestId, request: action.request },
      }

    case 'resolve': {
      const pending = currentRequest(state, action.requestId)
      if (pending === null) return state
      // The result becomes the input, so it can start the next calculation.
      // A single-operand result only replaces the number it was applied to: a
      // two-operand calculation in progress (e.g. "9 + √16") is kept.
      const inProgress = isUnaryRequest(pending)
        ? { firstOperand: state.firstOperand, operation: state.operation }
        : { firstOperand: null, operation: null }
      return {
        ...inProgress,
        currentInput: formatNumber(action.result),
        inputIsResult: true,
        calculation: { status: 'success', request: pending, result: action.result },
      }
    }

    case 'reject': {
      const pending = currentRequest(state, action.requestId)
      if (pending === null) return state
      // Operands are kept so the user can correct them and resubmit.
      return { ...state, calculation: { status: 'error', message: action.message } }
    }

    case 'invalidate':
      if (state.calculation.status === 'pending') return state
      return { ...state, calculation: { status: 'error', message: action.message } }

    default:
      return reduceInput(state, action)
  }
}

/**
 * Returns the pending request if requestId identifies it, or null if the
 * response is stale (e.g. the calculator was cleared while it was in flight).
 */
function currentRequest(state: CalculatorState, requestId: number): CalculationRequest | null {
  const { calculation } = state
  if (calculation.status !== 'pending' || calculation.requestId !== requestId) return null
  return calculation.request
}

function reduceInput(state: CalculatorState, action: InputAction): CalculatorState {
  // Input is locked while a calculation is in flight.
  if (state.calculation.status === 'pending') return state

  // Any input dismisses the previous result or error.
  const next: CalculatorState = { ...state, inputIsResult: false, calculation: { status: 'idle' } }
  // While a result is showing, typing starts a new number instead of editing it.
  const input = state.inputIsResult ? '' : state.currentInput

  switch (action.type) {
    case 'inputDigit':
      return { ...next, currentInput: appendDigit(input, action.digit) }
    case 'inputDecimal':
      return { ...next, currentInput: appendDecimal(input) }
    case 'toggleSign':
      return { ...next, currentInput: toggleSign(state.currentInput) }
    case 'selectOperation':
      return selectOperation(next, action.operation)
  }
}

function countDigits(input: string): number {
  return input.replace(/[^0-9]/g, '').length
}

function appendDigit(input: string, digit: Digit): string {
  if (input === '') return digit
  if (input === '0') return digit
  if (input === '-0') return `-${digit}`
  if (countDigits(input) >= MAX_DIGITS) return input
  return input + digit
}

function appendDecimal(input: string): string {
  if (input.includes('.')) return input
  if (input === '') return '0.'
  if (countDigits(input) >= MAX_DIGITS) return input
  return `${input}.`
}

function toggleSign(input: string): string {
  if (input === '') return '-0'
  return input.startsWith('-') ? input.slice(1) : `-${input}`
}

/** Removes a dangling decimal point, e.g. "12." becomes "12". */
function normalizeOperand(input: string): string {
  return input.endsWith('.') ? input.slice(0, -1) : input
}

function selectOperation(state: CalculatorState, operation: BinaryOperation): CalculatorState {
  // First operator: the current input becomes the first operand.
  if (state.operation === null) {
    return {
      ...state,
      firstOperand: normalizeOperand(state.currentInput),
      operation,
      currentInput: '',
    }
  }
  // An operation is already selected: switch to the new one and keep any
  // second operand typed so far.
  return { ...state, operation }
}

/** Formats a number for display, hiding floating-point noise beyond MAX_DIGITS. */
export function formatNumber(value: number): string {
  return String(Number(value.toPrecision(MAX_DIGITS)))
}

/**
 * Checks whether the current input describes a complete calculation. This is
 * the single place that decides if the calculator can submit, and it checks
 * only what the frontend alone can know: that the entry is complete and the
 * operands are numbers. Arithmetic rules such as division by zero are left to
 * the backend.
 */
export function validateSubmission(state: CalculatorState): Validation {
  if (state.firstOperand === null || state.operation === null) {
    return { ok: false, message: VALIDATION_MESSAGES.missingOperation }
  }
  if (state.currentInput === '') {
    return { ok: false, message: VALIDATION_MESSAGES.missingSecondOperand }
  }

  const a = Number(state.firstOperand)
  const b = Number(normalizeOperand(state.currentInput))
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { ok: false, message: VALIDATION_MESSAGES.invalidNumber }
  }
  return { ok: true, request: { operation: state.operation, a, b } }
}

/**
 * Checks whether a single-operand operation can be applied. It acts on the
 * number currently shown, like the key on a physical calculator. As with
 * validateSubmission, only what the frontend alone can know is checked:
 * whether the operand is acceptable (e.g. not negative) is the backend's call.
 */
export function validateUnarySubmission(state: CalculatorState, operation: UnaryOperation): Validation {
  const a = Number(normalizeOperand(selectDisplayValue(state)))
  if (!Number.isFinite(a)) {
    return { ok: false, message: VALIDATION_MESSAGES.invalidNumber }
  }
  return { ok: true, request: { operation, a } }
}

/** Text for the display's secondary line, e.g. "12 +", "12 + 3 =" or "√(9) =". */
export function selectExpression(state: CalculatorState): string {
  const { calculation } = state
  const inProgress =
    state.firstOperand === null || state.operation === null
      ? ''
      : `${formatLeftOperand(state.firstOperand, state.operation)} ${OPERATIONS[state.operation].symbol}`

  if (calculation.status === 'pending' || calculation.status === 'success') {
    const { request } = calculation
    if (isUnaryRequest(request)) {
      const applied = `${UNARY_OPERATIONS[request.operation].symbol}(${formatNumber(request.a)})`
      // Inside a two-operand calculation it stands for the second operand.
      return inProgress === '' ? `${applied} =` : `${inProgress} ${applied}`
    }
    const { a, b, operation } = request
    return `${formatLeftOperand(formatNumber(a), operation)} ${OPERATIONS[operation].symbol} ${formatNumber(b)} =`
  }
  return inProgress
}

/**
 * Wraps a negative base of a power in parentheses. Written without them,
 * "-2 ^ 2" conventionally means -(2 ^ 2) = -4, but the calculator raises the
 * whole operand: (-2) ^ 2 = 4.
 */
function formatLeftOperand(operand: string, operation: BinaryOperation): string {
  return operation === 'power' && operand.startsWith('-') ? `(${operand})` : operand
}

/** Text for the display's main line: the operand being typed, or the result. */
export function selectDisplayValue(state: CalculatorState): string {
  return state.currentInput || state.firstOperand || '0'
}

/** Message of the last failed calculation, or null. */
export function selectError(state: CalculatorState): string | null {
  return state.calculation.status === 'error' ? state.calculation.message : null
}

export function selectIsPending(state: CalculatorState): boolean {
  return state.calculation.status === 'pending'
}
