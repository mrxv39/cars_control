import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing api
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
      rpc: vi.fn(),
      auth: {
        signInWithPassword: vi.fn(),
      },
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

const mockedSupabase = vi.mocked(supabase)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('login', () => {
  it('retorna LoginResult con credenciales válidas (Supabase Auth)', async () => {
    // Mock resolve_login RPC
    ;(mockedSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { email: 'test@test.com' },
      error: null,
    })

    // Mock signInWithPassword
    ;(mockedSupabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    })

    const userChain = chainMock({
      single: vi.fn(() => ({
        data: {
          id: 1,
          company_id: 10,
          full_name: 'Test User',
          username: 'testuser',
          email: 'test@test.com',
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

    const result = await login('testuser', 'password')
    expect(result.user.username).toBe('testuser')
    expect(result.company.trade_name).toBe('Test Co')
    expect(mockedSupabase.rpc).toHaveBeenCalledWith('resolve_login', { p_username: 'testuser' })
    expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password' })
  })

  it('lanza error con credenciales inválidas', async () => {
    // Mock resolve_login returns email
    ;(mockedSupabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { email: 'bad@test.com' },
      error: null,
    })

    // Mock signInWithPassword fails
    ;(mockedSupabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    await expect(login('baduser', 'badpass')).rejects.toThrow('Usuario o contraseña incorrectos.')
  })

  it('acepta email directamente sin llamar a resolve_login', async () => {
    // Mock signInWithPassword
    ;(mockedSupabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    })

    const userChain = chainMock({
      single: vi.fn(() => ({
        data: {
          id: 1,
          company_id: 10,
          full_name: 'Email User',
          username: 'emailuser',
          email: 'user@example.com',
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
      return callCount === 1 ? userChain : companyChain
    }) as any

    const result = await login('user@example.com', 'pass')
    expect(result.user.username).toBe('emailuser')
    // Should NOT call resolve_login when input is already an email
    expect(mockedSupabase.rpc).not.toHaveBeenCalled()
    expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'pass' })
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
