import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockText = vi.fn()
const mockSave = vi.fn()

vi.mock('jspdf', () => {
  return {
    jsPDF: class {
      internal = { pageSize: { getWidth: () => 210 } }
      text = (...args: unknown[]) => mockText(...args)
      save = (...args: unknown[]) => mockSave(...args)
      setFontSize = vi.fn()
      setFont = vi.fn()
      setTextColor = vi.fn()
      setDrawColor = vi.fn()
      setLineWidth = vi.fn()
      line = vi.fn()
      setFillColor = vi.fn()
      rect = vi.fn()
    },
  }
})

import { generateInvoicePDF } from '../utils/invoiceGenerator'

const baseData = {
  invoiceNumber: 'F-2026-001',
  date: '16/04/2026',
  companyName: 'CodinaCars',
  companyLegalName: 'Ricard Codina',
  companyCif: 'B12345678',
  companyAddress: 'Calle Test 1, Barcelona',
  companyPhone: '600123456',
  companyEmail: 'info@codinacars.com',
  buyerName: 'Juan Pérez',
  buyerDni: '12345678A',
  vehicleName: 'Seat Ibiza 2020',
  vehiclePlate: '1234ABC',
  purchasePrice: 8000,
  salePrice: 10000,
}

describe('generateInvoicePDF', () => {
  beforeEach(() => {
    mockText.mockClear()
    mockSave.mockClear()
  })

  it('generates REBU invoice and saves with correct filename', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU' })
    expect(mockSave).toHaveBeenCalledWith('Factura_F-2026-001.pdf')
  })

  it('generates IVA invoice and saves with correct filename', () => {
    generateInvoicePDF({ ...baseData, type: 'IVA' })
    expect(mockSave).toHaveBeenCalledWith('Factura_F-2026-001.pdf')
  })

  it('includes company name in output', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU' })
    expect(mockText).toHaveBeenCalledWith('CodinaCars', expect.any(Number), expect.any(Number))
  })

  it('includes buyer data in output', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU' })
    const calls = mockText.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('Nombre: Juan Pérez')
    expect(calls).toContain('DNI/NIE: 12345678A')
  })

  it('includes vehicle plate when provided', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU' })
    const calls = mockText.mock.calls.map((c: unknown[]) => c[0])
    const vehicleDesc = calls.find((c) => typeof c === 'string' && c.includes('1234ABC'))
    expect(vehicleDesc).toBeDefined()
  })

  it('REBU invoice shows margen breakdown', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU', purchasePrice: 8000, salePrice: 10000 })
    const calls = mockText.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('Margen bruto:')
    expect(calls).toContain('Base imponible (margen / 1,21):')
    expect(calls).toContain('IVA 21% (sobre base margen):')
  })

  it('IVA invoice shows base + IVA', () => {
    generateInvoicePDF({ ...baseData, type: 'IVA' })
    const calls = mockText.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('Base imponible:')
    expect(calls).toContain('IVA 21%:')
  })

  it('REBU label mentions regimen especial', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU' })
    const calls = mockText.mock.calls.map((c: unknown[]) => c[0])
    const rebuLabel = calls.find((c) => typeof c === 'string' && c.includes('Régimen especial'))
    expect(rebuLabel).toBeDefined()
  })

  it('handles invoice number with slashes in filename', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU', invoiceNumber: 'F/2026/001' })
    expect(mockSave).toHaveBeenCalledWith('Factura_F-2026-001.pdf')
  })

  it('includes optional buyerAddress when provided', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU', buyerAddress: 'Calle Falsa 123' })
    const calls = mockText.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('Dirección: Calle Falsa 123')
  })

  it('includes optional buyerPhone when provided', () => {
    generateInvoicePDF({ ...baseData, type: 'REBU', buyerPhone: '600999888' })
    const calls = mockText.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('Teléfono: 600999888')
  })
})
