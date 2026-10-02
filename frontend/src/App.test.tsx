// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { alert, expression, isDisabled, isLoading, press, value } from './test/calculatorPage.ts'

/*
 * The whole frontend with only the network mocked: the real components, hook,
 * service and API client run, and fetch is replaced so no request leaves the
 * test. Each test controls when and how the "backend" answers.
 */

const fetchMock = vi.fn<typeof fetch>()

/** Makes the next request wait until the test answers it. */
function pendingRequest() {
  let settle: { resolve: (response: Response) => void; reject: (error: unknown) => void } | undefined
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve, reject) => {
        settle = { resolve, reject }
      }),
  )
  return {
    respond: (status: number, body: unknown) =>
      act(async () => {
        settle?.resolve(typeof body === 'string' ? new Response(body, { status }) : jsonResponse(status, body))
      }),
    fail: (error: unknown) => act(async () => settle?.reject(error)),
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** The JSON body of the nth request sent to the API. */
function sentBody(call = 0): unknown {
  return JSON.parse(String(fetchMock.mock.calls[call]![1]?.body))
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_API_BASE_URL', '')
})

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('App', () => {
  it('renders the page title and the calculator', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Full-Stack Calculator' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Calculator' })).toBeTruthy()
    expect(value()).toBe('0')
  })

  it('makes no request until a calculation is submitted', () => {
    render(<App />)

    press('1', '2', 'Add', '3')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the calculation to the API as JSON', () => {
    pendingRequest()
    render(<App />)

    press('1', '2', 'Add', '3', 'Equals')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/calculate')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(sentBody()).toEqual({ operation: 'add', a: 12, b: 3 })
  })

  it.each([
    ['Add', 'add'],
    ['Subtract', 'subtract'],
    ['Multiply', 'multiply'],
    ['Divide', 'divide'],
    ['Power', 'power'],
  ] as const)('sends the %s key as the "%s" operation', (name, operation) => {
    pendingRequest()
    render(<App />)

    press('9', name, '3', 'Equals')

    expect(sentBody()).toEqual({ operation, a: 9, b: 3 })
  })

  it('calculates a power through the API', async () => {
    const request = pendingRequest()
    render(<App />)

    press('2', 'Power', '1', '0', 'Equals')

    expect(sentBody()).toEqual({ operation: 'power', a: 2, b: 10 })

    await request.respond(200, { result: 1024 })

    expect(value()).toBe('1024')
    expect(expression()).toBe('2 ^ 10 =')
  })

  describe('square root', () => {
    it('posts a single-operand request with no b', async () => {
      const request = pendingRequest()
      render(<App />)

      press('9', 'Square root')

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/calculate')
      expect(sentBody()).toEqual({ operation: 'sqrt', a: 9 })
      expect(sentBody()).not.toHaveProperty('b')

      await request.respond(200, { result: 3 })

      expect(value()).toBe('3')
      expect(expression()).toBe('√(9) =')
    })

    it('shows a clear message when the API rejects a negative number', async () => {
      const request = pendingRequest()
      render(<App />)

      press('9', 'Toggle sign', 'Square root')

      expect(sentBody()).toEqual({ operation: 'sqrt', a: -9 })

      await request.respond(422, { error: 'square root of a negative number', code: 'negative_square_root' })

      expect(alert()).toBe('Cannot take the square root of a negative number.')
      expect(value()).toBe('-9')
    })

    it('feeds its result into a two-operand calculation', async () => {
      const root = pendingRequest()
      render(<App />)

      press('9', 'Add', '1', '6', 'Square root')
      await root.respond(200, { result: 4 })

      const sum = pendingRequest()
      press('Equals')

      expect(sentBody(1)).toEqual({ operation: 'add', a: 9, b: 4 })

      await sum.respond(200, { result: 13 })

      expect(value()).toBe('13')
    })

    it('still sends b for every two-operand operation', () => {
      pendingRequest()
      render(<App />)

      press('9', 'Add', '4', 'Equals')

      expect(sentBody()).toEqual({ operation: 'add', a: 9, b: 4 })
    })
  })

  describe('percent', () => {
    it('posts a single-operand request with no b and shows the result', async () => {
      const request = pendingRequest()
      render(<App />)

      press('5', '0', 'Percent')

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(sentBody()).toEqual({ operation: 'percent', a: 50 })
      expect(sentBody()).not.toHaveProperty('b')

      await request.respond(200, { result: 0.5 })

      expect(value()).toBe('0.5')
      expect(expression()).toBe('50% =')
    })

    it('takes 10% of 200 with two requests: percent, then multiply', async () => {
      const rate = pendingRequest()
      render(<App />)

      press('2', '0', '0', 'Multiply', '1', '0', 'Percent')

      expect(sentBody(0)).toEqual({ operation: 'percent', a: 10 })

      await rate.respond(200, { result: 0.1 })

      const product = pendingRequest()
      press('Equals')

      expect(sentBody(1)).toEqual({ operation: 'multiply', a: 200, b: 0.1 })

      await product.respond(200, { result: 20 })

      expect(value()).toBe('20')
      expect(expression()).toBe('200 × 0.1 =')
    })

    it('shows a clear message if the API is unavailable', async () => {
      const request = pendingRequest()
      render(<App />)

      press('5', '0', 'Percent')
      await request.respond(502, '')

      expect(alert()).toBe('The calculator service is unavailable. Please try again later.')
      expect(value()).toBe('50')
    })
  })

  it('sends decimal and negative numbers as JSON numbers', () => {
    pendingRequest()
    render(<App />)

    press('7', 'Decimal point', '5', 'Toggle sign', 'Divide', '0', 'Decimal point', '2', '5', 'Equals')

    expect(sentBody()).toEqual({ operation: 'divide', a: -7.5, b: 0.25 })
  })

  it('shows a loading state, then the result from the API', async () => {
    const request = pendingRequest()
    render(<App />)

    press('1', '2', 'Add', '3', 'Equals')

    expect(isLoading()).toBe(true)
    expect(expression()).toBe('12 + 3 =')
    expect(isDisabled('7')).toBe(true)

    await request.respond(200, { result: 15 })

    expect(isLoading()).toBe(false)
    expect(value()).toBe('15')
    expect(expression()).toBe('12 + 3 =')
    expect(alert()).toBeNull()
    expect(isDisabled('7')).toBe(false)
  })

  it('shows exactly what the API returned rather than computing it', async () => {
    const request = pendingRequest()
    render(<App />)

    press('2', 'Add', '2', 'Equals')
    await request.respond(200, { result: 5 })

    expect(value()).toBe('5')
  })

  it('shows a decimal result without floating-point noise', async () => {
    const request = pendingRequest()
    render(<App />)

    press('Decimal point', '1', 'Add', 'Decimal point', '2', 'Equals')
    await request.respond(200, { result: 0.30000000000000004 })

    expect(value()).toBe('0.3')
  })

  it('sends a result on at full precision: 10 ÷ 3 = × 3 = gives 10', async () => {
    const first = pendingRequest()
    render(<App />)

    press('1', '0', 'Divide', '3', 'Equals')
    await first.respond(200, { result: 3.3333333333333335 })

    expect(value()).toBe('3.33333333333333')

    const second = pendingRequest()
    press('Multiply', '3', 'Equals')

    // The exact value the API returned, not the 15 digits on the display.
    expect(fetchMock.mock.calls[1]![1]?.body).toBe('{"operation":"multiply","a":3.3333333333333335,"b":3}')

    await second.respond(200, { result: 10 })

    expect(value()).toBe('10')
  })

  it('uses a result as the start of the next calculation', async () => {
    const first = pendingRequest()
    render(<App />)

    press('1', '2', 'Add', '3', 'Equals')
    await first.respond(200, { result: 15 })

    const second = pendingRequest()
    press('Multiply', '2', 'Equals')

    expect(sentBody(1)).toEqual({ operation: 'multiply', a: 15, b: 2 })

    await second.respond(200, { result: 30 })

    expect(value()).toBe('30')
  })

  describe('validation errors', () => {
    it('explains a missing operation without calling the API', () => {
      render(<App />)

      press('6', 'Equals')

      expect(alert()).toBe('Choose an operation first.')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('explains a missing second number without calling the API', () => {
      render(<App />)

      press('6', 'Multiply', 'Equals')

      expect(alert()).toBe('Enter a second number.')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('submits once the missing number is entered', async () => {
      const request = pendingRequest()
      render(<App />)

      press('6', 'Multiply', 'Equals', '7', 'Equals')
      await request.respond(200, { result: 42 })

      expect(alert()).toBeNull()
      expect(value()).toBe('42')
    })
  })

  describe('API errors', () => {
    it.each([
      [
        'division by zero',
        422,
        { error: 'division by zero', code: 'division_by_zero' },
        'Cannot divide by zero.',
      ],
      [
        'a power with no real-number result',
        422,
        { error: 'result is not a real number', code: 'not_a_real_number' },
        'That calculation has no real-number result.',
      ],
      [
        'a result out of range',
        422,
        { error: 'result is out of range', code: 'result_out_of_range' },
        'The result is too large to calculate.',
      ],
      [
        'an unsupported operation',
        400,
        {
          error: 'unsupported operation "modulo": must be one of add, subtract, multiply, divide, power, sqrt, percent',
          code: 'unsupported_operation',
        },
        'That operation is not supported.',
      ],
      [
        'an invalid request',
        400,
        { error: 'field "a" is required', code: 'missing_field' },
        'The calculation could not be processed. Check your input and try again.',
      ],
      [
        'an internal server error',
        500,
        { error: 'internal server error', code: 'internal_error' },
        'The calculator service had a problem. Please try again.',
      ],
      ['a bad gateway', 502, '', 'The calculator service is unavailable. Please try again later.'],
      [
        'a service unavailable page',
        503,
        '<html><body>Service Unavailable</body></html>',
        'The calculator service is unavailable. Please try again later.',
      ],
      ['a success with an unusable body', 200, '{"result":', 'The calculator service had a problem. Please try again.'],
    ])('shows a clear message for %s', async (_name, status, body, message) => {
      const request = pendingRequest()
      render(<App />)

      press('8', 'Divide', '0', 'Equals')
      await request.respond(status, body)

      expect(alert()).toBe(message)
      expect(isLoading()).toBe(false)
    })

    it('never shows the raw API error text', async () => {
      const request = pendingRequest()
      render(<App />)

      press('8', 'Divide', '0', 'Equals')
      await request.respond(400, { error: 'request body contains unknown field "c"', code: 'unknown_field' })

      expect(alert()).not.toContain('unknown field')
      expect(document.body.textContent).not.toContain('unknown field')
    })

    it('shows a network failure', async () => {
      const request = pendingRequest()
      render(<App />)

      press('1', 'Add', '1', 'Equals')
      await request.fail(new TypeError('Failed to fetch'))

      expect(alert()).toBe('Could not reach the calculator service. Check your connection.')
      expect(document.body.textContent).not.toContain('Failed to fetch')
    })

    it('shows a timeout', async () => {
      const request = pendingRequest()
      render(<App />)

      press('1', 'Add', '1', 'Equals')
      await request.fail(new DOMException('The operation timed out.', 'TimeoutError'))

      expect(alert()).toBe('The calculator service took too long to respond. Please try again.')
    })

    it('keeps the numbers so the calculation can be corrected and resubmitted', async () => {
      const failed = pendingRequest()
      render(<App />)

      press('8', 'Divide', '0', 'Equals')
      await failed.respond(422, { error: 'division by zero', code: 'division_by_zero' })

      const retried = pendingRequest()
      press('4', 'Equals')

      expect(alert()).toBeNull()
      expect(sentBody(1)).toEqual({ operation: 'divide', a: 8, b: 4 })

      await retried.respond(200, { result: 2 })

      expect(value()).toBe('2')
    })

    it('can be retried unchanged after the backend comes back', async () => {
      const failed = pendingRequest()
      render(<App />)

      press('1', 'Add', '1', 'Equals')
      await failed.respond(502, '')

      const retried = pendingRequest()
      press('Equals')
      await retried.respond(200, { result: 2 })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(alert()).toBeNull()
      expect(value()).toBe('2')
    })
  })

  describe('clearing', () => {
    it('resets the calculator after a result', async () => {
      const request = pendingRequest()
      render(<App />)

      press('1', '2', 'Add', '3', 'Equals')
      await request.respond(200, { result: 15 })
      press('Clear')

      expect(value()).toBe('0')
      expect(expression()).toBe('')
    })

    it('dismisses an API error', async () => {
      const request = pendingRequest()
      render(<App />)

      press('8', 'Divide', '0', 'Equals')
      await request.respond(422, { error: 'division by zero', code: 'division_by_zero' })
      press('Clear')

      expect(alert()).toBeNull()
      expect(value()).toBe('0')
    })

    it('ignores a response that arrives after clearing', async () => {
      const request = pendingRequest()
      render(<App />)

      press('6', 'Multiply', '7', 'Equals', 'Clear')
      await request.respond(200, { result: 42 })

      expect(value()).toBe('0')
      expect(isLoading()).toBe(false)
    })
  })
})
