import { describe, expect, it } from 'vitest'
import { userMessageFor } from './calculationErrorMessages.ts'
import { CalculatorApiError } from './calculatorApi.ts'

/*
 * The frontend's half of the error contract shared with the backend
 * (contract/api-errors.json, at the repository root). The backend's tests
 * check that each request produces the listed status and code; these check
 * that each status and code produces the listed message for the user.
 */

interface ContractCase {
  name: string
  status: number
  code: string
  message: string
}

// Loaded with a glob, not a static import, so that type-checking and building
// the frontend do not require a file from outside this folder.
const files = import.meta.glob<{ default: { cases: ContractCase[] } }>('../../../contract/api-errors.json', {
  eager: true,
})
const cases = Object.values(files).flatMap((file) => file.default.cases)

describe('error contract with the backend', () => {
  it('is found', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  it.each(cases)('shows "$message" for $name ($status $code)', ({ status, code, message }) => {
    const error = new CalculatorApiError('http', 'technical text', { status, apiMessage: 'technical text', code })

    expect(userMessageFor(error)).toBe(message)
  })
})
