// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VALIDATION_MESSAGES } from '../../calculator/calculatorReducer.ts'
import { CalculationError } from '../../calculator/errors.ts'
import type { CalculationRequest, CalculationService } from '../../calculator/types.ts'
import { Calculator } from './Calculator.tsx'

afterEach(cleanup)

/** A calculation service whose pending call the test settles by hand. */
function deferredService() {
  let settle: { resolve: (result: number) => void; reject: (error: unknown) => void } | undefined
  const service = vi.fn<CalculationService>(
    () =>
      new Promise<number>((resolve, reject) => {
        settle = { resolve, reject }
      }),
  )
  return {
    service,
    resolve: (result: number) => act(async () => settle?.resolve(result)),
    reject: (error: unknown) => act(async () => settle?.reject(error)),
  }
}

/** Presses keys by their accessible names, e.g. press('1', '2', 'Add'). */
function press(...names: string[]) {
  for (const name of names) {
    fireEvent.click(screen.getByRole('button', { name }))
  }
}

const value = () => screen.getByLabelText('Value').textContent
const expression = () => screen.queryByLabelText('Expression')?.textContent
const alert = () => screen.queryByRole('alert')?.textContent ?? null
const isLoading = () => screen.queryByText('Calculating…') !== null
const key = (name: string) => screen.getByRole('button', { name })

