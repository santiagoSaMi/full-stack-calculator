import { describe, expect, it } from 'vitest'
import {
  calculatorReducer,
  formatNumber,
  initialState,
  MAX_DIGITS,
  selectCanSubmit,
  selectDisplayValue,
  selectError,
  selectExpression,
  selectIsPending,
  selectRequest,
} from './calculatorReducer.ts'
import type { CalculatorAction, CalculatorState, Digit, Operation } from './types.ts'

const digit = (d: Digit): CalculatorAction => ({ type: 'inputDigit', digit: d })
const op = (operation: Operation): CalculatorAction => ({ type: 'selectOperation', operation })
const decimal: CalculatorAction = { type: 'inputDecimal' }
const sign: CalculatorAction = { type: 'toggleSign' }
const clear: CalculatorAction = { type: 'clear' }

/** Types a number such as "-12.5" as a sequence of key presses. */
function type(text: string): CalculatorAction[] {
  const negative = text.startsWith('-')
  const keys = [...text.replace('-', '')].map((char) => (char === '.' ? decimal : digit(char as Digit)))
  return negative ? [...keys, sign] : keys
}

function apply(state: CalculatorState, ...actions: CalculatorAction[]): CalculatorState {
  return actions.reduce(calculatorReducer, state)
}

function run(...actions: CalculatorAction[]): CalculatorState {
  return apply(initialState, ...actions)
}

/** Submits the current input with the given request id. */
function submit(state: CalculatorState, requestId = 1): CalculatorState {
  const request = selectRequest(state)
  if (request === null) throw new Error('state has no complete request')
  return calculatorReducer(state, { type: 'submit', requestId, request })
}

function resolve(state: CalculatorState, result: number, requestId = 1): CalculatorState {
  return calculatorReducer(state, { type: 'resolve', requestId, result })
}

function reject(state: CalculatorState, message: string, requestId = 1): CalculatorState {
  return calculatorReducer(state, { type: 'reject', requestId, message })
}

describe('entering an operand', () => {
  it('starts at zero', () => {
    expect(selectDisplayValue(initialState)).toBe('0')
    expect(selectExpression(initialState)).toBe('')
  })

  it.each([
    ['digits', '123', '123'],
    ['a decimal', '1.5', '1.5'],
    ['a negative number', '-42', '-42'],
    ['a negative decimal', '-0.25', '-0.25'],
  ])('accepts %s', (_name, typed, expected) => {
    expect(selectDisplayValue(run(...type(typed)))).toBe(expected)
  })

  it('replaces the leading zero', () => {
    expect(selectDisplayValue(run(digit('0'), digit('0'), digit('7')))).toBe('7')
  })

  it('ignores additional decimal points', () => {
    expect(selectDisplayValue(run(digit('1'), decimal, decimal, digit('5'), decimal, digit('2')))).toBe('1.52')
  })

  it('starts with "0." when the decimal point comes first', () => {
    expect(selectDisplayValue(run(decimal, digit('5')))).toBe('0.5')
  })

  it('toggles the sign back and forth', () => {
    expect(selectDisplayValue(run(digit('4'), sign))).toBe('-4')
    expect(selectDisplayValue(run(digit('4'), sign, sign))).toBe('4')
  })

  it('allows the sign before the digits', () => {
    expect(selectDisplayValue(run(sign, digit('5')))).toBe('-5')
  })

  it(`stops at ${MAX_DIGITS} digits`, () => {
    const state = run(...Array.from({ length: MAX_DIGITS + 5 }, () => digit('9')))
    expect(selectDisplayValue(state)).toBe('9'.repeat(MAX_DIGITS))
  })
})

describe('selecting an operation', () => {
  it('moves the input to the first operand', () => {
    const state = run(...type('12'), op('add'))

    expect(selectExpression(state)).toBe('12 +')
    expect(selectDisplayValue(state)).toBe('12')
    expect(state.operation).toBe('add')
  })

  it.each([
    ['add', '+'],
    ['subtract', '−'],
    ['multiply', '×'],
    ['divide', '÷'],
  ] as const)('shows the symbol for %s', (operation, symbol) => {
    expect(selectExpression(run(digit('1'), op(operation)))).toBe(`1 ${symbol}`)
  })

  it('drops a trailing decimal point from the first operand', () => {
    expect(selectExpression(run(...type('12.'), op('add')))).toBe('12 +')
  })

  it('switches the operation when another one is selected', () => {
    expect(selectExpression(run(digit('1'), op('add'), op('multiply')))).toBe('1 ×')
  })

  it('keeps the second operand when the operation is switched', () => {
    const state = run(digit('1'), op('add'), digit('9'), op('divide'))

    expect(selectExpression(state)).toBe('1 ÷')
    expect(selectDisplayValue(state)).toBe('9')
  })

  it('enters the second operand separately', () => {
    const state = run(...type('12'), op('add'), ...type('-3.5'))

    expect(selectExpression(state)).toBe('12 +')
    expect(selectDisplayValue(state)).toBe('-3.5')
  })
})

