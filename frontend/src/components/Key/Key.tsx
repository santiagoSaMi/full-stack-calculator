import type { ReactNode } from 'react'
import './Key.css'

export type KeyVariant = 'digit' | 'operation' | 'function'

export interface KeyProps {
  children: ReactNode
  onPress: () => void
  variant?: KeyVariant
  /** Accessible name, for keys whose visible text is a symbol. */
  label?: string
  /** Marks a toggle key (e.g. the selected operation) as active. */
  pressed?: boolean
  /** Number of grid columns the key spans. */
  colSpan?: 1 | 2 | 3
  /** Number of grid rows the key spans. */
  rowSpan?: 1 | 2
}

export function Key({
  children,
  onPress,
  variant = 'digit',
  label,
  pressed,
  colSpan = 1,
  rowSpan = 1,
}: KeyProps) {
  const className = [
    'key',
    `key--${variant}`,
    colSpan > 1 && `key--col-span-${colSpan}`,
    rowSpan > 1 && `key--row-span-${rowSpan}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={className} onClick={onPress} aria-label={label} aria-pressed={pressed}>
      {children}
    </button>
  )
}
