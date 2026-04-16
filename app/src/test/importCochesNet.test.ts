import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing api
vi.mock('../lib/supabase', () => {
  const fromFn = vi.fn()
  return {
    supabase: {
      from: fromFn,
      functions: { invoke: vi.fn() },
    },
  }
})

vi.mock('../lib/hash', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}))

import { importCochesNetVehicles, ImportPreview } from '../lib/api'
import { supabase } from '../lib/supabase'

const mockedSupabase = vi.mocked(supabase)

function makeDetail(
  overrides: Partial<ImportPreview['newDetails'][0]> = {}
): ImportPreview['newDetails'][0] {
  return {
    externalId: 'ext-123',
    url: 'https://coches.net/listing/123',
    name: 'SEAT Leon',
    make: 'SEAT',
    model: 'Leon',
    version: '1.5 TSI FR',
    year: 2022,
    km: 35000,
    price: 22000,
    fuelType: 'Gasolina',
    hp: 150,
    color: 'Blanco',
    transmission: 'Manual',
    doors: 5,
    seats: 5,
    bodyType: 'Compacto',
    displacement: 1498,
    emissionsCo2: '120 g/km',
    environmentalLabel: 'C',
    warranty: '1 año',
    description: 'Coche en perfecto estado',
    equipment: ['Navegador', 'Cámara trasera'],
    photoUrls: ['https://img.coches.net/photo1.jpg', 'https://img.coches.net/photo2.jpg'],
    videoUrls: [],
    city: 'Barcelona',
    province: 'Barcelona',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('importCochesNetVehicles', () => {
  it('crea vehículo con fullName = make + model + version', async () => {
    let insertedVehicle: any = null

    mockedSupabase.from = vi.fn((table: string) => {
      if (table === 'vehicles') {
        return {
          insert: vi.fn((data: any) => {
            insertedVehicle = data
            return {
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { id: 1 },
                  error: null,
                })),
              })),
            }
          }),
        } as any
      }
      // vehicle_listings, vehicle_photos
      return {
        insert: vi.fn(() => ({ error: null })),
      } as any
    }) as any

    const detail = makeDetail()
    const result = await importCochesNetVehicles(1, [detail])

    expect(result.created).toBe(1)
    expect(insertedVehicle.name).toBe('SEAT Leon 1.5 TSI FR')
    expect(insertedVehicle.company_id).toBe(1)
    expect(insertedVehicle.estado).toBe('disponible')
    expect(insertedVehicle.km).toBe(35000)
  })

  it('salta detalles sin externalId', async () => {
    mockedSupabase.from = vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: { id: 1 }, error: null })),
        })),
      })),
    })) as any

    const detail = makeDetail({ externalId: null })
    const result = await importCochesNetVehicles(1, [detail])
    expect(result.created).toBe(0)
  })

  it('continua si falla la inserción de un vehículo pero cuenta los exitosos', async () => {
    let callCount = 0

    mockedSupabase.from = vi.fn((table: string) => {
      if (table === 'vehicles') {
        callCount++
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => {
                if (callCount === 1) {
                  return { data: null, error: { message: 'duplicate' } }
                }
                return { data: { id: 2 }, error: null }
              }),
            })),
          })),
        } as any
      }
      return {
        insert: vi.fn(() => ({ error: null })),
      } as any
    }) as any

    const details = [
      makeDetail({ externalId: 'ext-1', name: 'Car 1' }),
      makeDetail({ externalId: 'ext-2', name: 'Car 2' }),
    ]
    const result = await importCochesNetVehicles(1, details)
    expect(result.created).toBe(1)
  })

  it('inserta videos con provider youtube cuando URL contiene "youtu"', async () => {
    let insertedVideos: any[] = []

    mockedSupabase.from = vi.fn((table: string) => {
      if (table === 'vehicles') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ data: { id: 1 }, error: null })),
            })),
          })),
        } as any
      }
      if (table === 'vehicle_videos') {
        return {
          insert: vi.fn((data: any) => {
            insertedVideos = data
            return { error: null }
          }),
        } as any
      }
      return {
        insert: vi.fn(() => ({ error: null })),
      } as any
    }) as any

    const detail = makeDetail({
      videoUrls: [
        'https://www.youtube.com/watch?v=abc',
        'https://cdn.coches.net/video.mp4',
      ],
    })
    await importCochesNetVehicles(1, [detail])

    expect(insertedVideos).toHaveLength(2)
    expect(insertedVideos[0].provider).toBe('youtube')
    expect(insertedVideos[1].provider).toBe('mp4')
  })

  it('inserta fotos con file_name extraído de la URL', async () => {
    let insertedPhotos: any[] = []

    mockedSupabase.from = vi.fn((table: string) => {
      if (table === 'vehicles') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ data: { id: 1 }, error: null })),
            })),
          })),
        } as any
      }
      if (table === 'vehicle_photos') {
        return {
          insert: vi.fn((data: any) => {
            insertedPhotos = data
            return { error: null }
          }),
        } as any
      }
      return {
        insert: vi.fn(() => ({ error: null })),
      } as any
    }) as any

    const detail = makeDetail({
      photoUrls: ['https://img.coches.net/photos/abc123.jpg'],
      videoUrls: [],
    })
    await importCochesNetVehicles(1, [detail])

    expect(insertedPhotos).toHaveLength(1)
    expect(insertedPhotos[0].file_name).toBe('abc123.jpg')
    expect(insertedPhotos[0].source_url).toBe('https://img.coches.net/photos/abc123.jpg')
    expect(insertedPhotos[0].storage_path).toBe('')
  })

  it('construye fullName sin version si es null', async () => {
    let insertedVehicle: any = null

    mockedSupabase.from = vi.fn((table: string) => {
      if (table === 'vehicles') {
        return {
          insert: vi.fn((data: any) => {
            insertedVehicle = data
            return {
              select: vi.fn(() => ({
                single: vi.fn(() => ({ data: { id: 1 }, error: null })),
              })),
            }
          }),
        } as any
      }
      return {
        insert: vi.fn(() => ({ error: null })),
      } as any
    }) as any

    const detail = makeDetail({ version: null })
    await importCochesNetVehicles(1, [detail])
    expect(insertedVehicle.name).toBe('SEAT Leon')
  })
})
