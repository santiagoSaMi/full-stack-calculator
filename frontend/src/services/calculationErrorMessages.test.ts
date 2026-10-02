import { describe, expect, it } from 'vitest'
import { ERROR_MESSAGES, userMessageFor } from './calculationErrorMessages.ts'
import { CalculatorApiError } from './calculatorApi.ts'

/** An HTTP error as the API client reports it for a response with an API error body. */
function apiError(status: number, code: string, apiMessage = 'technical text from the API'): CalculatorApiError {
  return new CalculatorApiError('http', apiMessage, { status, apiMessage, code })
}

/** An HTTP error for a response without a usable API error body. */
function statusError(status: number): CalculatorApiError {
  return new CalculatorApiError('http', `Request failed with status ${status}`, { status })
}

describe('errors the backend reports about the calculation', () => {
  it.each([
    [422, 'division_by_zero', 'Cannot divide by zero.'],
    [422, 'result_out_of_range', 'The result is too large to calculate.'],
    [422, 'not_a_real_number', 'That calculation has no real-number result.'],
    [422, 'negative_square_root', 'Cannot take the square root of a negative number.'],
    [400, 'field_out_of_range', 'That number is too large.'],
    [400, 'unsupported_operation', 'That operation is not supported.'],
  ])('explains a %i with code %s', (status, code, message) => {
    expect(userMessageFor(apiError(status, code))).toBe(message)
  })

  it('chooses the message from the code, whatever the API text says', () => {
    expect(userMessageFor(apiError(422, 'division_by_zero', 'reworded: cannot divide by 0'))).toBe(
      'Cannot divide by zero.',
    )
    expect(userMessageFor(apiError(422, 'some_other_code', 'division by zero'))).toBe(
      'That calculation cannot be performed.',
    )
  })

  it('has a fallback for a 422 with a code it does not know', () => {
    expect(userMessageFor(apiError(422, 'some_new_rule'))).toBe('That calculation cannot be performed.')
  })

  it('has a fallback for a 422 without a code', () => {
    const error = new CalculatorApiError('http', 'division by zero', { status: 422, apiMessage: 'division by zero' })

    expect(userMessageFor(error)).toBe('That calculation cannot be performed.')
  })

  it.each(['toString', 'constructor', '__proto__', ''])('treats the code "%s" as unknown', (code) => {
    expect(userMessageFor(apiError(422, code))).toBe('That calculation cannot be performed.')
  })
})

describe('errors about the request itself', () => {
  it.each([
    [400, 'missing_field', 'field "a" is required'],
    [400, 'field_not_allowed', 'field "b" is not allowed for operation "sqrt"'],
    [400, 'field_not_allowed', 'field "b" is not allowed for operation "percent"'],
    [400, 'invalid_field_type', 'field "b" must be a number'],
    [400, 'invalid_field_type', 'field "operation" must be a string'],
    [400, 'invalid_json', 'request body contains malformed JSON'],
    [400, 'unknown_field', 'request body contains unknown field "c"'],
    [413, 'body_too_large', 'request body must not exceed 1024 bytes'],
    [415, 'unsupported_media_type', 'Content-Type must be application/json'],
  ])('hides the technical detail of a %i with code %s', (status, code, apiMessage) => {
    const message = userMessageFor(apiError(status, code, apiMessage))

    expect(message).toBe('The calculation could not be processed. Check your input and try again.')
    expect(message).not.toContain(apiMessage)
  })

  it('uses the same message when a 400 has no API error body', () => {
    expect(userMessageFor(statusError(400))).toBe(ERROR_MESSAGES.invalidRequest)
  })

  it('reports an HTTP error that carries no status generically', () => {
    const error = new CalculatorApiError('http', 'Request failed')

    expect(userMessageFor(error)).toBe('Something went wrong. Please try again.')
  })

  it.each([401, 403, 404, 405, 429])('reports an unexpected %i generically', (status) => {
    expect(userMessageFor(statusError(status))).toBe('Something went wrong. Please try again.')
    expect(userMessageFor(apiError(status, 'not_found'))).toBe('Something went wrong. Please try again.')
  })
})

describe('backend unavailable', () => {
  it.each([502, 503, 504])('reports a %i as the service being unavailable', (status) => {
    expect(userMessageFor(statusError(status))).toBe(
      'The calculator service is unavailable. Please try again later.',
    )
  })

  it('does not show the API error text of a gateway error', () => {
    expect(userMessageFor(apiError(503, 'unavailable', 'upstream connect error'))).toBe(ERROR_MESSAGES.unavailable)
  })

  it.each([
    ['with the API error body', apiError(500, 'internal_error', 'internal server error')],
    ['without a body', statusError(500)],
  ])('reports a 500 %s as a service problem', (_name, error) => {
    expect(userMessageFor(error)).toBe('The calculator service had a problem. Please try again.')
  })

  it('never lets a 5xx be mistaken for a calculation error', () => {
    expect(userMessageFor(apiError(500, 'division_by_zero'))).toBe(ERROR_MESSAGES.serverError)
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
