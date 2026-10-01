import { describe, expect, it } from 'vitest'
import { ERROR_MESSAGES, userMessageFor } from './calculationErrorMessages.ts'
import { CalculatorApiError } from './calculatorApi.ts'

/** An HTTP error as the API client reports it for a response with an API error body. */
function apiError(status: number, apiMessage: string): CalculatorApiError {
  return new CalculatorApiError('http', apiMessage, { status, apiMessage })
}

/** An HTTP error for a response without a usable API error body. */
function statusError(status: number): CalculatorApiError {
  return new CalculatorApiError('http', `Request failed with status ${status}`, { status })
}

describe('errors the backend reports about the calculation', () => {
  it('explains division by zero', () => {
    expect(userMessageFor(apiError(422, 'division by zero'))).toBe('Cannot divide by zero.')
  })

  it('explains a result that is out of range', () => {
    expect(userMessageFor(apiError(422, 'result is out of range'))).toBe('The result is too large to calculate.')
  })

  it('explains a power that has no real-number result', () => {
    expect(userMessageFor(apiError(422, 'result is not a real number'))).toBe(
      'That calculation has no real-number result.',
    )
  })

  it.each(['a', 'b'])('explains operand %s being out of range', (field) => {
    expect(userMessageFor(apiError(400, `field "${field}" is out of range`))).toBe('That number is too large.')
  })

  it.each([
    'unsupported operation "modulo": must be one of add, subtract, multiply, divide, power',
    'unsupported operation "ADD": must be one of add, subtract, multiply, divide, power',
    // The list of operations in the message may grow; only the prefix matters.
    'unsupported operation "sqrt": must be one of add, subtract, multiply, divide',
  ])('explains an unsupported operation', (apiMessage) => {
    expect(userMessageFor(apiError(400, apiMessage))).toBe('That operation is not supported.')
  })

  it('has a fallback for an unrecognized 422', () => {
    expect(userMessageFor(apiError(422, 'some new rule'))).toBe('That calculation cannot be performed.')
  })
})

describe('errors about the request itself', () => {
  it.each([
    [400, 'field "a" is required'],
    [400, 'field "b" must be a number'],
    [400, 'field "operation" must be a string'],
    [400, 'request body contains malformed JSON'],
    [400, 'request body contains unknown field "c"'],
    [413, 'request body must not exceed 1024 bytes'],
    [415, 'Content-Type must be application/json'],
  ])('hides the technical detail of a %i "%s"', (status, apiMessage) => {
    const message = userMessageFor(apiError(status, apiMessage))

    expect(message).toBe('The calculation could not be processed. Check your input and try again.')
    expect(message).not.toContain(apiMessage)
  })

  it('uses the same message when a 400 has no API error body', () => {
    expect(userMessageFor(statusError(400))).toBe(ERROR_MESSAGES.invalidRequest)
  })

  it.each([401, 403, 404, 405, 429])('reports an unexpected %i generically', (status) => {
    expect(userMessageFor(statusError(status))).toBe('Something went wrong. Please try again.')
    expect(userMessageFor(apiError(status, 'not found'))).toBe('Something went wrong. Please try again.')
  })
})

describe('backend unavailable', () => {
  it.each([502, 503, 504])('reports a %i as the service being unavailable', (status) => {
    expect(userMessageFor(statusError(status))).toBe(
      'The calculator service is unavailable. Please try again later.',
    )
  })

  it('does not show the API error text of a gateway error', () => {
    expect(userMessageFor(apiError(503, 'upstream connect error'))).toBe(ERROR_MESSAGES.unavailable)
  })

  it.each([
    ['with the API error body', apiError(500, 'internal server error')],
    ['without a body', statusError(500)],
  ])('reports a 500 %s as a service problem', (_name, error) => {
    expect(userMessageFor(error)).toBe('The calculator service had a problem. Please try again.')
  })

  it('never lets a 5xx be mistaken for a calculation error', () => {
    expect(userMessageFor(apiError(500, 'division by zero'))).toBe(ERROR_MESSAGES.serverError)
  })

  it('reports an unusable success response as a service problem', () => {
    const error = new CalculatorApiError('invalid_response', 'Response body is not valid', { status: 200 })

    expect(userMessageFor(error)).toBe('The calculator service had a problem. Please try again.')
  })
})

describe('network failures', () => {
  it('reports that the service could not be reached', () => {
    const error = new CalculatorApiError('network', 'Network request failed', {
      cause: new TypeError('Failed to fetch'),
    })

    expect(userMessageFor(error)).toBe('Could not reach the calculator service. Check your connection.')
  })

  it('reports a timeout', () => {
    const error = new CalculatorApiError('timeout', 'Request timed out')

    expect(userMessageFor(error)).toBe('The calculator service took too long to respond. Please try again.')
  })
})

describe('unexpected failures', () => {
  it.each([
    ['a TypeError', new TypeError("Cannot read properties of undefined (reading 'result')")],
    ['a plain Error', new Error('ECONNRESET at TCP.onStreamRead')],
    ['an abort', new DOMException('The operation was aborted.', 'AbortError')],
    ['a string', 'boom'],
    ['undefined', undefined],
    ['null', null],
  ])('reports %s generically', (_name, error) => {
    expect(userMessageFor(error)).toBe('Something went wrong. Please try again.')
  })
})

describe('every message', () => {
  it.each(Object.entries(ERROR_MESSAGES))('%s is a complete sentence short enough for the display', (_key, message) => {
    expect(message).toMatch(/^[A-Z].*\.$/)
    expect(message.length).toBeLessThanOrEqual(80)
  })
})
