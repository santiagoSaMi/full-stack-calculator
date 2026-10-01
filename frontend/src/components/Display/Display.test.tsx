// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Display } from './Display.tsx'

afterEach(cleanup)

describe('Display', () => {
  it('shows the value and the expression', () => {
    render(<Display expression="12 +" value="3" />)

    expect(screen.getByLabelText('Value').textContent).toBe('3')
    expect(screen.getByLabelText('Expression').textContent).toBe('12 +')
  })

  it('announces value changes to assistive technology', () => {
    render(<Display expression="" value="42" />)

    expect(screen.getByLabelText('Value').getAttribute('aria-live')).toBe('polite')
  })

  it.each(['0', '-12.5', '0.333333333333333', '-1.23456789012345e+25'])('shows the value %s in full', (value) => {
    render(<Display expression="" value={value} />)

    expect(screen.getByLabelText('Value').textContent).toBe(value)
  })

  it('shows no error or loading indicator by default', () => {
    render(<Display expression="" value="0" />)

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Calculating…')).toBeNull()
  })

  it('shows an error as an alert, in place of the expression', () => {
    render(<Display expression="8 ÷" value="0" error="Cannot divide by zero." />)

    expect(screen.getByRole('alert').textContent).toBe('Cannot divide by zero.')
    expect(screen.queryByLabelText('Expression')).toBeNull()
    expect(screen.getByLabelText('Value').textContent).toBe('0')
  })

  it('shows a loading indicator while busy', () => {
    render(<Display expression="6 × 7 =" value="7" busy />)

    expect(screen.getByText('Calculating…')).toBeTruthy()
    expect(screen.getByLabelText('Expression').textContent).toBe('6 × 7 =')
  })
})
