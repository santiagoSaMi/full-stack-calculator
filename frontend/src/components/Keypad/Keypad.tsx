import { OPERATIONS } from '../../calculator/operations.ts'
import type { Digit, Operation } from '../../calculator/types.ts'
import { Key } from '../Key/Key.tsx'
import './Keypad.css'

export interface KeypadProps {
  activeOperation: Operation | null
  /** Whether the equals key is enabled. */
  canSubmit: boolean
  /** Disables every key except Clear, e.g. while a calculation is pending. */
  disabled?: boolean
  onDigit: (digit: Digit) => void
  onDecimal: () => void
  onToggleSign: () => void
  onOperation: (operation: Operation) => void
  onSubmit: () => void
  onClear: () => void
}

export function Keypad({
  activeOperation,
  canSubmit,
  disabled = false,
  onDigit,
  onDecimal,
  onToggleSign,
  onOperation,
  onSubmit,
  onClear,
}: KeypadProps) {
  const digitKey = (digit: Digit, colSpan: 1 | 2 = 1) => (
    <Key key={digit} colSpan={colSpan} disabled={disabled} onPress={() => onDigit(digit)}>
      {digit}
    </Key>
  )

  const operationKey = (operation: Operation) => (
    <Key
      key={operation}
      variant="operation"
      label={OPERATIONS[operation].label}
      pressed={activeOperation === operation}
      disabled={disabled}
      onPress={() => onOperation(operation)}
    >
      {OPERATIONS[operation].symbol}
    </Key>
  )

  return (
    <div className="keypad">
      <Key variant="function" label="Clear" colSpan={2} onPress={onClear}>
        C
      </Key>
      <Key variant="function" label="Toggle sign" disabled={disabled} onPress={onToggleSign}>
        ±
      </Key>
      {operationKey('divide')}

      {digitKey('7')}
      {digitKey('8')}
      {digitKey('9')}
      {operationKey('multiply')}

      {digitKey('4')}
      {digitKey('5')}
      {digitKey('6')}
      {operationKey('subtract')}

      {digitKey('1')}
      {digitKey('2')}
      {digitKey('3')}
      {operationKey('add')}

      {digitKey('0', 2)}
      <Key label="Decimal point" disabled={disabled} onPress={onDecimal}>
        .
      </Key>
      <Key variant="submit" label="Equals" disabled={disabled || !canSubmit} onPress={onSubmit}>
        =
      </Key>
    </div>
  )
}
