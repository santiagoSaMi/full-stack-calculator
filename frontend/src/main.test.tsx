// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * main.tsx is the entry point loaded by index.html. It runs on import, so
 * each test sets up the page and then imports a fresh copy of the module.
 */

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('application entry point', () => {
  it('mounts the calculator into the #root element', async () => {
    document.body.innerHTML = '<div id="root"></div>'

    await act(async () => {
      await import('./main.tsx')
    })

    const root = document.getElementById('root')!
    expect(root.contains(screen.getByRole('heading', { level: 1, name: 'Full-Stack Calculator' }))).toBe(true)
    expect(root.contains(screen.getByRole('region', { name: 'Calculator' }))).toBe(true)
  })

  it('fails with a clear error when the page has no #root element', async () => {
    document.body.innerHTML = '<div id="app"></div>'

    await expect(import('./main.tsx')).rejects.toThrow('Root element #root not found')
  })
})
