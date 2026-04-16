import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from '../hooks/usePagination'

const items = Array.from({ length: 120 }, (_, i) => i)

describe('usePagination', () => {
  it('returns first page by default', () => {
    const { result } = renderHook(() => usePagination(items, 50))
    expect(result.current.page).toBe(0)
    expect(result.current.paged).toHaveLength(50)
    expect(result.current.paged[0]).toBe(0)
    expect(result.current.totalPages).toBe(3)
  })

  it('navigates to next page', () => {
    const { result } = renderHook(() => usePagination(items, 50))
    act(() => result.current.setPage(1))
    expect(result.current.page).toBe(1)
    expect(result.current.paged[0]).toBe(50)
    expect(result.current.paged).toHaveLength(50)
  })

  it('handles last page with fewer items', () => {
    const { result } = renderHook(() => usePagination(items, 50))
    act(() => result.current.setPage(2))
    expect(result.current.paged).toHaveLength(20)
    expect(result.current.paged[0]).toBe(100)
  })

  it('resets to page 0 when items length changes', () => {
    let data = items
    const { result, rerender } = renderHook(() => usePagination(data, 50))
    act(() => result.current.setPage(2))
    expect(result.current.page).toBe(2)

    data = items.slice(0, 30)
    rerender()
    expect(result.current.page).toBe(0)
  })

  it('uses default pageSize of 50', () => {
    const { result } = renderHook(() => usePagination(items))
    expect(result.current.paged).toHaveLength(50)
    expect(result.current.totalPages).toBe(3)
  })

  it('handles empty array', () => {
    const { result } = renderHook(() => usePagination([], 50))
    expect(result.current.paged).toHaveLength(0)
    expect(result.current.totalPages).toBe(0)
  })
})
