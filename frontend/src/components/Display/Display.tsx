import './Display.css'

export interface DisplayProps {
  /** Pending expression, e.g. "12 +". Empty when there is none. */
  expression: string
  /** Main value shown to the user. */
  value: string
  /** Error to show instead of the expression, or null. */
  error?: string | null
  /** Shows a loading indicator while a calculation is in progress. */
  busy?: boolean
}

/** Font-size step for the value, so longer numbers still fit on one line. */
function valueSize(value: string): 'lg' | 'md' | 'sm' | 'xs' {
  if (value.length <= 9) return 'lg'
  if (value.length <= 13) return 'md'
  if (value.length <= 18) return 'sm'
  return 'xs'
}

export function Display({ expression, value, error = null, busy = false }: DisplayProps) {
  return (
    <div className="display" aria-busy={busy}>
      <div className="display__top">
        <span className="display__status" role="status">
          {busy && <span className="display__loading">Calculating…</span>}
        </span>
        {error === null ? (
          <span className="display__expression" aria-label="Expression">
            {expression}
          </span>
        ) : (
          <span className="display__error" role="alert">
            {error}
          </span>
        )}
      </div>
      <output className="display__value" data-size={valueSize(value)} aria-live="polite" aria-label="Value">
        {value}
      </output>
    </div>
  )
}
