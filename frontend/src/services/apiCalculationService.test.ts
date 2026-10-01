import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalculationError } from '../calculator/errors.ts'
import { apiCalculationService } from './apiCalculationService.ts'
import { calculate, CalculatorApiError } from './calculatorApi.ts'

vi.mock('./calculatorApi.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./calculatorApi.ts')>()),
  calculate: vi.fn(),
}))

const calculateMock = vi.mocked(calculate)

afterEach(() => {
  calculateMock.mockReset()
})

/** Runs the service and returns the error it rejects with. */
async function serviceError(): Promise<unknown> {
  return apiCalculationService({ operation: 'divide', a: 1, b: 0 }).catch((e: unknown) => e)
}

describe('apiCalculationService', () => {
  it('sends the request to the API client and returns the result', async () => {
    calculateMock.mockResolvedValue({ result: 15 })

    await expect(apiCalculationService({ operation: 'add', a: 10, b: 5 })).resolves.toBe(15)

    expect(calculateMock).toHaveBeenCalledOnce()
    expect(calculateMock.mock.calls[0]![0]).toEqual({ operation: 'add', a: 10, b: 5 })
  })

  it('passes a single-operand request through unchanged', async () => {
    calculateMock.mockResolvedValue({ result: 3 })

    await expect(apiCalculationService({ operation: 'sqrt', a: 9 })).resolves.toBe(3)

    expect(calculateMock.mock.calls[0]![0]).toEqual({ operation: 'sqrt', a: 9 })
  })

  it('gives the request a timeout signal', async () => {
    calculateMock.mockResolvedValue({ result: 0 })

    await apiCalculationService({ operation: 'add', a: 0, b: 0 })

    expect(calculateMock.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([
    [
      'division by zero from the backend',
      new CalculatorApiError('http', 'division by zero', { status: 422, apiMessage: 'division by zero' }),
      'Cannot divide by zero.',
    ],
    [
      'a square root of a negative number',
      new CalculatorApiError('http', 'square root of a negative number', {
        status: 422,
        apiMessage: 'square root of a negative number',
      }),
      'Cannot take the square root of a negative number.',
    ],
    [
      'an unsupported operation',
      new CalculatorApiError('http', 'unsupported operation "pow"', {
        status: 400,
        apiMessage: 'unsupported operation "pow": must be one of add, subtract, multiply, divide, power, sqrt, percent',
      }),
      'That operation is not supported.',
    ],
    [
      'a network failure',
      new CalculatorApiError('network', 'Network request failed'),
      'Could not reach the calculator service. Check your connection.',
    ],
    [
      'a timeout',
      new CalculatorApiError('timeout', 'Request timed out'),
      'The calculator service took too long to respond. Please try again.',
    ],
    [
      'an unavailable backend',
      new CalculatorApiError('http', 'Request failed with status 502', { status: 502 }),
      'The calculator service is unavailable. Please try again later.',
    ],
    ['an unexpected error', new TypeError('x is undefined'), 'Something went wrong. Please try again.'],
  ])('rejects with a user-facing CalculationError for %s', async (_name, cause, message) => {
    calculateMock.mockRejectedValue(cause)

    const error = await serviceError()

    expect(error).toBeInstanceOf(CalculationError)
    expect((error as CalculationError).message).toBe(message)
    expect((error as CalculationError).cause).toBe(cause)
  })
})
