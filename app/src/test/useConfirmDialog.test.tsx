import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConfirmDialog } from '../hooks/useConfirmDialog'

describe('useConfirmDialog', () => {
  it('starts with dialog closed', () => {
    const { result } = renderHook(() => useConfirmDialog())
    expect(result.current.confirmProps.open).toBe(false)
    expect(result.current.confirmProps.title).toBe('')
    expect(result.current.confirmProps.message).toBe('')
  })

  it('opens dialog with title and message via requestConfirm', () => {
    const { result } = renderHook(() => useConfirmDialog())
    const onConfirm = () => {}
    act(() => {
      result.current.requestConfirm('Eliminar', '¿Seguro?', onConfirm)
    })
    expect(result.current.confirmProps.open).toBe(true)
    expect(result.current.confirmProps.title).toBe('Eliminar')
    expect(result.current.confirmProps.message).toBe('¿Seguro?')
  })

  it('closes dialog on cancel', () => {
    const { result } = renderHook(() => useConfirmDialog())
    act(() => {
      result.current.requestConfirm('T', 'M', () => {})
    })
    expect(result.current.confirmProps.open).toBe(true)
    act(() => {
      result.current.confirmProps.onCancel()
    })
    expect(result.current.confirmProps.open).toBe(false)
  })

  it('calls onConfirm callback and closes dialog on confirm', () => {
    let called = false
    const { result } = renderHook(() => useConfirmDialog())
    act(() => {
      result.current.requestConfirm('T', 'M', () => { called = true })
    })
    act(() => {
      result.current.confirmProps.onConfirm()
    })
    expect(called).toBe(true)
    expect(result.current.confirmProps.open).toBe(false)
  })

  it('uses latest onConfirm callback (ref-stable)', () => {
    const calls: string[] = []
    const { result } = renderHook(() => useConfirmDialog())
    act(() => {
      result.current.requestConfirm('T', 'M', () => { calls.push('first') })
    })
    // Update the callback by requesting again
    act(() => {
      result.current.requestConfirm('T2', 'M2', () => { calls.push('second') })
    })
    act(() => {
      result.current.confirmProps.onConfirm()
    })
    expect(calls).toEqual(['second'])
  })
})
