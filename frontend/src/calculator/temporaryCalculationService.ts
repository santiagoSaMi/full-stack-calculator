/*
 * TEMPORARY — delete this file when the backend integration lands.
 *
 * Stand-in for POST /api/v1/calculate so the UI state flow (pending, success,
 * error) can be exercised before the frontend talks to the backend. The real
 * arithmetic lives in the Go service; nothing else in the frontend may compute
 * results.
 *
 * To replace it: implement a CalculationService that calls the API and pass
 * that to <Calculator> in App.tsx instead. No other file references this one.
 */
import type { CalculationRequest, CalculationService } from './types.ts'

function compute({ operation, a, b }: CalculationRequest): number {
  switch (operation) {
    case 'add':
      return a + b
    case 'subtract':
      return a - b
    case 'multiply':
      return a * b
    case 'divide':
      if (b === 0) throw new Error('division by zero')
      return a / b
  }
}

export const temporaryCalculationService: CalculationService = async (request) => compute(request)
