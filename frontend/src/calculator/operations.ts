import type { BinaryOperation, CalculationRequest, UnaryCalculationRequest, UnaryOperation } from './types.ts'

export interface OperationInfo {
  /** Symbol shown on the key and in the display. */
  symbol: string
  /** Accessible name for the key. */
  label: string
}

export const OPERATIONS: Record<BinaryOperation, OperationInfo> = {
  add: { symbol: '+', label: 'Add' },
  subtract: { symbol: '−', label: 'Subtract' },
  multiply: { symbol: '×', label: 'Multiply' },
  divide: { symbol: '÷', label: 'Divide' },
  power: { symbol: '^', label: 'Power' },
}

export interface UnaryOperationInfo extends OperationInfo {
  /** Writes the operation applied to an operand, e.g. "√(9)" or "50%". */
  format: (operand: string) => string
}

export const UNARY_OPERATIONS: Record<UnaryOperation, UnaryOperationInfo> = {
  sqrt: { symbol: '√', label: 'Square root', format: (operand) => `√(${operand})` },
  // The operand as a percentage: the API divides it by 100.
  percent: { symbol: '%', label: 'Percent', format: (operand) => `${operand}%` },
}

export function isUnaryRequest(request: CalculationRequest): request is UnaryCalculationRequest {
  return request.operation in UNARY_OPERATIONS
}
