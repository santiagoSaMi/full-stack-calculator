import './Display.css'

export interface DisplayProps {
  /** Pending expression, e.g. "12 +". Empty when there is none. */
  expression: string
  /** Main value shown to the user. */
  value: string
  /** Error to show instead of the expression, or null. */
  error?: string | null
  /** Dims the value while a calculation is in progress. */
  busy?: boolean
}

export function Display({ expression, value, error = null, busy = false }: DisplayProps) {
  return (
    <div className="display" aria-busy={busy}>
      {error === null ? (
        <div className="display__expression" aria-label="Expression">
          {expression}
        </div>
      ) : (
        <div className="display__error" role="alert">
          {error}
        </div>
      )}
      <output className="display__value" aria-live="polite" aria-label="Value">
        {value}
      </output>
    </div>
  )
}
