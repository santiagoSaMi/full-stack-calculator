import type { ReactNode } from 'react'
import './Key.css'

export type KeyVariant = 'digit' | 'operation' | 'function' | 'submit'

export interface KeyProps {
  children: ReactNode
  onPress: () => void
  variant?: KeyVariant
  /** Accessible name, for keys whose visible text is a symbol. */
  label?: string
  /** Marks a toggle key (e.g. the selected operation) as active. */
  pressed?: boolean
  /**
   * Makes the key unavailable. It stays focusable (aria-disabled, not the
   * disabled attribute), so a keyboard user who has just pressed it does not
   * lose their place while it is unavailable.
   */
  disabled?: boolean
}

export function Key({
  children,
  onPress,
  variant = 'digit',
  label,
  pressed,
  disabled = false,
}: KeyProps) {
  const className = `key key--${variant}`

  return (
    <button
      type="button"
      className={className}
      onClick={disabled ? undefined : onPress}
      aria-disabled={disabled || undefined}
      aria-label={label}
      aria-pressed={pressed}
    >
      {children}
    </button>
  )
}
