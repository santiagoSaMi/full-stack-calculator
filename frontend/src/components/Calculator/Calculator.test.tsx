// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CalculationRequest, CalculationService } from '../../calculator/types.ts'
import { CalculatorApiError } from '../../services/calculatorApi.ts'
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

  it('enables Equals only when the calculation is complete', () => {
    const { service } = deferredService()
    render(<Calculator calculate={service} />)

    expect(key('Equals')).toHaveProperty('disabled', true)
    press('6')
    expect(key('Equals')).toHaveProperty('disabled', true)
    press('Multiply')
    expect(key('Equals')).toHaveProperty('disabled', true)
    press('7')
    expect(key('Equals')).toHaveProperty('disabled', false)
  })

  it('shows an API error to the user', async () => {
    const { service, reject } = deferredService()
    render(<Calculator calculate={service} />)

    press('8', 'Divide', '0', 'Equals')
    await reject(new CalculatorApiError('http', 'division by zero', 422))

    expect(screen.getByRole('alert').textContent).toBe('division by zero')
    expect(isLoading()).toBe(false)
    expect(key('Equals')).toHaveProperty('disabled', false)
  })

  it('shows a network failure to the user', async () => {
    const { service, reject } = deferredService()
    render(<Calculator calculate={service} />)

    press('1', 'Add', '1', 'Equals')
    await reject(new CalculatorApiError('network', 'Could not reach the calculator service', null))

    expect(screen.getByRole('alert').textContent).toBe('Could not reach the calculator service')
    expect(value()).toBe('1')
  })

  it('shows a generic message when the failure has none', async () => {
    const { service, reject } = deferredService()
    render(<Calculator calculate={service} />)

    press('1', 'Add', '1', 'Equals')
    await reject('not an Error')

    expect(screen.getByRole('alert').textContent).toBe('Calculation failed')
  })

  it('lets the user correct the input and retry after an error', async () => {
    const { service, reject, resolve } = deferredService()
    render(<Calculator calculate={service} />)

    press('8', 'Divide', '0', 'Equals')
    await reject(new CalculatorApiError('http', 'division by zero', 422))
    press('4')

    expect(screen.queryByRole('alert')).toBeNull()

    press('Equals')
    await resolve(2)

    expect(service).toHaveBeenLastCalledWith({ operation: 'divide', a: 8, b: 4 })
    expect(value()).toBe('2')
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
