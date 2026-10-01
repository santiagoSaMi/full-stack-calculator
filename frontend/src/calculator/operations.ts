import type { Operation } from './types.ts'

export interface OperationInfo {
  /** Symbol shown on the key and in the display. */
  symbol: string
  /** Accessible name for the key. */
  label: string
}

export const OPERATIONS: Record<Operation, OperationInfo> = {
  add: { symbol: '+', label: 'Add' },
  subtract: { symbol: '−', label: 'Subtract' },
  multiply: { symbol: '×', label: 'Multiply' },
  divide: { symbol: '÷', label: 'Divide' },
  power: { symbol: '^', label: 'Power' },
}
