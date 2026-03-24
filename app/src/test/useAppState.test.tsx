import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAppState } from '../hooks/useAppState'
import { invoke } from '@tauri-apps/api/core'

const mockInvoke = vi.mocked(invoke)

describe('useAppState', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('starts in loading state', () => {
    mockInvoke.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useAppState())
    expect(result.current.loading).toBe(true)
    expect(result.current.appState).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('loads app state successfully', async () => {
    const mockState = {
      stock_folder: '/stock',
      stock: [],
      leads: [],
      clients: [],
      sales_root: null,
      sales_history: [],
      sales_message: null,
      fiscal_root: null,
      fiscal_entries: [],
      fiscal_message: null,
      gastos_root: null,
      gastos_entries: [],
      gastos_message: null,
    }
    mockInvoke.mockResolvedValue(mockState)

    const { result } = renderHook(() => useAppState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.appState).toEqual(mockState)
    expect(result.current.error).toBeNull()
    expect(mockInvoke).toHaveBeenCalledWith('load_app_state')
  })

  it('handles error on load', async () => {
    mockInvoke.mockRejectedValue(new Error('DB connection failed'))

    const { result } = renderHook(() => useAppState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.appState).toBeNull()
    expect(result.current.error).toContain('DB connection failed')
  })

  it('exposes loadState for manual reload', async () => {
    mockInvoke.mockResolvedValue({ stock_folder: '/stock', stock: [], leads: [], clients: [], sales_root: null, sales_history: [], sales_message: null, fiscal_root: null, fiscal_entries: [], fiscal_message: null, gastos_root: null, gastos_entries: [], gastos_message: null })

    const { result } = renderHook(() => useAppState())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Call loadState again
    mockInvoke.mockResolvedValue({ stock_folder: '/stock2', stock: [{ name: 'New', folder_path: '/new', ad_info: null }], leads: [], clients: [], sales_root: null, sales_history: [], sales_message: null, fiscal_root: null, fiscal_entries: [], fiscal_message: null, gastos_root: null, gastos_entries: [], gastos_message: null })

    await act(async () => {
      await result.current.loadState()
    })

    expect(result.current.appState?.stock_folder).toBe('/stock2')
    expect(mockInvoke).toHaveBeenCalledTimes(2)
  })
})
