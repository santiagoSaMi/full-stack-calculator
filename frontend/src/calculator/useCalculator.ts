import { useCallback, useReducer } from 'react'
import { calculatorReducer, initialState, selectDisplayValue, selectExpression } from './calculatorReducer.ts'
import type { Digit, Operation } from './types.ts'

export interface UseCalculatorResult {
  expression: string
  displayValue: string
  activeOperation: Operation | null
  inputDigit: (digit: Digit) => void
  inputDecimal: () => void
  toggleSign: () => void
  selectOperation: (operation: Operation) => void
  clear: () => void
}

/** Calculator state and the actions available to the UI. */
export function useCalculator(): UseCalculatorResult {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)

  const inputDigit = useCallback((digit: Digit) => dispatch({ type: 'inputDigit', digit }), [])
  const inputDecimal = useCallback(() => dispatch({ type: 'inputDecimal' }), [])
  const toggleSign = useCallback(() => dispatch({ type: 'toggleSign' }), [])
  const selectOperation = useCallback(
    (operation: Operation) => dispatch({ type: 'selectOperation', operation }),
    [],
  )
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  return {
    expression: selectExpression(state),
    displayValue: selectDisplayValue(state),
    activeOperation: state.operation,
    inputDigit,
    inputDecimal,
    toggleSign,
    selectOperation,
    clear,
  }
}
