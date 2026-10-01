import type { Operation } from '../calculator/types.ts'

/** Request body of POST /api/v1/calculate. */
export interface CalculateRequest {
  operation: Operation
  a: number
  b: number
}

/** Response body of a successful POST /api/v1/calculate. */
export interface CalculateResponse {
  result: number
}

/** Response body the API returns for every error. */
export interface ApiErrorResponse {
  error: string
}
