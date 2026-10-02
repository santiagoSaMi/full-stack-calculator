import type { BinaryOperation, UnaryOperation } from '../calculator/types.ts'

/**
 * Request body of POST /api/v1/calculate. Two-operand operations send `a` and
 * `b`; single-operand operations send only `a`.
 */
export type CalculateRequest =
  | { operation: BinaryOperation; a: number; b: number }
  | { operation: UnaryOperation; a: number }

/** Response body of a successful POST /api/v1/calculate. */
export interface CalculateResponse {
  result: number
}

/** Response body the API returns for every error. */
export interface ApiErrorResponse {
  /** A description of the problem, written for developers. */
  error: string
  /** A stable identifier for the problem, e.g. "division_by_zero". */
  code?: string
}
