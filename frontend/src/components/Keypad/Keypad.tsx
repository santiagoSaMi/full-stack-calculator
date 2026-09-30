import { OPERATIONS } from '../../calculator/operations.ts'
import type { Digit, Operation } from '../../calculator/types.ts'
import { Key } from '../Key/Key.tsx'
import './Keypad.css'

export interface KeypadProps {
  activeOperation: Operation | null
  onDigit: (digit: Digit) => void
  onDecimal: () => void
  onToggleSign: () => void
  onOperation: (operation: Operation) => void
  onClear: () => void
}

export function Keypad({ activeOperation, onDigit, onDecimal, onToggleSign, onOperation, onClear }: KeypadProps) {
  const digitKey = (digit: Digit) => (
    <Key key={digit} onPress={() => onDigit(digit)}>
      {digit}
    </Key>
  )

  const operationKey = (operation: Operation, rowSpan: 1 | 2 = 1) => (
    <Key
      key={operation}
      variant="operation"
      label={OPERATIONS[operation].label}
      pressed={activeOperation === operation}
      rowSpan={rowSpan}
      onPress={() => onOperation(operation)}
    >
      {OPERATIONS[operation].symbol}
    </Key>
  )

  return (
    <div className="keypad">
      <Key variant="function" label="Clear" colSpan={3} onPress={onClear}>
        C
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
      {operationKey('add', 2)}

      <Key variant="function" label="Toggle sign" onPress={onToggleSign}>
        ±
      </Key>
      {digitKey('0')}
      <Key label="Decimal point" onPress={onDecimal}>
        .
      </Key>
    </div>
  )
}
