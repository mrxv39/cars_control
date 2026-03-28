import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, legacySha256Hash } from '../lib/hash'

describe('hashPassword', () => {
  it('genera formato pbkdf2:600000:<salt>:<hash>', async () => {
    const hash = await hashPassword('testpassword')
    const parts = hash.split(':')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('pbkdf2')
    expect(parts[1]).toBe('600000')
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/) // 16 bytes = 32 hex chars
    expect(parts[3]).toMatch(/^[0-9a-f]{64}$/) // 32 bytes = 64 hex chars
  })

  it('genera hashes diferentes para el mismo password (salt aleatorio)', async () => {
    const hash1 = await hashPassword('samepassword')
    const hash2 = await hashPassword('samepassword')
    expect(hash1).not.toBe(hash2)
  })
})

describe('verifyPassword', () => {
  it('valida un hash PBKDF2 correctamente', async () => {
    const hash = await hashPassword('mypassword')
    const result = await verifyPassword('mypassword', hash)
    expect(result.valid).toBe(true)
    expect(result.newHash).toBeUndefined()
  })

  it('rechaza un password incorrecto contra PBKDF2', async () => {
    const hash = await hashPassword('correct')
    const result = await verifyPassword('wrong', hash)
    expect(result.valid).toBe(false)
  })

  it('valida un hash SHA-256 legacy', async () => {
    const legacyHash = await legacySha256Hash('legacypass')
    const result = await verifyPassword('legacypass', legacyHash)
    expect(result.valid).toBe(true)
  })

  it('devuelve newHash para migración cuando verifica SHA-256 legacy', async () => {
    const legacyHash = await legacySha256Hash('legacypass')
    const result = await verifyPassword('legacypass', legacyHash)
    expect(result.valid).toBe(true)
    expect(result.newHash).toBeDefined()
    expect(result.newHash).toMatch(/^pbkdf2:600000:/)
  })

  it('rechaza un password incorrecto contra SHA-256 legacy', async () => {
    const legacyHash = await legacySha256Hash('correct')
    const result = await verifyPassword('wrong', legacyHash)
    expect(result.valid).toBe(false)
  })
})

describe('legacySha256Hash', () => {
  it('genera el mismo hash para el mismo input (determinista)', async () => {
    const hash1 = await legacySha256Hash('test')
    const hash2 = await legacySha256Hash('test')
    expect(hash1).toBe(hash2)
  })

  it('genera un hash hex de 64 caracteres', async () => {
    const hash = await legacySha256Hash('anypassword')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
