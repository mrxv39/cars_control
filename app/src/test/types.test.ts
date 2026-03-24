import { describe, it, expect } from 'vitest'
import type { StockVehicle, Lead, ViewKey } from '../types'

describe('Type contracts', () => {
  it('StockVehicle has required fields', () => {
    const vehicle: StockVehicle = {
      name: 'Seat Ibiza 2019',
      folder_path: '/stock/seat-ibiza',
      ad_info: null,
    }
    expect(vehicle.name).toBe('Seat Ibiza 2019')
    expect(vehicle.ad_info).toBeNull()
    expect(vehicle.precio_compra).toBeUndefined()
  })

  it('StockVehicle accepts optional pricing fields', () => {
    const vehicle: StockVehicle = {
      name: 'Ford Focus',
      folder_path: '/stock/ford-focus',
      ad_info: { url: 'https://example.com', status: 'active', date: '2026-01-01' },
      precio_compra: 5000,
      precio_venta: 7500,
      km: 120000,
      anio: 2018,
      estado: 'disponible',
    }
    expect(vehicle.precio_venta! - vehicle.precio_compra!).toBe(2500)
  })

  it('Lead has required fields', () => {
    const lead: Lead = {
      id: 1,
      name: 'Juan García',
      phone: '612345678',
      email: 'juan@example.com',
      notes: 'Interesado en SUV',
      vehicle_interest: 'SUV',
      vehicle_folder_path: null,
      converted_client_id: null,
    }
    expect(lead.id).toBe(1)
    expect(lead.converted_client_id).toBeNull()
  })

  it('ViewKey only allows valid views', () => {
    const validViews: ViewKey[] = [
      'dashboard', 'stock', 'leads', 'clients', 'sales',
      'legacy', 'reminders', 'sales_records', 'purchases', 'suppliers',
    ]
    expect(validViews).toHaveLength(10)
  })
})
