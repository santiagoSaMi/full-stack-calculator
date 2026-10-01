import { GENERIC_ERROR_MESSAGE } from '../calculator/errors.ts'
import { CalculatorApiError } from './calculatorApi.ts'

/** User-facing messages for failed calculations. */
export const ERROR_MESSAGES = {
  divisionByZero: 'Cannot divide by zero.',
  resultOutOfRange: 'The result is too large to calculate.',
  notRealNumber: 'That calculation has no real-number result.',
  negativeSquareRoot: 'Cannot take the square root of a negative number.',
  operandOutOfRange: 'That number is too large.',
  unsupportedOperation: 'That operation is not supported.',
  invalidRequest: 'The calculation could not be processed. Check your input and try again.',
  cannotCalculate: 'That calculation cannot be performed.',
  network: 'Could not reach the calculator service. Check your connection.',
  timeout: 'The calculator service took too long to respond. Please try again.',
  unavailable: 'The calculator service is unavailable. Please try again later.',
  serverError: 'The calculator service had a problem. Please try again.',
  generic: GENERIC_ERROR_MESSAGE,
} as const

/**
 * Error texts the API documents for the failures that deserve a specific
 * message. Anything not listed here falls back to a message chosen by status,
 * so an unrecognized or reworded API error still gets a sensible one.
 */
const API_MESSAGE_RULES: ReadonlyArray<{ matches: (apiMessage: string) => boolean; message: string }> = [
  { matches: (m) => m === 'division by zero', message: ERROR_MESSAGES.divisionByZero },
  { matches: (m) => m === 'result is out of range', message: ERROR_MESSAGES.resultOutOfRange },
  { matches: (m) => m === 'result is not a real number', message: ERROR_MESSAGES.notRealNumber },
  { matches: (m) => m === 'square root of a negative number', message: ERROR_MESSAGES.negativeSquareRoot },
  { matches: (m) => /^field "[ab]" is out of range$/.test(m), message: ERROR_MESSAGES.operandOutOfRange },
  { matches: (m) => m.startsWith('unsupported operation '), message: ERROR_MESSAGES.unsupportedOperation },
]

/** Statuses a proxy or gateway returns when it cannot get an answer from the backend. */
const GATEWAY_STATUSES = new Set([502, 503, 504])

/**
 * Translates any failure of a calculation into a message for the user. This
 * is the only place that decides what users are told about API failures; raw
 * API and transport errors are never shown.
 */
export function userMessageFor(error: unknown): string {
  if (!(error instanceof CalculatorApiError)) return ERROR_MESSAGES.generic

  switch (error.kind) {
    case 'network':
      return ERROR_MESSAGES.network
    case 'timeout':
      return ERROR_MESSAGES.timeout
    case 'invalid_response':
      return ERROR_MESSAGES.serverError
    case 'http':
      return httpMessage(error.status, error.apiMessage)
  }
}

function httpMessage(status: number | null, apiMessage: string | null): string {
  if (status === null) return ERROR_MESSAGES.generic
  if (status >= 500) {
    return GATEWAY_STATUSES.has(status) ? ERROR_MESSAGES.unavailable : ERROR_MESSAGES.serverError
  }

  const rule = apiMessage === null ? undefined : API_MESSAGE_RULES.find(({ matches }) => matches(apiMessage))
  if (rule) return rule.message

  if (status === 422) return ERROR_MESSAGES.cannotCalculate
  if (status === 400 || status === 413 || status === 415) return ERROR_MESSAGES.invalidRequest
  return ERROR_MESSAGES.generic
}
