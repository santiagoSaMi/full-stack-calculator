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

export const UNARY_OPERATIONS: Record<UnaryOperation, OperationInfo> = {
  sqrt: { symbol: '√', label: 'Square root' },
}

export function isUnaryRequest(request: CalculationRequest): request is UnaryCalculationRequest {
  return request.operation in UNARY_OPERATIONS
}
