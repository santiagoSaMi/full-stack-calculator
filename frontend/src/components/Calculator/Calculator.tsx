import { useCalculator } from '../../calculator/useCalculator.ts'
import { Display } from '../Display/Display.tsx'
import { Keypad } from '../Keypad/Keypad.tsx'
import './Calculator.css'

/** Connects calculator state to the presentational Display and Keypad. */
export function Calculator() {
  const calculator = useCalculator()

  return (
    <section className="calculator" aria-label="Calculator">
      <Display expression={calculator.expression} value={calculator.displayValue} />
      <Keypad
        activeOperation={calculator.activeOperation}
        onDigit={calculator.inputDigit}
        onDecimal={calculator.inputDecimal}
        onToggleSign={calculator.toggleSign}
        onOperation={calculator.selectOperation}
        onClear={calculator.clear}
      />
    </section>
  )
}
