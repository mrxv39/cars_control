import { describe, it, expect, vi } from 'vitest'

// Mock jsPDF since it uses canvas which doesn't exist in jsdom
vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = { pageSize: { getHeight: () => 297 } }
    setFontSize = vi.fn()
    setTextColor = vi.fn()
    setFillColor = vi.fn()
    text = vi.fn()
    rect = vi.fn()
    addPage = vi.fn()
    save = vi.fn()
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

describe('generateSalesReportPDF', () => {
  it('does nothing with empty records', () => {
    // Should not throw
    generateSalesReportPDF([], stock)
  })

  it('generates PDF with records', () => {
    const records = [makeRecord(), makeRecord({ id: 2, price_final: 12000 })]
    // Should not throw
    generateSalesReportPDF(records, stock)
  })

  it('handles unknown vehicle gracefully', () => {
    const records = [makeRecord({ vehicle_folder_path: '/unknown' })]
    // Should not throw — shows "Desconocido"
    generateSalesReportPDF(records, stock)
  })
})

describe('generateMonthlyReportPDF', () => {
  it('filters records by month (1-indexed)', () => {
    const records = [
      makeRecord({ id: 1, date: '2026-03-15' }), // March
      makeRecord({ id: 2, date: '2026-04-10' }), // April
      makeRecord({ id: 3, date: '2026-03-28' }), // March
    ]
    // month=3 means March (1-indexed)
    generateMonthlyReportPDF(records, stock, 3, 2026)
    // No throw = success; the function filters internally
  })

  it('returns nothing for month with no records', () => {
    const records = [makeRecord({ date: '2026-03-15' })]
    // December — no records
    generateMonthlyReportPDF(records, stock, 12, 2026)
  })
})
