import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRecords } from '../hooks/useRecords'
import { invoke } from '@tauri-apps/api/core'

const mockInvoke = vi.mocked(invoke)

describe('useRecords', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('loads records on mount', async () => {
    const mockData = [{ id: 1, name: 'Test' }]
    mockInvoke.mockResolvedValue(mockData)

    const { result } = renderHook(() => useRecords<{ id: number; name: string }>('get_test_records'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.records).toEqual(mockData)
    expect(mockInvoke).toHaveBeenCalledWith('get_test_records')
  })

  it('handles errors gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('DB error'))

    const { result } = renderHook(() => useRecords('get_test_records'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.records).toEqual([])
  })

  it('provides reload function', async () => {
    mockInvoke.mockResolvedValue([{ id: 1 }])

    const { result } = renderHook(() => useRecords('get_test_records'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockInvoke.mockResolvedValue([{ id: 1 }, { id: 2 }])

    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.records).toHaveLength(2)
    expect(mockInvoke).toHaveBeenCalledTimes(2)
  })

  it('provides setRecords for optimistic updates', async () => {
    mockInvoke.mockResolvedValue([{ id: 1 }])

    const { result } = renderHook(() => useRecords<{ id: number }>('get_test_records'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setRecords([{ id: 1 }, { id: 2 }])
    })

    expect(result.current.records).toHaveLength(2)
  })
})
