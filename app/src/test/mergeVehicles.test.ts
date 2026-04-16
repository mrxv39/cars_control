import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing api
vi.mock('../lib/supabase', () => {
  const fromFn = vi.fn()
  return {
    supabase: {
      from: fromFn,
    },
  }
})

vi.mock('../lib/hash', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}))

import { mergeVehicles } from '../lib/api'
import { supabase } from '../lib/supabase'

const mockedSupabase = vi.mocked(supabase)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('mergeVehicles', () => {
  it('lanza error si fromId === intoId', async () => {
    await expect(mergeVehicles(5, 5)).rejects.toThrow(
      'No se puede fusionar un coche consigo mismo'
    )
    // No debería haber llamado a supabase
    expect(mockedSupabase.from).not.toHaveBeenCalled()
  })

  it('mueve fotos, docs, listings, videos, leads, sales, purchases y borra el origen', async () => {
    const calledUpdates: Array<{ table: string; vehicleId: number }> = []
    let deleteFromId: number | null = null

    mockedSupabase.from = vi.fn((table: string) => {
      const chain: any = {
        update: vi.fn(() => {
          return {
            eq: vi.fn((_col: string, val: number) => {
              calledUpdates.push({ table, vehicleId: val })
              return { error: null }
            }),
          }
        }),
        delete: vi.fn(() => ({
          eq: vi.fn((_col: string, val: number) => {
            deleteFromId = val
            return { error: null }
          }),
        })),
      }
      return chain
    }) as any

    await mergeVehicles(10, 20)

    // Las 4 tablas obligatorias deben actualizarse con fromId
    const requiredTables = [
      'vehicle_photos',
      'vehicle_documents',
      'vehicle_listings',
      'vehicle_videos',
    ]
    for (const t of requiredTables) {
      expect(calledUpdates.find((u) => u.table === t && u.vehicleId === 10)).toBeTruthy()
    }

    // Las 3 tablas opcionales (nullable) también
    const optionalTables = ['leads', 'sales_records', 'purchase_records']
    for (const t of optionalTables) {
      expect(calledUpdates.find((u) => u.table === t && u.vehicleId === 10)).toBeTruthy()
    }

    // Debe borrar el vehículo origen
    expect(deleteFromId).toBe(10)
  })

  it('lanza error si falla una tabla obligatoria y no borra el origen', async () => {
    let deleteCalled = false

    mockedSupabase.from = vi.fn((table: string) => {
      const chain: any = {
        update: vi.fn(() => ({
          eq: vi.fn(() => {
            if (table === 'vehicle_documents') {
              return { error: { message: 'FK violation' } }
            }
            return { error: null }
          }),
        })),
        delete: vi.fn(() => {
          deleteCalled = true
          return { eq: vi.fn(() => ({ error: null })) }
        }),
      }
      return chain
    }) as any

    await expect(mergeVehicles(10, 20)).rejects.toThrow('merge vehicle_documents: FK violation')
    expect(deleteCalled).toBe(false)
  })

  it('no lanza error si falla una tabla nullable (leads/sales/purchases)', async () => {
    let deleteFromId: number | null = null

    mockedSupabase.from = vi.fn((table: string) => {
      const chain: any = {
        update: vi.fn(() => ({
          eq: vi.fn(() => {
            // Las tablas nullable fallan silenciosamente
            if (table === 'leads') {
              return { error: { message: 'some error' } }
            }
            return { error: null }
          }),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn((_col: string, val: number) => {
            deleteFromId = val
            return { error: null }
          }),
        })),
      }
      return chain
    }) as any

    // No debería lanzar aunque leads falle
    await mergeVehicles(10, 20)
    expect(deleteFromId).toBe(10)
  })
})