describe('Calculator', () => {
  it('sends the entered calculation to the service', () => {
    const { service } = deferredService()
    render(<Calculator calculate={service} />)

    press('1', '2', 'Add', '3', 'Equals')

    expect(service).toHaveBeenCalledOnce()
    expect(service).toHaveBeenCalledWith({ operation: 'add', a: 12, b: 3 } satisfies CalculationRequest)
  })

  it.each([
    ['Add', 'add'],
    ['Subtract', 'subtract'],
    ['Multiply', 'multiply'],
    ['Divide', 'divide'],
  ])('sends the %s key as the "%s" operation', (keyName, operation) => {
    const { service } = deferredService()
    render(<Calculator calculate={service} />)

    press('8', keyName, '2', 'Equals')

    expect(service).toHaveBeenCalledWith({ operation, a: 8, b: 2 })
  })

  it('sends decimal and negative operands', () => {
    const { service } = deferredService()
    render(<Calculator calculate={service} />)

    press('1', 'Decimal point', '5', 'Toggle sign', 'Multiply', '0', 'Decimal point', '2', '5', 'Equals')

    expect(service).toHaveBeenCalledWith({ operation: 'multiply', a: -1.5, b: 0.25 })
  })

  it('displays the result returned by the service, not a locally computed one', async () => {
    const { service, resolve } = deferredService()
    render(<Calculator calculate={service} />)

    press('2', 'Add', '2', 'Equals')
    await resolve(5)

    expect(value()).toBe('5')
    expect(expression()).toBe('2 + 2 =')
  })

  it('shows a loading state until the service responds', async () => {
    const { service, resolve } = deferredService()
    render(<Calculator calculate={service} />)

    expect(isLoading()).toBe(false)

    press('6', 'Multiply', '7', 'Equals')

    expect(isLoading()).toBe(true)
    expect(expression()).toBe('6 × 7 =')

    await resolve(42)

    expect(isLoading()).toBe(false)
    expect(value()).toBe('42')
  })

  it('disables every key except Clear while loading', async () => {
    const { service, resolve } = deferredService()
    render(<Calculator calculate={service} />)

    press('6', 'Multiply', '7', 'Equals')

    for (const name of ['7', 'Decimal point', 'Toggle sign', 'Add', 'Equals']) {
      expect(key(name)).toHaveProperty('disabled', true)
    }
    expect(key('Clear')).toHaveProperty('disabled', false)

    await resolve(42)

    expect(key('7')).toHaveProperty('disabled', false)
  })

  it('does not submit twice while loading', () => {
    const { service } = deferredService()
    render(<Calculator calculate={service} />)

    press('6', 'Multiply', '7', 'Equals', 'Equals')

    expect(service).toHaveBeenCalledOnce()
  })

  describe('validation before submitting', () => {
    it.each([
      ['nothing is entered', [], VALIDATION_MESSAGES.missingOperation, '0'],
      ['only the first operand is entered', ['6'], VALIDATION_MESSAGES.missingOperation, '6'],
      ['the second operand is empty', ['6', 'Multiply'], VALIDATION_MESSAGES.missingSecondOperand, '6'],
    ])('explains what is missing when %s', (_name, keys, message, shown) => {
      const { service } = deferredService()
      render(<Calculator calculate={service} />)

      press(...keys, 'Equals')

      expect(alert()).toBe(message)
      expect(value()).toBe(shown)
      expect(service).not.toHaveBeenCalled()
      expect(isLoading()).toBe(false)
    })

    it('clears the message once the missing operand is typed, and then submits', () => {
      const { service } = deferredService()
      render(<Calculator calculate={service} />)

      press('6', 'Multiply', 'Equals')
      expect(alert()).toBe(VALIDATION_MESSAGES.missingSecondOperand)

      press('7')
      expect(alert()).toBeNull()

      press('Equals')
      expect(service).toHaveBeenCalledWith({ operation: 'multiply', a: 6, b: 7 })
    })

    it('asks for an operation when Equals is pressed again after a result', async () => {
      const { service, resolve } = deferredService()
      render(<Calculator calculate={service} />)

      press('1', 'Add', '2', 'Equals')
      await resolve(3)
      press('Equals')

      expect(alert()).toBe(VALIDATION_MESSAGES.missingOperation)
      expect(value()).toBe('3')
      expect(service).toHaveBeenCalledOnce()
    })

    it('does not send an operand that is not a finite number', async () => {
      const { service, resolve } = deferredService()
      render(<Calculator calculate={service} />)

      // A huge result is shown as "1e+21"; negating it and typing more digits
      // yields "-1e+21999", which is not a finite number.
      press('1', 'Multiply', '1', 'Equals')
      await resolve(1e21)
      press('Toggle sign', '9', '9', '9', 'Add', '1', 'Equals')

      expect(alert()).toBe(VALIDATION_MESSAGES.invalidNumber)
      expect(service).toHaveBeenCalledOnce()
    })

    it('leaves division by zero for the backend to judge', () => {
      const { service } = deferredService()
      render(<Calculator calculate={service} />)

      press('8', 'Divide', '0', 'Equals')

      expect(alert()).toBeNull()
      expect(service).toHaveBeenCalledWith({ operation: 'divide', a: 8, b: 0 })
    })
  })

  describe('when the calculation fails', () => {
    it.each([
      ['division by zero', 'Cannot divide by zero.'],
      ['an unsupported operation', 'That operation is not supported.'],
      ['a network failure', 'Could not reach the calculator service. Check your connection.'],
      ['an unavailable backend', 'The calculator service is unavailable. Please try again later.'],
    ])('shows the message for %s', async (_name, message) => {
      const { service, reject } = deferredService()
      render(<Calculator calculate={service} />)

      press('8', 'Divide', '0', 'Equals')
      await reject(new CalculationError(message))

      expect(alert()).toBe(message)
      expect(isLoading()).toBe(false)
    })

    it.each([
      ['a raw Error', new Error('connect ECONNREFUSED 127.0.0.1:8080')],
      ['a TypeError', new TypeError("Cannot read properties of undefined (reading 'result')")],
      ['a non-Error value', 'not an Error'],
      ['a CalculationError without a message', new CalculationError('')],
    ])('shows a generic message instead of %s', async (_name, error) => {
      const { service, reject } = deferredService()
      render(<Calculator calculate={service} />)

      press('1', 'Add', '1', 'Equals')
      await reject(error)

      expect(alert()).toBe('Something went wrong. Please try again.')
    })

    it('keeps the entered numbers and re-enables the keys', async () => {
      const { service, reject } = deferredService()
      render(<Calculator calculate={service} />)

      press('8', 'Divide', '0', 'Equals')
      await reject(new CalculationError('Cannot divide by zero.'))

      expect(value()).toBe('0')
      expect(key('Equals')).toHaveProperty('disabled', false)
      expect(key('4')).toHaveProperty('disabled', false)
    })

    it('lets the user correct the input and retry', async () => {
      const { service, reject, resolve } = deferredService()
      render(<Calculator calculate={service} />)

      press('8', 'Divide', '0', 'Equals')
      await reject(new CalculationError('Cannot divide by zero.'))
      press('4')

      expect(alert()).toBeNull()

      press('Equals')
      await resolve(2)

      expect(service).toHaveBeenLastCalledWith({ operation: 'divide', a: 8, b: 4 })
      expect(value()).toBe('2')
    })

    it('lets the user retry unchanged after a network failure', async () => {
      const { service, reject, resolve } = deferredService()
      render(<Calculator calculate={service} />)

      press('1', 'Add', '1', 'Equals')
      await reject(new CalculationError('Could not reach the calculator service. Check your connection.'))
      press('Equals')

      expect(alert()).toBeNull()
      expect(isLoading()).toBe(true)

      await resolve(2)

      expect(service).toHaveBeenCalledTimes(2)
      expect(value()).toBe('2')
    })

    it('dismisses the error on Clear', async () => {
      const { service, reject } = deferredService()
      render(<Calculator calculate={service} />)

      press('8', 'Divide', '0', 'Equals')
      await reject(new CalculationError('Cannot divide by zero.'))
      press('Clear')

      expect(alert()).toBeNull()
      expect(value()).toBe('0')
    })
  })

  it('continues from the result into the next calculation', async () => {
    const { service, resolve } = deferredService()
    render(<Calculator calculate={service} />)

    press('1', '2', 'Add', '3', 'Equals')
    await resolve(15)
    press('Multiply', '2', 'Equals')

    expect(service).toHaveBeenLastCalledWith({ operation: 'multiply', a: 15, b: 2 })
  })

  it('ignores a response that arrives after Clear', async () => {
    const { service, resolve } = deferredService()
    render(<Calculator calculate={service} />)

    press('6', 'Multiply', '7', 'Equals', 'Clear')
    await resolve(42)

    expect(value()).toBe('0')
    expect(expression()).toBe('')
    expect(isLoading()).toBe(false)
  })

  it('resets the display on Clear', () => {
    const { service } = deferredService()
    render(<Calculator calculate={service} />)

    press('1', '2', 'Add', '3', 'Clear')

    expect(value()).toBe('0')
    expect(expression()).toBe('')
  })
})
