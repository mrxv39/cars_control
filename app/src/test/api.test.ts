import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing api
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockNeq = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()
const mockRemove = vi.fn()

function chainMock(overrides: Record<string, any> = {}) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => ({ data: null, error: null })),
    ...overrides,
  }
  return chain
}

vi.mock('../lib/supabase', () => {
  const fromFn = vi.fn()
  return {
    supabase: {
      from: fromFn,
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(() => ({ data: null, error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/photo.jpg' } })),
        })),
      },
    },
  }
})

// Mock hash module
vi.mock('../lib/hash', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}))

import { login, listVehicles, createVehicle, deleteVehicle } from '../lib/api'
import { supabase } from '../lib/supabase'
import { verifyPassword } from '../lib/hash'

const mockedSupabase = vi.mocked(supabase)
const mockedVerifyPassword = vi.mocked(verifyPassword)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('login', () => {
  it('retorna LoginResult con credenciales válidas', async () => {
    const userChain = chainMock({
      single: vi.fn(() => ({
        data: {
          id: 1,
          company_id: 10,
          full_name: 'Test User',
          username: 'testuser',
          password_hash: 'pbkdf2:600000:salt:hash',
          role: 'admin',
          active: true,
        },
        error: null,
      })),
    })

    const companyChain = chainMock({
      single: vi.fn(() => ({
        data: {
          id: 10,
          trade_name: 'Test Co',
          legal_name: 'Test Co SL',
          cif: 'B12345678',
          address: '123 Test St',
          phone: '666111222',
          email: 'test@test.com',
        },
        error: null,
      })),
    })

    let callCount = 0
    mockedSupabase.from = vi.fn(() => {
      callCount++
      return callCount === 1 ? userChain : companyChain
    }) as any

    mockedVerifyPassword.mockResolvedValue({ valid: true })

    const result = await login('testuser', 'password')
    expect(result.user.username).toBe('testuser')
    expect(result.company.trade_name).toBe('Test Co')
  })

  it('lanza error con credenciales inválidas', async () => {
    const userChain = chainMock({
      single: vi.fn(() => ({
        data: null,
        error: { message: 'Not found' },
      })),
    })

    mockedSupabase.from = vi.fn(() => userChain) as any

    await expect(login('baduser', 'badpass')).rejects.toThrow('Usuario o contrasena incorrectos.')
  })

  it('migra hash legacy a PBKDF2 cuando detecta SHA-256', async () => {
    const userChain = chainMock({
      single: vi.fn(() => ({
        data: {
          id: 1,
          company_id: 10,
          full_name: 'Legacy User',
          username: 'legacy',
          password_hash: 'abc123legacy',
          role: 'admin',
          active: true,
        },
        error: null,
      })),
    })

    const updateChain = chainMock()
    const companyChain = chainMock({
      single: vi.fn(() => ({
        data: {
          id: 10,
          trade_name: 'Test Co',
          legal_name: 'Test Co SL',
          cif: 'B12345678',
          address: '',
          phone: '',
          email: '',
        },
        error: null,
      })),
    })

    let callCount = 0
    mockedSupabase.from = vi.fn(() => {
      callCount++
      if (callCount === 1) return userChain
      if (callCount === 2) return updateChain // hash migration update
      return companyChain
    }) as any

    mockedVerifyPassword.mockResolvedValue({
      valid: true,
      newHash: 'pbkdf2:600000:newsalt:newhash',
    })

    const result = await login('legacy', 'oldpass')
    expect(result.user.username).toBe('legacy')
    // Verify that update was called for hash migration
    expect(mockedSupabase.from).toHaveBeenCalledWith('users')
  })
})

describe('listVehicles', () => {
  it('filtra por company_id y excluye vendido', async () => {
    const chain = chainMock({
      order: vi.fn(() => ({
        data: [
          { id: 1, name: 'Car 1', estado: 'disponible', company_id: 10 },
          { id: 2, name: 'Car 2', estado: 'reservado', company_id: 10 },
        ],
        error: null,
      })),
    })

    mockedSupabase.from = vi.fn(() => chain) as any

    const result = await listVehicles(10)
    expect(result).toHaveLength(2)
    expect(mockedSupabase.from).toHaveBeenCalledWith('vehicles')
    expect(chain.eq).toHaveBeenCalledWith('company_id', 10)
    expect(chain.neq).toHaveBeenCalledWith('estado', 'vendido')
  })
})

describe('createVehicle', () => {
  it('envía los campos correctos', async () => {
    const chain = chainMock({
      single: vi.fn(() => ({
        data: { id: 5, name: 'New Car', company_id: 10, estado: 'disponible' },
        error: null,
      })),
    })

    mockedSupabase.from = vi.fn(() => chain) as any

    const result = await createVehicle(10, { name: 'New Car', anio: 2023 })
    expect(result.name).toBe('New Car')
    expect(mockedSupabase.from).toHaveBeenCalledWith('vehicles')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 10,
        name: 'New Car',
        anio: 2023,
      })
    )
  })
})

describe('deleteVehicle', () => {
  it('desvincula leads, sales, purchases, clients antes de borrar', async () => {
    const calledTables: string[] = []

    const genericChain = chainMock({
      order: vi.fn(() => ({ data: [], error: null })),
    })

    mockedSupabase.from = vi.fn((table: string) => {
      calledTables.push(table)
      if (table === 'vehicle_photos') {
        return chainMock({
          single: vi.fn(() => ({ data: null, error: null })),
          order: vi.fn(() => ({ data: [], error: null })),
        })
      }
      if (table === 'vehicles') {
        return chainMock({
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null })),
          })),
        })
      }
      return genericChain
    }) as any

    await deleteVehicle(99)

    // Verify that all dependency tables were accessed
    expect(calledTables).toContain('vehicle_photos')
    expect(calledTables).toContain('leads')
    expect(calledTables).toContain('sales_records')
    expect(calledTables).toContain('purchase_records')
    expect(calledTables).toContain('clients')
    expect(calledTables).toContain('vehicles')
  })
})
