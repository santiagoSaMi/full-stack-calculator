/** An arithmetic operation. Values match the backend API's `operation` field. */
export type Operation = 'add' | 'subtract' | 'multiply' | 'divide'

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

/** A calculation to perform. Mirrors the body of POST /api/v1/calculate. */
export interface CalculationRequest {
  operation: Operation
  a: number
  b: number
}

/**
 * Performs a calculation and resolves with its result, or rejects with an
 * Error whose message can be shown to the user. This is the only boundary
 * through which the calculator obtains results.
 */
export type CalculationService = (request: CalculationRequest) => Promise<number>

/** Progress of the most recently submitted calculation. */
export type CalculationState =
  | { status: 'idle' }
  | { status: 'pending'; requestId: number; request: CalculationRequest }
  | { status: 'success'; request: CalculationRequest; result: number }
  | { status: 'error'; request: CalculationRequest; message: string }

/** State of the calculator. Operands are kept as the strings typed. */
export interface CalculatorState {
  /** Operand entered before an operation was selected, or null if none yet. */
  firstOperand: string | null
  /** Selected operation, or null if none yet. */
  operation: Operation | null
  /**
   * Operand currently being typed. Empty right after selecting an operation.
   * After a successful calculation it holds the result.
   */
  currentInput: string
  calculation: CalculationState
}

/** Actions triggered directly by the keypad. */
export type InputAction =
  | { type: 'inputDigit'; digit: Digit }
  | { type: 'inputDecimal' }
  | { type: 'toggleSign' }
  | { type: 'selectOperation'; operation: Operation }

export type CalculatorAction =
  | InputAction
  | { type: 'clear' }
  | { type: 'submit'; requestId: number; request: CalculationRequest }
  | { type: 'resolve'; requestId: number; result: number }
  | { type: 'reject'; requestId: number; message: string }
