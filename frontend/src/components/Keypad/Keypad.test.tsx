// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Operation } from '../../calculator/types.ts'
import { isSelected, key, KEY_NAMES, press } from '../../test/calculatorPage.ts'
import type { KeyName } from '../../test/calculatorPage.ts'
import { Keypad } from './Keypad.tsx'
import type { KeypadProps } from './Keypad.tsx'

afterEach(cleanup)

function renderKeypad(props: Partial<KeypadProps> = {}) {
  const handlers = {
    onDigit: vi.fn(),
    onDecimal: vi.fn(),
    onToggleSign: vi.fn(),
    onOperation: vi.fn(),
    onSubmit: vi.fn(),
    onClear: vi.fn(),
  }
  render(<Keypad activeOperation={null} {...handlers} {...props} />)
  return handlers
}

describe('Keypad', () => {
  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const)('reports digit %s when pressed', (digit) => {
    const handlers = renderKeypad()

    press(digit)

    expect(handlers.onDigit).toHaveBeenCalledOnce()
    expect(handlers.onDigit).toHaveBeenCalledWith(digit)
  })

  it.each<[KeyName, Operation]>([
    ['Add', 'add'],
    ['Subtract', 'subtract'],
    ['Multiply', 'multiply'],
    ['Divide', 'divide'],
    ['Power', 'power'],
  ])('reports the %s key as the "%s" operation', (name, operation) => {
    const handlers = renderKeypad()

    press(name)

    expect(handlers.onOperation).toHaveBeenCalledOnce()
    expect(handlers.onOperation).toHaveBeenCalledWith(operation)
  })

  it.each<[KeyName, 'onDecimal' | 'onToggleSign' | 'onSubmit' | 'onClear']>([
    ['Decimal point', 'onDecimal'],
    ['Toggle sign', 'onToggleSign'],
    ['Equals', 'onSubmit'],
    ['Clear', 'onClear'],
  ])('reports the %s key', (name, handler) => {
    const handlers = renderKeypad()

    press(name)

    expect(handlers[handler]).toHaveBeenCalledOnce()
    for (const [other, fn] of Object.entries(handlers)) {
      if (other !== handler) expect(fn).not.toHaveBeenCalled()
    }
  })

  it.each<[Operation, KeyName]>([
    ['add', 'Add'],
    ['subtract', 'Subtract'],
    ['multiply', 'Multiply'],
    ['divide', 'Divide'],
    ['power', 'Power'],
  ])('marks only the active operation "%s" as selected', (operation, name) => {
    renderKeypad({ activeOperation: operation })

    for (const candidate of ['Add', 'Subtract', 'Multiply', 'Divide', 'Power'] as const) {
      expect(isSelected(candidate)).toBe(candidate === name)
    }
  })

  it('disables every key except Clear when disabled', () => {
    const handlers = renderKeypad({ disabled: true })

    for (const name of KEY_NAMES) {
      expect(key(name)).toHaveProperty('disabled', name !== 'Clear')
    }

    press(...KEY_NAMES)

    expect(handlers.onClear).toHaveBeenCalledOnce()
    expect(handlers.onDigit).not.toHaveBeenCalled()
    expect(handlers.onOperation).not.toHaveBeenCalled()
    expect(handlers.onSubmit).not.toHaveBeenCalled()
  })
})
