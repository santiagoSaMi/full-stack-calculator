import { useCallback, useReducer, useRef } from 'react'
import {
  calculatorReducer,
  initialState,
  selectDisplayValue,
  selectError,
  selectExpression,
  selectIsPending,
  validateSubmission,
  validateUnarySubmission,
} from './calculatorReducer.ts'
import { CalculationError, GENERIC_ERROR_MESSAGE } from './errors.ts'
import type { BinaryOperation, CalculationService, Digit, UnaryOperation, Validation } from './types.ts'

export interface UseCalculatorResult {
  expression: string
  displayValue: string
  activeOperation: BinaryOperation | null
  /** User-facing message for the last failed or invalid calculation, or null. */
  error: string | null
  /** True while a submitted calculation is awaiting its result. */
  isPending: boolean
  inputDigit: (digit: Digit) => void
  inputDecimal: () => void
  toggleSign: () => void
  selectOperation: (operation: BinaryOperation) => void
  /** Applies a single-operand operation to the number shown. */
  applyUnaryOperation: (operation: UnaryOperation) => void
  submit: () => void
  clear: () => void
}

/**
 * Calculator state and the actions available to the UI. Results are obtained
 * exclusively through the given service.
 */
export function useCalculator(calculate: CalculationService): UseCalculatorResult {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)
  const lastRequestId = useRef(0)

  const inputDigit = useCallback((digit: Digit) => dispatch({ type: 'inputDigit', digit }), [])
  const inputDecimal = useCallback(() => dispatch({ type: 'inputDecimal' }), [])
  const toggleSign = useCallback(() => dispatch({ type: 'toggleSign' }), [])
  const selectOperation = useCallback(
    (operation: BinaryOperation) => dispatch({ type: 'selectOperation', operation }),
    [],
  )
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  const isPending = selectIsPending(state)

  /** Sends a validated calculation to the service, or reports why it cannot be sent. */
  const send = (validation: Validation) => {
    if (!validation.ok) {
      dispatch({ type: 'invalidate', message: validation.message })
      return
    }

    // The id lets the reducer discard a response that arrives after the
    // calculator was cleared or another calculation was submitted.
    const requestId = ++lastRequestId.current
    dispatch({ type: 'submit', requestId, request: validation.request })

    calculate(validation.request).then(
      (result) => dispatch({ type: 'resolve', requestId, result }),
      (error: unknown) => dispatch({ type: 'reject', requestId, message: toUserMessage(error) }),
    )
  }

  const submit = () => {
    if (!isPending) send(validateSubmission(state))
  }

  const applyUnaryOperation = (operation: UnaryOperation) => {
    if (!isPending) send(validateUnarySubmission(state, operation))
  }

  return {
    expression: selectExpression(state),
    displayValue: selectDisplayValue(state),
    activeOperation: state.operation,
    error: selectError(state),
    isPending,
    inputDigit,
    inputDecimal,
    toggleSign,
    selectOperation,
    applyUnaryOperation,
    submit,
    clear,
  }
}

/**
 * Only a CalculationError carries a message written for the user; anything
 * else (a bug, an unexpected rejection) is reported generically.
 */
function toUserMessage(error: unknown): string {
  return error instanceof CalculationError && error.message ? error.message : GENERIC_ERROR_MESSAGE
}
