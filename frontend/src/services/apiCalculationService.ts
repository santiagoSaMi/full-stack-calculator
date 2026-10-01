import type { CalculationService } from '../calculator/types.ts'
import { calculate } from './calculatorApi.ts'

/** How long to wait for the backend before giving up on a calculation. */
export const REQUEST_TIMEOUT_MS = 10_000

/** CalculationService that obtains results from the backend API. */
export const apiCalculationService: CalculationService = async (request) => {
  const { result } = await calculate(request, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  return result
}
