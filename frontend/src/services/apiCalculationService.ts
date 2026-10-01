import { CalculationError } from '../calculator/errors.ts'
import type { CalculationService } from '../calculator/types.ts'
import { userMessageFor } from './calculationErrorMessages.ts'
import { calculate } from './calculatorApi.ts'

/** How long to wait for the backend before giving up on a calculation. */
export const REQUEST_TIMEOUT_MS = 10_000

/**
 * CalculationService that obtains results from the backend API. Every failure
 * is rethrown as a CalculationError with a user-facing message; the original
 * error is kept as its cause.
 */
export const apiCalculationService: CalculationService = async (request) => {
  try {
    const { result } = await calculate(request, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    return result
  } catch (error) {
    throw new CalculationError(userMessageFor(error), { cause: error })
  }
}
