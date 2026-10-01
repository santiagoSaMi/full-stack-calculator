import { describe, expect, it } from 'vitest'
import {
  calculatorReducer,
  formatNumber,
  initialState,
  MAX_DIGITS,
  selectDisplayValue,
  selectError,
  selectExpression,
  selectIsPending,
  validateSubmission,
  VALIDATION_MESSAGES,
} from './calculatorReducer.ts'
import type { CalculationRequest, CalculatorAction, CalculatorState, Digit, Operation } from './types.ts'

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

/** The request the current input would submit, or null if it is not valid. */
function requestOf(state: CalculatorState): CalculationRequest | null {
  const validation = validateSubmission(state)
  return validation.ok ? validation.request : null
}

/** The validation message for the current input, or null if it is valid. */
function validationMessage(state: CalculatorState): string | null {
  const validation = validateSubmission(state)
  return validation.ok ? null : validation.message
}

/** Submits the current input with the given request id. */
function submit(state: CalculatorState, requestId = 1): CalculatorState {
  const request = requestOf(state)
  if (request === null) throw new Error('state has no complete request')
  return calculatorReducer(state, { type: 'submit', requestId, request })
}

function resolve(state: CalculatorState, result: number, requestId = 1): CalculatorState {
  return calculatorReducer(state, { type: 'resolve', requestId, result })
}

function reject(state: CalculatorState, message: string, requestId = 1): CalculatorState {
  return calculatorReducer(state, { type: 'reject', requestId, message })
}

function invalidate(state: CalculatorState, message: string): CalculatorState {
  return calculatorReducer(state, { type: 'invalidate', message })
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

describe('validating the submission', () => {
  it.each([
    ['nothing entered', run(), VALIDATION_MESSAGES.missingOperation],
    ['only a first operand', run(...type('12')), VALIDATION_MESSAGES.missingOperation],
    ['no second operand', run(...type('12'), op('add')), VALIDATION_MESSAGES.missingSecondOperand],
    [
      'no second operand after switching the operation',
      run(...type('12'), op('add'), op('divide')),
      VALIDATION_MESSAGES.missingSecondOperand,
    ],
  ])('rejects %s', (_name, state, message) => {
    expect(validateSubmission(state)).toEqual({ ok: false, message })
  })

  it('accepts both operands and an operation', () => {
    const state = run(...type('12'), op('add'), digit('3'))

    expect(validateSubmission(state)).toEqual({ ok: true, request: { operation: 'add', a: 12, b: 3 } })
  })

  it('converts decimal and negative operands to numbers', () => {
    const state = run(...type('-5.5'), op('divide'), ...type('-0.25'))

    expect(requestOf(state)).toEqual({ operation: 'divide', a: -5.5, b: -0.25 })
  })

  it('ignores trailing decimal points', () => {
    const state = run(...type('5.'), op('add'), ...type('2.'))

    expect(requestOf(state)).toEqual({ operation: 'add', a: 5, b: 2 })
  })

  it('accepts zero operands', () => {
    expect(requestOf(run(digit('0'), op('add'), digit('0')))).toEqual({ operation: 'add', a: 0, b: 0 })
  })

  it('does not judge division by zero, which is the backend\'s decision', () => {
    const state = run(digit('8'), op('divide'), digit('0'))

    expect(validateSubmission(state)).toEqual({ ok: true, request: { operation: 'divide', a: 8, b: 0 } })
  })

  it.each([
    ['first', { firstOperand: '1e+999', operation: 'add', currentInput: '1' }],
    ['second', { firstOperand: '1', operation: 'add', currentInput: '-1e+999' }],
    ['first (not a number)', { firstOperand: 'abc', operation: 'add', currentInput: '1' }],
    ['second (not a number)', { firstOperand: '1', operation: 'add', currentInput: '1.2.3' }],
  ] as const)('rejects a %s operand that is not a finite number', (_name, operands) => {
    const state: CalculatorState = { ...initialState, ...operands }

    expect(validationMessage(state)).toBe(VALIDATION_MESSAGES.invalidNumber)
  })

  it('rejects an operand made invalid by editing a very large result', () => {
    // 1e21 is displayed as "1e+21"; negating it and typing more digits
    // produces "-1e+21999", which overflows to -Infinity.
    const result = resolve(submit(run(digit('1'), op('multiply'), digit('1'))), 1e21)
    const edited = apply(result, sign, digit('9'), digit('9'), digit('9'), op('add'), digit('1'))

    expect(edited.firstOperand).toBe('-1e+21999')
    expect(validationMessage(edited)).toBe(VALIDATION_MESSAGES.invalidNumber)
  })
})

describe('reporting invalid input', () => {
  it('stores the validation message as the error', () => {
    const state = invalidate(run(...type('12'), op('add')), VALIDATION_MESSAGES.missingSecondOperand)

    expect(selectError(state)).toBe(VALIDATION_MESSAGES.missingSecondOperand)
    expect(selectIsPending(state)).toBe(false)
  })

  it('keeps what was entered', () => {
    const before = run(...type('12'), op('add'))
    const state = invalidate(before, VALIDATION_MESSAGES.missingSecondOperand)

    expect(state.firstOperand).toBe('12')
    expect(state.operation).toBe('add')
    expect(selectDisplayValue(state)).toBe('12')
  })

  it('dismisses the message on the next input', () => {
    const state = apply(invalidate(run(...type('12'), op('add')), 'message'), digit('3'))

    expect(selectError(state)).toBeNull()
    expect(requestOf(state)).toEqual({ operation: 'add', a: 12, b: 3 })
  })

  it('still replaces a result when typing after an invalid submit', () => {
    const done = resolve(submit(run(...type('12'), op('add'), digit('3'))), 15)
    const state = apply(invalidate(done, VALIDATION_MESSAGES.missingOperation), digit('7'))

    expect(selectDisplayValue(state)).toBe('7')
  })

  it('is ignored while a calculation is pending', () => {
    const pending = submit(run(digit('6'), op('multiply'), digit('7')))

    expect(invalidate(pending, 'message')).toBe(pending)
  })
})

describe('while a calculation is pending', () => {
  const ready = run(digit('6'), op('multiply'), digit('7'))
  const pending = submit(ready)

  it('is marked as pending and shows the full expression', () => {
    expect(selectIsPending(pending)).toBe(true)
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

  it('needs a new operation before it can be submitted again', () => {
    expect(validationMessage(done)).toBe(VALIDATION_MESSAGES.missingOperation)
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
    expect(requestOf(state)).toEqual({ operation: 'multiply', a: 15, b: 2 })
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
    expect(requestOf(failed)).toEqual({ operation: 'divide', a: 8, b: 0 })
  })

  it('dismisses the error on the next input', () => {
    const state = apply(failed, digit('4'))

    expect(selectError(state)).toBeNull()
    expect(requestOf(state)).toEqual({ operation: 'divide', a: 8, b: 4 })
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
