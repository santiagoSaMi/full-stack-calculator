import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('apiCalculationService', () => {
  it('sends the request to the API client and returns the result', async () => {
    calculateMock.mockResolvedValue({ result: 15 })

    await expect(apiCalculationService({ operation: 'add', a: 10, b: 5 })).resolves.toBe(15)

    expect(calculateMock).toHaveBeenCalledOnce()
    expect(calculateMock.mock.calls[0]![0]).toEqual({ operation: 'add', a: 10, b: 5 })
  })

  it('gives the request a timeout signal', async () => {
    calculateMock.mockResolvedValue({ result: 0 })

    await apiCalculationService({ operation: 'add', a: 0, b: 0 })

    expect(calculateMock.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('propagates API errors unchanged', async () => {
    const error = new CalculatorApiError('http', 'division by zero', 422)
    calculateMock.mockRejectedValue(error)

    await expect(apiCalculationService({ operation: 'divide', a: 1, b: 0 })).rejects.toBe(error)
  })
})
