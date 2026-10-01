import type { CalculationService } from '../../calculator/types.ts'
import { useCalculator } from '../../calculator/useCalculator.ts'
import { Display } from '../Display/Display.tsx'
import { Keypad } from '../Keypad/Keypad.tsx'
import './Calculator.css'

export interface CalculatorProps {
  /** Performs submitted calculations. */
  calculate: CalculationService
}

/** Connects calculator state to the presentational Display and Keypad. */
export function Calculator({ calculate }: CalculatorProps) {
  const calculator = useCalculator(calculate)

  return (
    <section className="calculator" aria-label="Calculator">
      <Display
        expression={calculator.expression}
        value={calculator.displayValue}
        error={calculator.error}
        busy={calculator.isPending}
      />
      <Keypad
        activeOperation={calculator.activeOperation}
        disabled={calculator.isPending}
        onDigit={calculator.inputDigit}
        onDecimal={calculator.inputDecimal}
        onToggleSign={calculator.toggleSign}
        onOperation={calculator.selectOperation}
        onSubmit={calculator.submit}
        onClear={calculator.clear}
      />
    </section>
  )
}
