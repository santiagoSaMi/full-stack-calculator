import { OPERATIONS } from './operations.ts'
import type { CalculatorAction, CalculatorState, Digit, Operation } from './types.ts'

/** Maximum number of digits accepted in a single operand. */
export const MAX_DIGITS = 15

export const initialState: CalculatorState = {
  firstOperand: null,
  operation: null,
  currentInput: '0',
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'inputDigit':
      return { ...state, currentInput: appendDigit(state.currentInput, action.digit) }
    case 'inputDecimal':
      return { ...state, currentInput: appendDecimal(state.currentInput) }
    case 'toggleSign':
      return { ...state, currentInput: toggleSign(state.currentInput) }
    case 'selectOperation':
      return selectOperation(state, action.operation)
    case 'clear':
      return initialState
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

function selectOperation(state: CalculatorState, operation: Operation): CalculatorState {
  // First operator: the current input becomes the first operand.
  if (state.operation === null) {
    return {
      firstOperand: normalizeOperand(state.currentInput),
      operation,
      currentInput: '',
    }
  }
  // An operation is already selected: switch to the new one and keep any
  // second operand typed so far. Chaining calculations requires evaluating
  // the pending one, which arrives with the backend integration.
  return { ...state, operation }
}

/** Text for the display's secondary line, e.g. "12 +". */
export function selectExpression(state: CalculatorState): string {
  if (state.firstOperand === null || state.operation === null) return ''
  return `${state.firstOperand} ${OPERATIONS[state.operation].symbol}`
}

/** Text for the display's main line: the operand being typed, if any. */
export function selectDisplayValue(state: CalculatorState): string {
  return state.currentInput || state.firstOperand || '0'
}
