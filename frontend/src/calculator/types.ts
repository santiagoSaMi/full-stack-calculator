/** An operation on two operands. Values match the backend API's `operation` field. */
export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power'

/** An operation on a single operand. Values match the backend API's `operation` field. */
export type UnaryOperation = 'sqrt' | 'percent'

export type Operation = BinaryOperation | UnaryOperation

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export interface BinaryCalculationRequest {
  operation: BinaryOperation
  a: number
  b: number
}

/** A single-operand calculation. It has no `b`: the API rejects one. */
export interface UnaryCalculationRequest {
  operation: UnaryOperation
  a: number
}

/** A calculation to perform. Mirrors the body of POST /api/v1/calculate. */
export type CalculationRequest = BinaryCalculationRequest | UnaryCalculationRequest

/**
 * Performs a calculation and resolves with its result. To report a failure
 * the user should read about, it rejects with a CalculationError; any other
 * rejection is shown as a generic failure. This is the only boundary through
 * which the calculator obtains results.
 */
export type CalculationService = (request: CalculationRequest) => Promise<number>

/** Progress of the most recently submitted calculation. */
export type CalculationState =
  | { status: 'idle' }
  | { status: 'pending'; requestId: number; request: CalculationRequest }
  | { status: 'success'; request: CalculationRequest; result: number }
  | { status: 'error'; message: string }

/** State of the calculator. Operands are kept as the strings typed. */
export interface CalculatorState {
  /** Operand entered before an operation was selected, or null if none yet. */
  firstOperand: string | null
  /** Selected two-operand operation, or null if none yet. */
  operation: BinaryOperation | null
  /**
   * Operand currently being typed. Empty right after selecting an operation.
   * After a successful calculation it holds the result at full precision.
   */
  currentInput: string
  /** True while the input holds a result, so typing replaces it instead of editing it. */
  inputIsResult: boolean
  calculation: CalculationState
}

/** Actions triggered directly by the keypad. */
export type InputAction =
  | { type: 'inputDigit'; digit: Digit }
  | { type: 'inputDecimal' }
  | { type: 'toggleSign' }
  | { type: 'selectOperation'; operation: BinaryOperation }

export type CalculatorAction =
  | InputAction
  | { type: 'clear' }
  | { type: 'submit'; requestId: number; request: CalculationRequest }
  | { type: 'resolve'; requestId: number; result: number }
  | { type: 'reject'; requestId: number; message: string }
  /** Reports that the current input cannot be submitted. */
  | { type: 'invalidate'; message: string }

/** Outcome of checking whether the current input can be submitted. */
export type Validation = { ok: true; request: CalculationRequest } | { ok: false; message: string }