describe('building the request', () => {
  it.each([
    ['only a first operand', run(...type('12'))],
    ['no second operand', run(...type('12'), op('add'))],
  ])('is not ready with %s', (_name, state) => {
    expect(selectRequest(state)).toBeNull()
    expect(selectCanSubmit(state)).toBe(false)
  })

  it('is ready once both operands and an operation are entered', () => {
    const state = run(...type('12'), op('add'), digit('3'))

    expect(selectRequest(state)).toEqual({ operation: 'add', a: 12, b: 3 })
    expect(selectCanSubmit(state)).toBe(true)
  })

  it('converts decimal and negative operands to numbers', () => {
    const state = run(...type('-5.5'), op('divide'), ...type('-0.25'))

    expect(selectRequest(state)).toEqual({ operation: 'divide', a: -5.5, b: -0.25 })
  })

  it('ignores trailing decimal points', () => {
    const state = run(...type('5.'), op('add'), ...type('2.'))

    expect(selectRequest(state)).toEqual({ operation: 'add', a: 5, b: 2 })
  })

  it('allows a zero divisor so the backend decides the outcome', () => {
    const state = run(digit('8'), op('divide'), digit('0'))

    expect(selectRequest(state)).toEqual({ operation: 'divide', a: 8, b: 0 })
  })
})

describe('while a calculation is pending', () => {
  const ready = run(digit('6'), op('multiply'), digit('7'))
  const pending = submit(ready)

  it('is marked as pending and shows the full expression', () => {
    expect(selectIsPending(pending)).toBe(true)
    expect(selectCanSubmit(pending)).toBe(false)
    expect(selectExpression(pending)).toBe('6 × 7 =')
  })

  it('ignores input', () => {
    expect(apply(pending, digit('9'), decimal, sign, op('add'))).toBe(pending)
  })

  it('ignores a second submit', () => {
    expect(submit(pending, 2)).toBe(pending)
  })

  it('ignores a response for a different request', () => {
    expect(resolve(pending, 99, 2)).toBe(pending)
    expect(reject(pending, 'boom', 2)).toBe(pending)
  })

  it('can be cleared, after which the late response is ignored', () => {
    const cleared = calculatorReducer(pending, clear)

    expect(cleared).toBe(initialState)
    expect(resolve(cleared, 42)).toBe(cleared)
    expect(reject(cleared, 'boom')).toBe(cleared)
  })
})

describe('after a successful calculation', () => {
  const done = resolve(submit(run(...type('12'), op('add'), digit('3'))), 15)

  it('shows the result from the service', () => {
    expect(selectDisplayValue(done)).toBe('15')
    expect(selectExpression(done)).toBe('12 + 3 =')
    expect(selectIsPending(done)).toBe(false)
    expect(selectError(done)).toBeNull()
  })

  it('shows whatever the service returned, without recomputing it', () => {
    const state = resolve(submit(run(digit('2'), op('add'), digit('2'))), 5)

    expect(selectDisplayValue(state)).toBe('5')
  })

  it('cannot be resubmitted', () => {
    expect(selectCanSubmit(done)).toBe(false)
  })

  it('starts a new number when a digit is typed', () => {
    const state = apply(done, digit('7'))

    expect(selectDisplayValue(state)).toBe('7')
    expect(selectExpression(state)).toBe('')
  })

  it('starts at "0." when the decimal point is typed', () => {
    expect(selectDisplayValue(apply(done, decimal))).toBe('0.')
  })

  it('negates the result when the sign is toggled', () => {
    expect(selectDisplayValue(apply(done, sign))).toBe('-15')
  })

  it('uses the result as the first operand of the next calculation', () => {
    const state = apply(done, op('multiply'), digit('2'))

    expect(selectExpression(state)).toBe('15 ×')
    expect(selectRequest(state)).toEqual({ operation: 'multiply', a: 15, b: 2 })
  })

  it('resets on clear', () => {
    expect(calculatorReducer(done, clear)).toBe(initialState)
  })
})

describe('after a failed calculation', () => {
  const failed = reject(submit(run(digit('8'), op('divide'), digit('0'))), 'division by zero')

  it('exposes the error message', () => {
    expect(selectError(failed)).toBe('division by zero')
    expect(selectIsPending(failed)).toBe(false)
  })

  it('keeps the operands so the calculation can be corrected', () => {
    expect(selectExpression(failed)).toBe('8 ÷')
    expect(selectDisplayValue(failed)).toBe('0')
    expect(selectCanSubmit(failed)).toBe(true)
  })

  it('dismisses the error on the next input', () => {
    const state = apply(failed, digit('4'))

    expect(selectError(state)).toBeNull()
    expect(selectRequest(state)).toEqual({ operation: 'divide', a: 8, b: 4 })
  })

  it('can be retried unchanged', () => {
    const retried = resolve(submit(failed, 2), 4, 2)

    expect(selectError(retried)).toBeNull()
    expect(selectDisplayValue(retried)).toBe('4')
  })
})

describe('formatNumber', () => {
  it.each([
    [15, '15'],
    [-2.5, '-2.5'],
    [0.1 + 0.2, '0.3'],
    [1 / 3, '0.333333333333333'],
    [-0, '0'],
    [1e21, '1e+21'],
  ])('formats %d as %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })
})

describe('reducer purity', () => {
  it('does not mutate the previous state', () => {
    const before = run(digit('1'))
    const snapshot = structuredClone(before)

    apply(before, digit('2'), op('add'), digit('3'))

    expect(before).toEqual(snapshot)
  })
})
