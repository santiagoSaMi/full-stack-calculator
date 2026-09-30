/** An arithmetic operation. Values match the backend API's `operation` field. */
export type Operation = 'add' | 'subtract' | 'multiply' | 'divide'

/** State of the calculator's input. Operands are kept as the strings typed. */
export interface CalculatorState {
  /** Operand entered before an operation was selected, or null if none yet. */
  firstOperand: string | null
  /** Selected operation, or null if none yet. */
  operation: Operation | null
  /** Operand currently being typed. Empty right after selecting an operation. */
  currentInput: string
}

export type CalculatorAction =
  | { type: 'inputDigit'; digit: Digit }
  | { type: 'inputDecimal' }
  | { type: 'toggleSign' }
  | { type: 'selectOperation'; operation: Operation }
  | { type: 'clear' }

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
