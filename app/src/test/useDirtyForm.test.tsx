import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDirtyForm } from '../hooks/useDirtyForm'

describe('useDirtyForm', () => {
  it('starts clean (not dirty)', () => {
    const { result } = renderHook(() => useDirtyForm())
    expect(result.current.isDirty()).toBe(false)
  })

  it('becomes dirty after markDirty()', () => {
    const { result } = renderHook(() => useDirtyForm())
    act(() => { result.current.markDirty() })
    expect(result.current.isDirty()).toBe(true)
  })

  it('resets to clean after reset()', () => {
    const { result } = renderHook(() => useDirtyForm())
    act(() => { result.current.markDirty() })
    act(() => { result.current.reset() })
    expect(result.current.isDirty()).toBe(false)
  })

  it('guardClose calls onClose immediately when form is clean', () => {
    const { result } = renderHook(() => useDirtyForm())
    const onClose = vi.fn()
    act(() => { result.current.guardClose(onClose) })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('guardClose shows confirm when form is dirty', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = renderHook(() => useDirtyForm())
    const onClose = vi.fn()
    act(() => { result.current.markDirty() })
    act(() => { result.current.guardClose(onClose) })
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('guardClose calls onClose and resets if user confirms', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { result } = renderHook(() => useDirtyForm())
    const onClose = vi.fn()
    act(() => { result.current.markDirty() })
    act(() => { result.current.guardClose(onClose) })
    expect(onClose).toHaveBeenCalledOnce()
    expect(result.current.isDirty()).toBe(false)
    confirmSpy.mockRestore()
  })
})
