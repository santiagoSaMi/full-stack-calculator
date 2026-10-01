import type { ApiErrorResponse, CalculateRequest, CalculateResponse } from '../types/calculatorApi.ts'

const CALCULATE_PATH = '/api/v1/calculate'

/**
 * Why a call to the calculator API failed:
 * - `network`: the request never got a response (offline, server down, CORS,
 *   timeout).
 * - `http`: the server answered with a non-2xx status.
 * - `invalid_response`: the server answered 2xx with a body that is not a
 *   valid calculate response.
 */
export type CalculatorApiErrorKind = 'network' | 'http' | 'invalid_response'

/** Error thrown for every failed call to the calculator API. */
export class CalculatorApiError extends Error {
  readonly kind: CalculatorApiErrorKind
  /** HTTP status of the response, or null if there was none. */
  readonly status: number | null

  constructor(kind: CalculatorApiErrorKind, message: string, status: number | null, cause?: unknown) {
    super(message, { cause })
    this.name = 'CalculatorApiError'
    this.kind = kind
    this.status = status
  }
}

export interface CalculateOptions {
  /** Cancels the request. An aborted call rejects with the signal's AbortError. */
  signal?: AbortSignal
}

/**
 * Sends a calculation to POST /api/v1/calculate and returns the parsed
 * response. Rejects with a CalculatorApiError whose message is suitable for
 * display.
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
    if (isAbortError(error)) throw error
    throw new CalculatorApiError('network', 'Could not reach the calculator service', null, error)
  }

  const body = await readJson(response)

  if (!response.ok) {
    throw new CalculatorApiError('http', httpErrorMessage(response.status, body), response.status)
  }
  if (!isCalculateResponse(body)) {
    throw new CalculatorApiError(
      'invalid_response',
      'Received an invalid response from the calculator service',
      response.status,
    )
  }
  return { result: body.result }
}

const UNAVAILABLE_MESSAGE = 'The calculator service is unavailable'

/** Statuses a proxy or gateway returns when it cannot get an answer from the backend. */
const GATEWAY_STATUSES = new Set([502, 503, 504])

/** Picks the message for a non-2xx response: the API's own, if it sent one. */
function httpErrorMessage(status: number, body: unknown): string {
  if (isApiErrorResponse(body)) return body.error
  if (GATEWAY_STATUSES.has(status)) return UNAVAILABLE_MESSAGE
  return `Request failed with status ${status}`
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
  return isObject(value) && typeof value.error === 'string' && value.error !== ''
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
