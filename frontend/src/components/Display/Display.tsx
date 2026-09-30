import './Display.css'

export interface DisplayProps {
  /** Pending expression, e.g. "12 +". Empty when there is none. */
  expression: string
  /** Main value shown to the user. */
  value: string
}

export function Display({ expression, value }: DisplayProps) {
  return (
    <div className="display">
      <div className="display__expression" aria-label="Expression">
        {expression}
      </div>
      <output className="display__value" aria-live="polite" aria-label="Value">
        {value}
      </output>
    </div>
  )
}
