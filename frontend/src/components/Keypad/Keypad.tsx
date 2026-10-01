import { OPERATIONS, UNARY_OPERATIONS } from '../../calculator/operations.ts'
import type { BinaryOperation, Digit, UnaryOperation } from '../../calculator/types.ts'
import { Key } from '../Key/Key.tsx'
import './Keypad.css'

export interface KeypadProps {
  activeOperation: BinaryOperation | null
  /** Disables every key except Clear, e.g. while a calculation is pending. */
  disabled?: boolean
  onDigit: (digit: Digit) => void
  onDecimal: () => void
  onToggleSign: () => void
  onOperation: (operation: BinaryOperation) => void
  onUnaryOperation: (operation: UnaryOperation) => void
  onSubmit: () => void
  onClear: () => void
}

export function Keypad({
  activeOperation,
  disabled = false,
  onDigit,
  onDecimal,
  onToggleSign,
  onOperation,
  onUnaryOperation,
  onSubmit,
  onClear,
}: KeypadProps) {
  const digitKey = (digit: Digit) => (
    <Key key={digit} disabled={disabled} onPress={() => onDigit(digit)}>
      {digit}
    </Key>
  )

  const operationKey = (operation: BinaryOperation) => (
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

  // Single-operand operations act immediately, so they have no selected state.
  const unaryOperationKey = (operation: UnaryOperation) => (
    <Key
      key={operation}
      variant="operation"
      label={UNARY_OPERATIONS[operation].label}
      disabled={disabled}
      onPress={() => onUnaryOperation(operation)}
    >
      {UNARY_OPERATIONS[operation].symbol}
    </Key>
  )

  return (
    <div className="keypad">
      <Key variant="function" label="Clear" onPress={onClear}>
        C
      </Key>
      {unaryOperationKey('sqrt')}
      {operationKey('power')}
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

      <Key variant="function" label="Toggle sign" disabled={disabled} onPress={onToggleSign}>
        ±
      </Key>
      {digitKey('0')}
      <Key label="Decimal point" disabled={disabled} onPress={onDecimal}>
        .
      </Key>
      <Key variant="submit" label="Equals" disabled={disabled} onPress={onSubmit}>
        =
      </Key>
    </div>
  )
}
