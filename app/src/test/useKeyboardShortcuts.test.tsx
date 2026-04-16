import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

function fireKey(key: string, target?: Partial<HTMLElement>) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true })
  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }
  document.dispatchEvent(event)
}

describe('useKeyboardShortcuts', () => {
  it('calls handler when matching key is pressed', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    fireKey('/')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('ignores keys not in the map', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    fireKey('a')
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores keystrokes when INPUT is focused', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    fireKey('/', { tagName: 'INPUT' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores keystrokes when TEXTAREA is focused', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    fireKey('/', { tagName: 'TEXTAREA' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores keystrokes when SELECT is focused', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ '/': handler }))
    fireKey('/', { tagName: 'SELECT' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('is case-insensitive on key matching', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcuts({ 'a': handler }))
    fireKey('A')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('cleans up listener on unmount', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcuts({ '/': handler }))
    unmount()
    fireKey('/')
    expect(handler).not.toHaveBeenCalled()
  })
})
