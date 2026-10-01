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
  validateUnarySubmission,
  VALIDATION_MESSAGES,
} from './calculatorReducer.ts'
import { OPERATIONS } from './operations.ts'
import type { BinaryOperation, CalculationRequest, CalculatorAction, CalculatorState, Digit } from './types.ts'

const digit = (d: Digit): CalculatorAction => ({ type: 'inputDigit', digit: d })
const op = (operation: BinaryOperation): CalculatorAction => ({ type: 'selectOperation', operation })
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

  it('ignores the decimal point once the digit limit is reached', () => {
    const full = run(...Array.from({ length: MAX_DIGITS }, () => digit('9')))

    expect(selectDisplayValue(apply(full, decimal))).toBe('9'.repeat(MAX_DIGITS))
  })

  it('still accepts the decimal point one digit before the limit', () => {
    const almostFull = run(...Array.from({ length: MAX_DIGITS - 1 }, () => digit('9')))

    expect(selectDisplayValue(apply(almostFull, decimal, digit('5')))).toBe(`${'9'.repeat(MAX_DIGITS - 1)}.5`)
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
    ['power', '^'],
  ] as const)('shows the symbol for %s', (operation, symbol) => {
    expect(selectExpression(run(digit('1'), op(operation)))).toBe(`1 ${symbol}`)
  })

  it('shows a negative base of a power in parentheses', () => {
    const entering = run(...type('-2'), op('power'))
    const pending = submit(apply(entering, digit('2')))

    expect(selectExpression(entering)).toBe('(-2) ^')
    expect(selectExpression(pending)).toBe('(-2) ^ 2 =')
    expect(selectExpression(resolve(pending, 4))).toBe('(-2) ^ 2 =')
  })

  it('does not add parentheses to a positive base or a negative exponent', () => {
    const pending = submit(run(digit('2'), op('power'), ...type('-2')))

    expect(selectExpression(pending)).toBe('2 ^ -2 =')
  })

  it.each(['add', 'subtract', 'multiply', 'divide'] as const)(
    'does not add parentheses to a negative first operand of %s',
    (operation) => {
      expect(selectExpression(run(...type('-2'), op(operation)))).toBe(`-2 ${OPERATIONS[operation].symbol}`)
    },
  )

  it('updates the parentheses when the operation is switched', () => {
    const state = run(...type('-2'), op('add'), op('power'))

    expect(selectExpression(state)).toBe('(-2) ^')
    expect(selectExpression(apply(state, op('multiply')))).toBe('-2 ×')
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

  it('starts a negative second operand when the sign is toggled before any digit', () => {
    const state = run(digit('5'), op('multiply'), sign, digit('3'))

    expect(selectDisplayValue(state)).toBe('-3')
    expect(requestOf(state)).toEqual({ operation: 'multiply', a: 5, b: -3 })
  })

  it('shows a pending minus sign for the second operand before its digits are typed', () => {
    const state = run(digit('5'), op('multiply'), sign)

    expect(selectDisplayValue(state)).toBe('-0')
    expect(selectExpression(state)).toBe('5 ×')
  })

  it('removes the pending minus sign when the sign is toggled again', () => {
    const state = run(digit('5'), op('multiply'), sign, sign, digit('3'))

    expect(requestOf(state)).toEqual({ operation: 'multiply', a: 5, b: 3 })
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

  it('builds a power request with the base first and the exponent second', () => {
    const state = run(digit('2'), op('power'), ...type('10'))

    expect(requestOf(state)).toEqual({ operation: 'power', a: 2, b: 10 })
  })

  it('does not judge powers the backend rejects, such as a negative base with a fractional exponent', () => {
    const state = run(...type('-4'), op('power'), ...type('0.5'))

    expect(validateSubmission(state)).toEqual({ ok: true, request: { operation: 'power', a: -4, b: 0.5 } })
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

describe('square root', () => {
  /** Applies the square root to the number shown, with the given request id. */
  function sqrt(state: CalculatorState, requestId = 1): CalculatorState {
    const validation = validateUnarySubmission(state, 'sqrt')
    if (!validation.ok) throw new Error(validation.message)
    return calculatorReducer(state, { type: 'submit', requestId, request: validation.request })
  }

  describe('building the request', () => {
    it.each([
      ['the number being typed', run(digit('9')), 9],
      ['a decimal', run(...type('2.25')), 2.25],
      ['a number with a trailing decimal point', run(...type('16.')), 16],
      ['the initial zero', run(), 0],
      ['a previous result', resolve(submit(run(digit('7'), op('add'), digit('9'))), 16), 16],
      ['the second operand of a calculation in progress', run(digit('9'), op('add'), ...type('16')), 16],
      ['the first operand when no second one is typed yet', run(digit('9'), op('add')), 9],
    ])('uses %s as the only operand', (_name, state, a) => {
      expect(validateUnarySubmission(state, 'sqrt')).toEqual({ ok: true, request: { operation: 'sqrt', a } })
    })

    it('sends no second operand', () => {
      const validation = validateUnarySubmission(run(digit('9'), op('add'), digit('4')), 'sqrt')

      expect(validation.ok && 'b' in validation.request).toBe(false)
    })

    it('does not judge a negative operand, which is the backend\'s decision', () => {
      expect(validateUnarySubmission(run(...type('-9')), 'sqrt')).toEqual({
        ok: true,
        request: { operation: 'sqrt', a: -9 },
      })
    })

    it('rejects an operand that is not a finite number', () => {
      const state: CalculatorState = { ...initialState, currentInput: '1e+999' }

      expect(validateUnarySubmission(state, 'sqrt')).toEqual({
        ok: false,
        message: VALIDATION_MESSAGES.invalidNumber,
      })
    })
  })

  describe('on its own', () => {
    const pending = sqrt(run(digit('9')))
    const done = resolve(pending, 3)

    it('shows the expression while pending', () => {
      expect(selectIsPending(pending)).toBe(true)
      expect(selectExpression(pending)).toBe('√(9) =')
    })

    it('shows the result', () => {
      expect(selectDisplayValue(done)).toBe('3')
      expect(selectExpression(done)).toBe('√(9) =')
    })

    it('shows a negative operand inside the parentheses', () => {
      expect(selectExpression(sqrt(run(...type('-9'))))).toBe('√(-9) =')
    })

    it('starts a new number when a digit is typed', () => {
      expect(selectDisplayValue(apply(done, digit('5')))).toBe('5')
    })

    it('uses the result as the first operand of the next calculation', () => {
      const state = apply(done, op('add'), digit('1'))

      expect(requestOf(state)).toEqual({ operation: 'add', a: 3, b: 1 })
    })

    it('can be applied again to its own result', () => {
      expect(validateUnarySubmission(resolve(sqrt(run(...type('81'))), 9), 'sqrt')).toEqual({
        ok: true,
        request: { operation: 'sqrt', a: 9 },
      })
    })

    it('needs an operation before Equals can be used', () => {
      expect(validationMessage(done)).toBe(VALIDATION_MESSAGES.missingOperation)
    })
  })

  describe('inside a two-operand calculation', () => {
    const pending = sqrt(run(digit('9'), op('add'), ...type('16')))
    const done = resolve(pending, 4)

    it('replaces only the second operand with the result', () => {
      expect(done.firstOperand).toBe('9')
      expect(done.operation).toBe('add')
      expect(selectDisplayValue(done)).toBe('4')
    })

    it('shows the calculation in progress with the square root in it', () => {
      expect(selectExpression(pending)).toBe('9 + √(16)')
      expect(selectExpression(done)).toBe('9 + √(16)')
    })

    it('lets the outer calculation be submitted with the result', () => {
      expect(requestOf(done)).toEqual({ operation: 'add', a: 9, b: 4 })
      expect(selectExpression(submit(done, 2))).toBe('9 + 4 =')
    })

    it('replaces the result when a digit is typed, keeping the outer calculation', () => {
      const state = apply(done, digit('5'))

      expect(selectExpression(state)).toBe('9 +')
      expect(requestOf(state)).toEqual({ operation: 'add', a: 9, b: 5 })
    })

    it('fills in the second operand from the first when none was typed', () => {
      const state = resolve(sqrt(run(digit('9'), op('multiply'))), 3)

      expect(selectExpression(state)).toBe('9 × √(9)')
      expect(requestOf(state)).toEqual({ operation: 'multiply', a: 9, b: 3 })
    })
  })

  describe('when it fails', () => {
    const failed = reject(sqrt(run(...type('-9'))), 'Cannot take the square root of a negative number.')

    it('exposes the error and keeps the operand', () => {
      expect(selectError(failed)).toBe('Cannot take the square root of a negative number.')
      expect(selectDisplayValue(failed)).toBe('-9')
    })

    it('keeps a calculation in progress', () => {
      const state = reject(sqrt(run(digit('5'), op('add'), ...type('-9'))), 'message')

      expect(state.firstOperand).toBe('5')
      expect(state.operation).toBe('add')
      expect(selectDisplayValue(state)).toBe('-9')
    })

    it('can be corrected and applied again', () => {
      const corrected = apply(failed, sign)

      expect(selectError(corrected)).toBeNull()
      expect(validateUnarySubmission(corrected, 'sqrt')).toEqual({ ok: true, request: { operation: 'sqrt', a: 9 } })
    })
  })

  it('ignores a late response after Clear', () => {
    const cleared = calculatorReducer(sqrt(run(digit('9'))), clear)

    expect(resolve(cleared, 3)).toBe(cleared)
  })
})

describe('percent', () => {
  /** Applies percent to the number shown, with the given request id. */
  function percent(state: CalculatorState, requestId = 1): CalculatorState {
    const validation = validateUnarySubmission(state, 'percent')
    if (!validation.ok) throw new Error(validation.message)
    return calculatorReducer(state, { type: 'submit', requestId, request: validation.request })
  }

  it.each([
    ['the number being typed', run(...type('50')), 50],
    ['a decimal', run(...type('12.5')), 12.5],
    ['a negative number', run(...type('-50')), -50],
    ['zero', run(), 0],
    ['the second operand of a calculation in progress', run(...type('200'), op('multiply'), ...type('10')), 10],
  ])('sends %s as the only operand', (_name, state, a) => {
    const validation = validateUnarySubmission(state, 'percent')

    expect(validation).toEqual({ ok: true, request: { operation: 'percent', a } })
    expect(validation.ok && 'b' in validation.request).toBe(false)
  })

  it('shows the operand with a percent sign while pending and after the result', () => {
    const pending = percent(run(...type('50')))

    expect(selectExpression(pending)).toBe('50% =')
    expect(selectExpression(resolve(pending, 0.5))).toBe('50% =')
    expect(selectDisplayValue(resolve(pending, 0.5))).toBe('0.5')
  })

  it('shows a negative or decimal operand as typed', () => {
    expect(selectExpression(percent(run(...type('-12.5'))))).toBe('-12.5% =')
  })

  describe('inside a two-operand calculation', () => {
    const pending = percent(run(...type('200'), op('multiply'), ...type('10')))
    const done = resolve(pending, 0.1)

    it('replaces only the second operand with the result', () => {
      expect(done.firstOperand).toBe('200')
      expect(done.operation).toBe('multiply')
      expect(selectDisplayValue(done)).toBe('0.1')
    })

    it('shows the calculation in progress with the percentage in it', () => {
      expect(selectExpression(pending)).toBe('200 × 10%')
      expect(selectExpression(done)).toBe('200 × 10%')
    })

    it('lets the outer calculation be submitted with the converted value', () => {
      expect(requestOf(done)).toEqual({ operation: 'multiply', a: 200, b: 0.1 })
    })

    it('does not treat addition specially: the second operand is just divided by 100', () => {
      const added = resolve(percent(run(...type('200'), op('add'), ...type('10'))), 0.1)

      expect(selectExpression(added)).toBe('200 + 10%')
      expect(requestOf(added)).toEqual({ operation: 'add', a: 200, b: 0.1 })
    })
  })

  it('uses the result as the first operand of the next calculation', () => {
    const state = apply(resolve(percent(run(...type('50'))), 0.5), op('multiply'), ...type('80'))

    expect(requestOf(state)).toEqual({ operation: 'multiply', a: 0.5, b: 80 })
  })

  it('can be applied again to its own result', () => {
    const once = resolve(percent(run(...type('50'))), 0.5)

    expect(validateUnarySubmission(once, 'percent')).toEqual({ ok: true, request: { operation: 'percent', a: 0.5 } })
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
