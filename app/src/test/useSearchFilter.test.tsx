import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearchFilter } from '../hooks/useSearchFilter'
import type { StockVehicle } from '../types'

const stock: StockVehicle[] = [
  { name: 'Seat Ibiza', folder_path: '/seat', ad_info: null },
  { name: 'Ford Focus', folder_path: '/ford', ad_info: null },
]

interface TestItem {
  name: string
  vehiclePath: string | null
}

const items: TestItem[] = [
  { name: 'Juan García', vehiclePath: '/seat' },
  { name: 'María López', vehiclePath: '/ford' },
  { name: 'Pedro Ruiz', vehiclePath: null },
]

const getFields = (item: TestItem, vehicleNames: Map<string, string>) => [
  item.name,
  item.vehiclePath ? vehicleNames.get(item.vehiclePath) ?? '' : '',
]

describe('useSearchFilter', () => {
  it('returns all items when search is empty', () => {
    const { result } = renderHook(() => useSearchFilter(items, stock, getFields))
    expect(result.current.filtered).toHaveLength(3)
    expect(result.current.search).toBe('')
  })

  it('filters by name', () => {
    const { result } = renderHook(() => useSearchFilter(items, stock, getFields))

    act(() => {
      result.current.setSearch('juan')
    })

    expect(result.current.filtered).toHaveLength(1)
    expect(result.current.filtered[0].name).toBe('Juan García')
  })

  it('filters by linked vehicle name', () => {
    const { result } = renderHook(() => useSearchFilter(items, stock, getFields))

    act(() => {
      result.current.setSearch('seat')
    })

    expect(result.current.filtered).toHaveLength(1)
    expect(result.current.filtered[0].name).toBe('Juan García')
  })

  it('is accent-insensitive', () => {
    const { result } = renderHook(() => useSearchFilter(items, stock, getFields))

    act(() => {
      result.current.setSearch('garcia')
    })

    expect(result.current.filtered).toHaveLength(1)
    expect(result.current.filtered[0].name).toBe('Juan García')
  })

  it('returns empty for no matches', () => {
    const { result } = renderHook(() => useSearchFilter(items, stock, getFields))

    act(() => {
      result.current.setSearch('tesla')
    })

    expect(result.current.filtered).toHaveLength(0)
  })
})
