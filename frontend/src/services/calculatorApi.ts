import type { ApiErrorResponse, CalculateRequest, CalculateResponse } from '../types/calculatorApi.ts'

const CALCULATE_PATH = '/api/v1/calculate'

/**
 * Why a call to the calculator API failed:
 * - `network`: the request never got a response (offline, server down, CORS).
 * - `timeout`: the request was cancelled by a timeout signal.
 * - `http`: the server answered with a non-2xx status.
 * - `invalid_response`: the server answered 2xx with a body that is not a
 *   valid calculate response.
 */
export type CalculatorApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid_response'

export interface CalculatorApiErrorDetails {
  /** HTTP status of the response, if there was one. */
  status?: number
  /** The `error` text of the API's error body, if it sent a valid one. */
  apiMessage?: string
  /** The `code` of the API's error body, if it sent one. */
  code?: string
  cause?: unknown
}

/**
 * Error thrown for every failed call to the calculator API. It describes the
 * failure in technical terms; its message is for logs, not for end users.
 */
export class CalculatorApiError extends Error {
  readonly kind: CalculatorApiErrorKind
  /** HTTP status of the response, or null if there was none. */
  readonly status: number | null
  /** The `error` text from the API's error body, or null if there was none. For logs only. */
  readonly apiMessage: string | null
  /** The error code from the API's error body, or null if there was none. */
  readonly code: string | null

  constructor(kind: CalculatorApiErrorKind, message: string, details: CalculatorApiErrorDetails = {}) {
    super(message, { cause: details.cause })
    this.name = 'CalculatorApiError'
    this.kind = kind
    this.status = details.status ?? null
    this.apiMessage = details.apiMessage ?? null
    this.code = details.code ?? null
  }
}

export interface CalculateOptions {
  /** Cancels the request. An aborted call rejects with the signal's AbortError. */
  signal?: AbortSignal
}

/**
 * Sends a calculation to POST /api/v1/calculate and returns the parsed
 * response. Rejects with a CalculatorApiError.
 */
export async function calculate(
  request: CalculateRequest,
  options: CalculateOptions = {},
): Promise<CalculateResponse> {
  let response: Response
  try {
    response = await fetch(getBaseUrl() + CALCULATE_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      signal: options.signal,
    })
  } catch (error) {
    if (isDomException(error, 'AbortError')) throw error
    if (isDomException(error, 'TimeoutError')) {
      throw new CalculatorApiError('timeout', 'Request timed out', { cause: error })
    }
    throw new CalculatorApiError('network', 'Network request failed', { cause: error })
  }

  const { status } = response
  const body = await readJson(response)

  if (!response.ok) {
    const apiError = isApiErrorResponse(body) ? body : undefined
    throw new CalculatorApiError('http', apiError?.error ?? `Request failed with status ${status}`, {
      status,
      apiMessage: apiError?.error,
      code: apiError?.code,
    })
  }
  if (!isCalculateResponse(body)) {
    throw new CalculatorApiError('invalid_response', 'Response body is not a valid calculate response', {
      status,
    })
  }
  return { result: body.result }
}

/**
 * Base URL of the backend, from VITE_API_BASE_URL. Defaults to the empty
 * string, which makes requests relative to the page's own origin.
 */
function getBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
}

/** Reads the response body as JSON, or returns undefined if it is not JSON. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text())
  } catch {
    return undefined
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCalculateResponse(value: unknown): value is CalculateResponse {
  return isObject(value) && typeof value.result === 'number' && Number.isFinite(value.result)
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isObject(value) &&
    typeof value.error === 'string' &&
    value.error !== '' &&
    (value.code === undefined || typeof value.code === 'string')
  )
}

function isDomException(error: unknown, name: string): boolean {
  return error instanceof DOMException && error.name === name
}
