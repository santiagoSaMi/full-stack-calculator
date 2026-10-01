import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalculateRequest } from '../types/calculatorApi.ts'
import { calculate, CalculatorApiError } from './calculatorApi.ts'

const request: CalculateRequest = { operation: 'add', a: 10, b: 5 }

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Runs calculate() and returns the CalculatorApiError it rejects with. */
async function calculateError(): Promise<CalculatorApiError> {
  const error: unknown = await calculate(request).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(CalculatorApiError)
  return error as CalculatorApiError
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_API_BASE_URL', '')
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('request', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(jsonResponse(200, { result: 15 }))
  })

  it('sends a JSON POST to /api/v1/calculate', async () => {
    await calculate(request)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/calculate')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' })
    expect(init?.body).toBe('{"operation":"add","a":10,"b":5}')
  })

  it.each([
    ['unset', undefined, '/api/v1/calculate'],
    ['empty', '', '/api/v1/calculate'],
    ['an origin', 'http://localhost:8080', 'http://localhost:8080/api/v1/calculate'],
    ['an origin with a trailing slash', 'http://localhost:8080/', 'http://localhost:8080/api/v1/calculate'],
    ['an origin with a path prefix', 'https://example.com/calc//', 'https://example.com/calc/api/v1/calculate'],
  ])('builds the URL when VITE_API_BASE_URL is %s', async (_name, baseUrl, expected) => {
    vi.stubEnv('VITE_API_BASE_URL', baseUrl)

    await calculate(request)

    expect(fetchMock.mock.calls[0]![0]).toBe(expected)
  })

  it('serializes decimal and negative operands', async () => {
    await calculate({ operation: 'divide', a: -7.5, b: 0.25 })

    expect(fetchMock.mock.calls[0]![1]?.body).toBe('{"operation":"divide","a":-7.5,"b":0.25}')
  })

  it('forwards the abort signal', async () => {
    const { signal } = new AbortController()

    await calculate(request, { signal })

    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(signal)
  })
})

describe('successful response', () => {
  it.each([
    ['an integer', 15],
    ['a decimal', 3.75],
    ['a negative number', -2],
    ['zero', 0],
  ])('returns %s result', async (_name, result) => {
    fetchMock.mockResolvedValue(jsonResponse(200, { result }))

    await expect(calculate(request)).resolves.toEqual({ result })
  })

  it('returns only the documented fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { result: 15, extra: 'ignored' }))

    await expect(calculate(request)).resolves.toEqual({ result: 15 })
  })

  it.each([
    ['malformed JSON', '{"result":'],
    ['an empty body', ''],
    ['HTML', '<html><body>OK</body></html>'],
    ['null', 'null'],
    ['an array', '[15]'],
    ['a bare number', '15'],
    ['an empty object', '{}'],
    ['a string result', '{"result":"15"}'],
    ['a null result', '{"result":null}'],
    ['a result that overflows to Infinity', '{"result":1e999}'],
    ['an error body', '{"error":"division by zero"}'],
  ])('rejects %s as an invalid response', async (_name, body) => {
    fetchMock.mockResolvedValue(new Response(body, { status: 200 }))

    const error = await calculateError()

    expect(error.kind).toBe('invalid_response')
    expect(error.status).toBe(200)
    expect(error.message).toBe('Received an invalid response from the calculator service')
  })
})

describe('non-2xx response', () => {
  it.each([
    [400, 'field "a" is required'],
    [413, 'request body must not exceed 1024 bytes'],
    [415, 'Content-Type must be application/json'],
    [422, 'division by zero'],
    [500, 'internal server error'],
  ])('rejects a %i with the API error message', async (status, message) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error: message }))

    const error = await calculateError()

    expect(error.kind).toBe('http')
    expect(error.status).toBe(status)
    expect(error.message).toBe(message)
  })

  it.each([
    ['an HTML body', '<html><body>Bad Gateway</body></html>'],
    ['a plain-text body', 'Method Not Allowed'],
    ['an empty body', ''],
    ['malformed JSON', '{"error":'],
    ['JSON without an error field', '{"message":"nope"}'],
    ['a non-string error field', '{"error":42}'],
    ['an empty error field', '{"error":""}'],
    ['a success body', '{"result":15}'],
  ])('falls back to a generic message for %s', async (_name, body) => {
    fetchMock.mockResolvedValue(new Response(body, { status: 404 }))

    const error = await calculateError()

    expect(error.kind).toBe('http')
    expect(error.status).toBe(404)
    expect(error.message).toBe('Request failed with status 404')
  })

  it.each([502, 503, 504])('reports a %i without an API error as the service being unavailable', async (status) => {
    fetchMock.mockResolvedValue(new Response('', { status }))

    const error = await calculateError()

    expect(error.kind).toBe('http')
    expect(error.status).toBe(status)
    expect(error.message).toBe('The calculator service is unavailable')
  })

  it('prefers the API error message over the gateway fallback', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: 'service is restarting' }))

    expect((await calculateError()).message).toBe('service is restarting')
  })
})

describe('transport failure', () => {
  it('rejects with a network error when fetch fails', async () => {
    const cause = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValue(cause)

    const error = await calculateError()

    expect(error.kind).toBe('network')
    expect(error.status).toBeNull()
    expect(error.message).toBe('Could not reach the calculator service')
    expect(error.cause).toBe(cause)
  })

  it('reports a timeout as a network error', async () => {
    const timeout = new DOMException('The operation timed out.', 'TimeoutError')
    fetchMock.mockRejectedValue(timeout)

    const error = await calculateError()

    expect(error.kind).toBe('network')
    expect(error.message).toBe('Could not reach the calculator service')
    expect(error.cause).toBe(timeout)
  })

  it('rethrows an abort instead of wrapping it', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValue(abort)

    await expect(calculate(request)).rejects.toBe(abort)
  })
})

describe('CalculatorApiError', () => {
  it('is an Error with a recognizable name', () => {
    const error = new CalculatorApiError('http', 'division by zero', 422)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('CalculatorApiError')
  })
})
