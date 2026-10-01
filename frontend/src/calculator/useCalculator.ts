import { useCallback, useReducer, useRef } from 'react'
import {
  calculatorReducer,
  initialState,
  selectCanSubmit,
  selectDisplayValue,
  selectError,
  selectExpression,
  selectIsPending,
  selectRequest,
} from './calculatorReducer.ts'
import type { CalculationService, Digit, Operation } from './types.ts'

const FALLBACK_ERROR = 'Calculation failed'

export interface UseCalculatorResult {
  expression: string
  displayValue: string
  activeOperation: Operation | null
  /** Message of the last failed calculation, or null. */
  error: string | null
  /** True while a submitted calculation is awaiting its result. */
  isPending: boolean
  /** True when both operands and an operation are entered. */
  canSubmit: boolean
  inputDigit: (digit: Digit) => void
  inputDecimal: () => void
  toggleSign: () => void
  selectOperation: (operation: Operation) => void
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
    (operation: Operation) => dispatch({ type: 'selectOperation', operation }),
    [],
  )
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  const request = selectRequest(state)
  const canSubmit = selectCanSubmit(state)

  const submit = () => {
    if (!canSubmit || request === null) return

    // The id lets the reducer discard a response that arrives after the
    // calculator was cleared or another calculation was submitted.
    const requestId = ++lastRequestId.current
    dispatch({ type: 'submit', requestId, request })

    calculate(request).then(
      (result) => dispatch({ type: 'resolve', requestId, result }),
      (error: unknown) => {
        const message = error instanceof Error && error.message ? error.message : FALLBACK_ERROR
        dispatch({ type: 'reject', requestId, message })
      },
    )
  }

  return {
    expression: selectExpression(state),
    displayValue: selectDisplayValue(state),
    activeOperation: state.operation,
    error: selectError(state),
    isPending: selectIsPending(state),
    canSubmit,
    inputDigit,
    inputDecimal,
    toggleSign,
    selectOperation,
    submit,
    clear,
  }
}
