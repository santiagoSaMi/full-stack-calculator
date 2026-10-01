// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CalculationService } from './types.ts'
import { useCalculator } from './useCalculator.ts'

/*
 * The keypad disables its keys while a calculation is pending, so component
 * tests never reach the hook's own guards. These tests call the hook directly
 * to check it stays safe without relying on the UI.
 */

/** A service that never answers, so the calculation stays pending. */
function pendingService() {
  return vi.fn<CalculationService>(() => new Promise<number>(() => {}))
}

function renderCalculatorHook(service: CalculationService) {
  const { result } = renderHook(() => useCalculator(service))
  return {
    calculator: () => result.current,
    run: (action: () => void) => act(action),
  }
}

describe('useCalculator while a calculation is pending', () => {
  it('does not submit a second two-operand calculation', () => {
    const service = pendingService()
    const { calculator, run } = renderCalculatorHook(service)

    run(() => calculator().inputDigit('6'))
    run(() => calculator().selectOperation('multiply'))
    run(() => calculator().inputDigit('7'))
    run(() => calculator().submit())
    run(() => calculator().submit())

    expect(calculator().isPending).toBe(true)
    expect(service).toHaveBeenCalledOnce()
  })

  it('does not apply a single-operand operation', () => {
    const service = pendingService()
    const { calculator, run } = renderCalculatorHook(service)

    run(() => calculator().inputDigit('9'))
    run(() => calculator().applyUnaryOperation('sqrt'))
    run(() => calculator().applyUnaryOperation('sqrt'))

    expect(calculator().isPending).toBe(true)
    expect(service).toHaveBeenCalledOnce()
    expect(service).toHaveBeenCalledWith({ operation: 'sqrt', a: 9 })
  })

  it('does not start a single-operand operation while a two-operand one is pending, or the reverse', () => {
    const service = pendingService()
    const { calculator, run } = renderCalculatorHook(service)

    run(() => calculator().inputDigit('6'))
    run(() => calculator().selectOperation('add'))
    run(() => calculator().inputDigit('3'))
    run(() => calculator().submit())
    run(() => calculator().applyUnaryOperation('sqrt'))

    expect(service).toHaveBeenCalledOnce()
    expect(service).toHaveBeenCalledWith({ operation: 'add', a: 6, b: 3 })
  })

  it('does not report a validation error over the pending calculation', () => {
    const service = pendingService()
    const { calculator, run } = renderCalculatorHook(service)

    run(() => calculator().inputDigit('9'))
    run(() => calculator().applyUnaryOperation('sqrt'))
    run(() => calculator().submit())

    expect(calculator().error).toBeNull()
    expect(calculator().isPending).toBe(true)
  })

  it('accepts a new calculation after Clear', () => {
    const service = pendingService()
    const { calculator, run } = renderCalculatorHook(service)

    run(() => calculator().inputDigit('9'))
    run(() => calculator().applyUnaryOperation('sqrt'))
    run(() => calculator().clear())
    run(() => calculator().inputDigit('4'))
    run(() => calculator().applyUnaryOperation('sqrt'))

    expect(service).toHaveBeenCalledTimes(2)
    expect(service).toHaveBeenLastCalledWith({ operation: 'sqrt', a: 4 })
  })
})
