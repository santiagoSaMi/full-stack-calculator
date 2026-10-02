import { fireEvent, screen } from '@testing-library/react'

/*
 * Helpers that interact with the calculator the way a user does: by the
 * accessible names of its keys and the text it shows. Tests built on these do
 * not depend on class names or component internals.
 */

/** Accessible names of every key, in visual (and Tab) order. */
export const KEY_NAMES = [
  'Clear',
  'Square root',
  'Power',
  'Percent',
  '7',
  '8',
  '9',
  'Divide',
  '4',
  '5',
  '6',
  'Multiply',
  '1',
  '2',
  '3',
  'Subtract',
  'Toggle sign',
  '0',
  'Decimal point',
  'Add',
  'Equals',
] as const

export type KeyName = (typeof KEY_NAMES)[number]

/** Returns the key with the given accessible name. */
export function key(name: KeyName): HTMLButtonElement {
  return screen.getByRole('button', { name })
}

/** Presses keys in order, e.g. press('1', '2', 'Add', '3', 'Equals'). */
export function press(...names: KeyName[]): void {
  for (const name of names) {
    fireEvent.click(key(name))
  }
}

/** The main value shown in the display. */
export function value(): string | null {
  return screen.getByLabelText('Value').textContent
}

/** The expression line, e.g. "12 +"; null while an error is shown instead. */
export function expression(): string | null {
  return screen.queryByLabelText('Expression')?.textContent ?? null
}

/** The error message shown to the user, or null. */
export function alert(): string | null {
  return screen.queryByRole('alert')?.textContent ?? null
}

export function isLoading(): boolean {
  return screen.queryByText('Calculating…') !== null
}

/** Whether a key is unavailable (it stays focusable, so this is aria-disabled). */
export function isDisabled(name: KeyName): boolean {
  return key(name).getAttribute('aria-disabled') === 'true'
}

/** Whether an operation key is shown as the selected one. */
export function isSelected(name: KeyName): boolean {
  return key(name).getAttribute('aria-pressed') === 'true'
}
