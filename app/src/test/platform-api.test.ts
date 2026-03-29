import { describe, it, expect, vi, beforeEach } from 'vitest'

function chainMock(overrides: Record<string, any> = {}) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => ({ data: null, error: null })),
    ...overrides,
  }
  return chain
}

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    rpc: vi.fn(),
  },
}))

// Mock hash
vi.mock('../lib/hash', () => ({
  hashPassword: vi.fn().mockResolvedValue('pbkdf2:600000:mocksalt:mockhash'),
}))

import {
  submitRegistration,
  signInWithGoogle,
  linkOAuthSession,
  createCompanyUser,
} from '../lib/platform-api'
import { supabase } from '../lib/supabase'
import { hashPassword } from '../lib/hash'

const mockedSupabase = vi.mocked(supabase)
const mockedHashPassword = vi.mocked(hashPassword)

beforeEach(() => {
  vi.clearAllMocks()
  mockedHashPassword.mockResolvedValue('pbkdf2:600000:mocksalt:mockhash')
})

describe('submitRegistration', () => {
  it('hashea password con PBKDF2 (no SHA-256)', async () => {
    const chain = chainMock({
      single: vi.fn(() => ({
        data: { id: 1, status: 'pending' },
        error: null,
      })),
    })

    mockedSupabase.from = vi.fn(() => chain) as any

    await submitRegistration({
      trade_name: 'Mi Empresa',
      legal_name: 'Mi Empresa SL',
      cif: 'B12345678',
      phone: '666111222',
      email: 'admin@test.com',
      admin_full_name: 'Admin',
      admin_username: 'admin',
      admin_password: 'securepass',
    })

    expect(mockedHashPassword).toHaveBeenCalledWith('securepass')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_password_hash: 'pbkdf2:600000:mocksalt:mockhash',
      })
    )
  })
})

describe('signInWithGoogle', () => {
  it('llama a supabase.auth.signInWithOAuth con provider google', async () => {
    mockedSupabase.auth.signInWithOAuth = vi.fn().mockResolvedValue({ error: null }) as any

    await signInWithGoogle()

    expect(mockedSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
      })
    )
  })
})

describe('linkOAuthSession', () => {
  it('detecta sesión y llama RPC link_oauth_user', async () => {
    mockedSupabase.auth.getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'google-uid-123',
            email: 'user@test.com',
            user_metadata: { full_name: 'Test User' },
          },
        },
      },
    }) as any

    mockedSupabase.rpc = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: 1,
          user_company_id: 10,
          user_full_name: 'Test User',
          user_username: 'testuser',
          user_role: 'admin',
          user_active: true,
          company_trade_name: 'Test Co',
          company_legal_name: 'Test Co SL',
          company_cif: 'B12345678',
          company_address: '',
          company_phone: '',
          company_email: 'user@test.com',
        },
      ],
      error: null,
    }) as any

    const result = await linkOAuthSession()

    expect(mockedSupabase.rpc).toHaveBeenCalledWith('link_oauth_user', {
      p_email: 'user@test.com',
      p_provider: 'google',
      p_provider_id: 'google-uid-123',
      p_full_name: 'Test User',
    })
    expect(result).not.toBeNull()
    expect(result!.user.full_name).toBe('Test User')
  })

  it('retorna null si no hay sesión', async () => {
    mockedSupabase.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: null },
    }) as any

    const result = await linkOAuthSession()
    expect(result).toBeNull()
  })
})

describe('createCompanyUser', () => {
  it('hashea password con PBKDF2', async () => {
    const chain = chainMock({
      single: vi.fn(() => ({
        data: {
          id: 5,
          company_id: 10,
          full_name: 'New User',
          username: 'newuser',
          role: 'user',
          active: true,
        },
        error: null,
      })),
    })

    mockedSupabase.from = vi.fn(() => chain) as any

    await createCompanyUser(10, 'New User', 'newuser', 'userpass', 'user')

    expect(mockedHashPassword).toHaveBeenCalledWith('userpass')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 10,
        password_hash: 'pbkdf2:600000:mocksalt:mockhash',
        role: 'user',
      })
    )
  })
})
