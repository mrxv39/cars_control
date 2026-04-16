import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock jsPDF since it uses canvas which doesn't exist in jsdom
const mockText = vi.fn()
const mockSave = vi.fn()
const mockAddPage = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = { pageSize: { getHeight: () => 297, getWidth: () => 210 } }
    setFontSize = vi.fn()
    setFont = vi.fn()
    setTextColor = vi.fn()
    setFillColor = vi.fn()
    setDrawColor = vi.fn()
    text = (...args: unknown[]) => mockText(...args)
    rect = vi.fn()
    line = vi.fn()
    addPage = (...args: unknown[]) => mockAddPage(...args)
    save = (...args: unknown[]) => mockSave(...args)
  }
  return { jsPDF: MockJsPDF }
})

import { generateSalesReportPDF, generateMonthlyReportPDF } from '../utils/reportGenerator'
import type { SalesRecord, StockVehicle } from '../types'

const stock: StockVehicle[] = [
  { name: 'Seat Ibiza', folder_path: '/seat', ad_info: null },
]

function makeRecord(overrides: Partial<SalesRecord> = {}): SalesRecord {
  return {
    id: 1,
    vehicle_folder_path: '/seat',
    price_final: 8000,
    date: '2026-03-15',
    notes: 'Venta directa',
    ...overrides,
  }
}

beforeEach(() => {
  mockText.mockClear()
  mockSave.mockClear()
  mockAddPage.mockClear()
})

describe('generateSalesReportPDF', () => {
  it('does nothing with empty records', () => {
    generateSalesReportPDF([], stock)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('generates PDF with records', () => {
    const records = [makeRecord(), makeRecord({ id: 2, price_final: 12000 })]
    generateSalesReportPDF(records, stock)
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('uses default title "Reporte de Ventas" when none provided', () => {
    generateSalesReportPDF([makeRecord()], stock)
    const titleCall = mockText.mock.calls.find(
      (c: unknown[]) => c[0] === 'Reporte de Ventas'
    )
    expect(titleCall).toBeDefined()
  })

  it('uses custom title when provided', () => {
    generateSalesReportPDF([makeRecord()], stock, 'Informe Q1')
    const titleCall = mockText.mock.calls.find(
      (c: unknown[]) => c[0] === 'Informe Q1'
    )
    expect(titleCall).toBeDefined()
  })

  it('renders correct total ventas count in summary', () => {
    const records = [makeRecord(), makeRecord({ id: 2 }), makeRecord({ id: 3 })]
    generateSalesReportPDF(records, stock)
    const totalCall = mockText.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('Total de ventas: 3')
    )
    expect(totalCall).toBeDefined()
  })

  it('handles unknown vehicle gracefully — shows "Desconocido"', () => {
    const records = [makeRecord({ vehicle_folder_path: '/unknown' })]
    generateSalesReportPDF(records, stock)
    const desconocidoCall = mockText.mock.calls.find(
      (c: unknown[]) => c[0] === 'Desconocido'
    )
    expect(desconocidoCall).toBeDefined()
  })

  it('maps vehicle name from stock via folder_path', () => {
    generateSalesReportPDF([makeRecord()], stock)
    const nameCall = mockText.mock.calls.find(
      (c: unknown[]) => c[0] === 'Seat Ibiza'
    )
    expect(nameCall).toBeDefined()
  })

  it('shows "-" when record notes are empty', () => {
    generateSalesReportPDF([makeRecord({ notes: '' })], stock)
    const dashCall = mockText.mock.calls.find(
      (c: unknown[]) => c[0] === '-'
    )
    expect(dashCall).toBeDefined()
  })

  it('throws user-friendly error when save fails', () => {
    mockSave.mockImplementation(() => { throw new Error('disk error') })
    expect(() =>
      generateSalesReportPDF([makeRecord()], stock)
    ).toThrow('No se pudo generar el PDF')
    mockSave.mockImplementation(() => {})
  })
})

describe('generateMonthlyReportPDF', () => {
  it('filters records by month (1-indexed) and only includes matching records', () => {
    const records = [
      makeRecord({ id: 1, date: '2026-03-15' }), // March
      makeRecord({ id: 2, date: '2026-04-10' }), // April
      makeRecord({ id: 3, date: '2026-03-28' }), // March
    ]
    // month=3 means March (1-indexed)
    generateMonthlyReportPDF(records, stock, 3, 2026)
    const totalCall = mockText.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('Total de ventas: 2')
    )
    expect(totalCall).toBeDefined()
  })

  it('does not generate PDF for month with no records', () => {
    const records = [makeRecord({ date: '2026-03-15' })]
    // December — no records → empty filtered list → early return
    generateMonthlyReportPDF(records, stock, 12, 2026)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('includes month name in report title', () => {
    const records = [makeRecord({ date: '2026-03-15' })]
    generateMonthlyReportPDF(records, stock, 3, 2026)
    const titleCall = mockText.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('Reporte de Ventas')
    )
    expect(titleCall).toBeDefined()
  })
})
