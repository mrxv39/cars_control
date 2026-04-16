import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEscapeKey } from '../hooks/useEscapeKey'

describe('useEscapeKey', () => {
  it('calls callback when Escape is pressed and active is true', () => {
    const cb = vi.fn()
    renderHook(() => useEscapeKey(true, cb))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cb).toHaveBeenCalledOnce()
  })

  it('does not call callback when active is false', () => {
    const cb = vi.fn()
    renderHook(() => useEscapeKey(false, cb))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('does not call callback for non-Escape keys', () => {
    const cb = vi.fn()
    renderHook(() => useEscapeKey(true, cb))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('cleans up listener on unmount', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useEscapeKey(true, cb))
    unmount()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('re-registers when active changes from false to true', () => {
    const cb = vi.fn()
    let active = false
    const { rerender } = renderHook(() => useEscapeKey(active, cb))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cb).not.toHaveBeenCalled()

    active = true
    rerender()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cb).toHaveBeenCalledOnce()
  })
})
