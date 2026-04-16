import { describe, it, expect } from 'vitest'
import { generateSuggestions, getViewContext } from '../lib/feedbackSuggestions'
import type { FBVehicle, FBLead } from '../lib/feedbackSuggestions'

const emptyDismissed = new Set<string>()

function makeVehicle(overrides: Partial<FBVehicle> = {}): FBVehicle {
  return { name: 'SEAT Ibiza', estado: 'disponible', precio_compra: 8000, precio_venta: 10000, km: 120000, anio: 2019, ad_url: 'https://coches.net/x', ...overrides }
}

function makeLead(overrides: Partial<FBLead> = {}): FBLead {
  return { id: 1, name: 'Juan', estado: 'nuevo', fecha_contacto: null, canal: 'coches.net', converted_client_id: null, ...overrides }
}

describe('getViewContext', () => {
  it('returns vehicle_detail for vehiculo: prefix', () => {
    expect(getViewContext('vehiculo:123')).toBe('vehicle_detail')
  })
  it('returns the view name for other views', () => {
    expect(getViewContext('stock')).toBe('stock')
    expect(getViewContext('leads')).toBe('leads')
  })
})

describe('generateSuggestions — vehicle_detail', () => {
  it('returns empty when vehicle has all data', () => {
    const tips = generateSuggestions('vehicle_detail', [], [], [], makeVehicle(), emptyDismissed)
    // Should have the "margen ok" tip but no warnings
    const ids = tips.map(t => t.id)
    expect(ids).not.toContain('vehicle_sin_precio_compra')
    expect(ids).not.toContain('vehicle_sin_precio_venta')
  })

  it('flags missing precio_compra', () => {
    const tips = generateSuggestions('vehicle_detail', [], [], [], makeVehicle({ precio_compra: null }), emptyDismissed)
    expect(tips.find(t => t.id === 'vehicle_sin_precio_compra')).toBeDefined()
  })

  it('flags missing precio_venta', () => {
    const tips = generateSuggestions('vehicle_detail', [], [], [], makeVehicle({ precio_venta: null }), emptyDismissed)
    expect(tips.find(t => t.id === 'vehicle_sin_precio_venta')).toBeDefined()
  })

  it('flags low margin (<500)', () => {
    const tips = generateSuggestions('vehicle_detail', [], [], [], makeVehicle({ precio_compra: 10000, precio_venta: 10200 }), emptyDismissed)
    const tip = tips.find(t => t.id === 'vehicle_margen_bajo')
    expect(tip).toBeDefined()
    expect(tip!.impact).toBe('alto')
  })

  it('shows positive margin info', () => {
    const tips = generateSuggestions('vehicle_detail', [], [], [], makeVehicle({ precio_compra: 8000, precio_venta: 10000 }), emptyDismissed)
    expect(tips.find(t => t.id === 'vehicle_margen_ok')).toBeDefined()
  })

  it('flags reserved vehicle', () => {
    const tips = generateSuggestions('vehicle_detail', [], [], [], makeVehicle({ estado: 'reservado' }), emptyDismissed)
    expect(tips.find(t => t.id === 'vehicle_reservado_cerrar')).toBeDefined()
  })

  it('respects dismissed set', () => {
    const dismissed = new Set(['vehicle_sin_precio_compra'])
    const tips = generateSuggestions('vehicle_detail', [], [], [], makeVehicle({ precio_compra: null }), dismissed)
    expect(tips.find(t => t.id === 'vehicle_sin_precio_compra')).toBeUndefined()
  })
})

describe('generateSuggestions — stock', () => {
  it('flags vehicles without complete prices', () => {
    const stock = [makeVehicle({ precio_compra: null }), makeVehicle({ name: 'BMW', precio_venta: null })]
    const tips = generateSuggestions('stock', stock, [], [], null, emptyDismissed)
    expect(tips.find(t => t.id === 'stock_sin_precios')).toBeDefined()
  })

  it('flags reserved vehicles', () => {
    const stock = [makeVehicle({ estado: 'reservado' })]
    const tips = generateSuggestions('stock', stock, [], [], null, emptyDismissed)
    expect(tips.find(t => t.id === 'stock_reservados')).toBeDefined()
  })

  it('returns empty for fully complete stock', () => {
    const stock = [makeVehicle()]
    const tips = generateSuggestions('stock', stock, [], [], null, emptyDismissed)
    expect(tips.length).toBe(0)
  })
})

describe('generateSuggestions — leads', () => {
  it('flags leads without first contact', () => {
    const leads = [makeLead({ estado: 'nuevo', fecha_contacto: null })]
    const tips = generateSuggestions('leads', [], leads, [], null, emptyDismissed)
    expect(tips.find(t => t.id === 'leads_sin_contacto')).toBeDefined()
  })

  it('flags leads without follow-up (>7 days)', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const leads = [makeLead({ estado: 'contactado', fecha_contacto: old })]
    const tips = generateSuggestions('leads', [], leads, [], null, emptyDismissed)
    expect(tips.find(t => t.id === 'leads_sin_seguimiento')).toBeDefined()
  })

  it('suggests coches.net import when no leads from that channel', () => {
    const leads = [makeLead({ canal: 'wallapop' })]
    const tips = generateSuggestions('leads', [], leads, [], null, emptyDismissed)
    expect(tips.find(t => t.id === 'leads_coches_net')).toBeDefined()
  })
})

describe('generateSuggestions — dashboard', () => {
  it('shows new leads waiting for response', () => {
    const leads = [makeLead({ estado: 'nuevo', fecha_contacto: null })]
    const tips = generateSuggestions('dashboard', [], leads, [], null, emptyDismissed)
    expect(tips.find(t => t.id === 'dash_leads_nuevos')).toBeDefined()
  })

  it('shows reserved vehicles', () => {
    const stock = [makeVehicle({ estado: 'reservado' })]
    const tips = generateSuggestions('dashboard', stock, [], [], null, emptyDismissed)
    expect(tips.find(t => t.id === 'dash_reservados')).toBeDefined()
  })
})

describe('generateSuggestions — purchases', () => {
  it('always shows tip about registering expenses', () => {
    const tips = generateSuggestions('purchases', [], [], [], null, emptyDismissed)
    expect(tips.find(t => t.id === 'purchases_tip')).toBeDefined()
  })
})
