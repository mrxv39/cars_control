import { describe, it, expect } from 'vitest'
import {
  EMPTY_LEAD_FORM,
  EMPTY_CLIENT_FORM,
  EMPTY_STOCK_VEHICLE_FORM,
  EMPTY_AD_FORM,
} from '../shared-types'
import type {
  LeadForm,
  ClientForm,
  VehicleBase,
  LeadBase,
  ClientBase,
} from '../shared-types'

describe('EMPTY_LEAD_FORM', () => {
  it('tiene todos los campos inicializados', () => {
    const keys: (keyof LeadForm)[] = [
      'name', 'phone', 'email', 'notes',
      'vehicle_interest', 'estado', 'fecha_contacto', 'canal',
    ]
    for (const key of keys) {
      expect(EMPTY_LEAD_FORM).toHaveProperty(key)
      expect(EMPTY_LEAD_FORM[key]).toBeDefined()
    }
  })

  it('tiene estado "nuevo" por defecto', () => {
    expect(EMPTY_LEAD_FORM.estado).toBe('nuevo')
  })
})

describe('EMPTY_CLIENT_FORM', () => {
  it('tiene todos los campos inicializados', () => {
    const keys: (keyof ClientForm)[] = ['name', 'phone', 'email', 'dni', 'notes']
    for (const key of keys) {
      expect(EMPTY_CLIENT_FORM).toHaveProperty(key)
      expect(EMPTY_CLIENT_FORM[key]).toBeDefined()
    }
  })

  it('todos los campos son strings vacíos', () => {
    for (const value of Object.values(EMPTY_CLIENT_FORM)) {
      expect(value).toBe('')
    }
  })
})

describe('EMPTY_STOCK_VEHICLE_FORM', () => {
  it('tiene estado "disponible" por defecto', () => {
    expect(EMPTY_STOCK_VEHICLE_FORM.estado).toBe('disponible')
  })

  it('tiene campos numéricos inicializados a null', () => {
    expect(EMPTY_STOCK_VEHICLE_FORM.precio_compra).toBeNull()
    expect(EMPTY_STOCK_VEHICLE_FORM.precio_venta).toBeNull()
    expect(EMPTY_STOCK_VEHICLE_FORM.km).toBeNull()
    expect(EMPTY_STOCK_VEHICLE_FORM.anio).toBeNull()
  })
})

describe('EMPTY_AD_FORM', () => {
  it('tiene todos los campos como strings vacíos', () => {
    expect(EMPTY_AD_FORM.url).toBe('')
    expect(EMPTY_AD_FORM.status).toBe('')
    expect(EMPTY_AD_FORM.date).toBe('')
  })
})

describe('Compatibilidad de tipos base', () => {
  it('VehicleBase es compatible con StockVehicleForm', () => {
    const vehicle: VehicleBase = {
      name: 'Test Car',
      precio_compra: 10000,
      precio_venta: 15000,
      km: 50000,
      anio: 2020,
      estado: 'disponible',
    }
    expect(vehicle.name).toBe('Test Car')
    expect(vehicle.estado).toBe('disponible')
  })

  it('LeadBase tiene campos compatibles con LeadForm', () => {
    const lead: LeadBase = {
      id: 1,
      name: 'Test Lead',
      phone: '123456',
      email: 'test@test.com',
      notes: 'note',
      vehicle_interest: 'SUV',
      converted_client_id: null,
      estado: 'nuevo',
      fecha_contacto: null,
      canal: 'web',
    }
    expect(lead.name).toBe('Test Lead')
    expect(lead.converted_client_id).toBeNull()
  })

  it('ClientBase tiene campos compatibles con ClientForm', () => {
    const client: ClientBase = {
      id: 1,
      name: 'Test Client',
      phone: '123456',
      email: 'test@test.com',
      dni: '12345678A',
      notes: 'note',
      source_lead_id: null,
    }
    expect(client.name).toBe('Test Client')
    expect(client.source_lead_id).toBeNull()
  })
})
