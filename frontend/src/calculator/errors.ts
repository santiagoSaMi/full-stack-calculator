/**
 * A failed calculation described in terms the user can act on. Its message is
 * written for display; the technical reason, if any, is kept as `cause`.
 */
export class CalculationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'CalculationError'
  }
}

/** Shown when a failure carries no message meant for the user. */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'
