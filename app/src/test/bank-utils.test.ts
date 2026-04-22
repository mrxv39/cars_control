import { describe, it, expect } from 'vitest'
import {
  CATEGORY_LABELS,
  CATEGORY_COLOR,
  CATEGORY_GROUPS,
  categoryLabel,
  categoryColor,
  formatEur,
  formatDate,
  monthOf,
  monthLabel,
  periodRange,
  suggestPatternFromTx,
} from '../components/bank-utils'

describe('categoryLabel', () => {
  it('returns label for known categories', () => {
    expect(categoryLabel('COMPRA_VEHICULO')).toBe('Compra vehículo')
    expect(categoryLabel('VENTA_VEHICULO')).toBe('Venta vehículo')
    expect(categoryLabel('ITV')).toBe('ITV')
  })

  it('returns raw key for unknown categories', () => {
    expect(categoryLabel('UNKNOWN')).toBe('UNKNOWN')
  })
})

describe('categoryColor', () => {
  it('returns color for known categories', () => {
    expect(categoryColor('COMPRA_VEHICULO')).toBe('#1d4ed8')
    expect(categoryColor('VENTA_VEHICULO')).toBe('#16a34a')
  })

  it('returns fallback gray for unknown categories', () => {
    expect(categoryColor('UNKNOWN')).toBe('#94a3b8')
  })
})

describe('CATEGORY_LABELS', () => {
  it('has entries for all CATEGORY_COLOR keys', () => {
    for (const key of Object.keys(CATEGORY_COLOR)) {
      expect(CATEGORY_LABELS).toHaveProperty(key)
    }
  })
})

describe('CATEGORY_GROUPS', () => {
  it('covers every category exactly once', () => {
    const grouped = CATEGORY_GROUPS.flatMap((g) => g.keys)
    const labels = Object.keys(CATEGORY_LABELS)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect(new Set(grouped)).toEqual(new Set(labels))
  })

  it('uses only keys that exist in CATEGORY_LABELS', () => {
    for (const g of CATEGORY_GROUPS) {
      for (const k of g.keys) {
        expect(CATEGORY_LABELS).toHaveProperty(k)
      }
    }
  })

  it('has a non-empty label on every group', () => {
    for (const g of CATEGORY_GROUPS) {
      expect(g.label.trim().length).toBeGreaterThan(0)
      expect(g.keys.length).toBeGreaterThan(0)
    }
  })
})

describe('formatEur', () => {
  it('formats positive amounts in EUR with currency symbol', () => {
    const result = formatEur(1234.5)
    // Locale-dependent formatting: just check it contains the digits and currency
    expect(result).toMatch(/1[\.\s]?234/)
    expect(result).toMatch(/€|EUR/)
  })

  it('formats zero', () => {
    const result = formatEur(0)
    expect(result).toMatch(/0/)
    expect(result).toMatch(/€|EUR/)
  })

  it('formats negative amounts', () => {
    const result = formatEur(-500)
    expect(result).toMatch(/500/)
  })
})

describe('formatDate', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(formatDate('2026-04-16')).toBe('16/04/2026')
  })

  it('handles single-digit months', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026')
  })
})

describe('monthOf', () => {
  it('returns YYYY-MM from a date string', () => {
    expect(monthOf('2026-04-16')).toBe('2026-04')
  })
})

describe('monthLabel', () => {
  it('returns human-readable month in Spanish', () => {
    expect(monthLabel('2026-01')).toBe('enero 2026')
    expect(monthLabel('2026-04')).toBe('abril 2026')
    expect(monthLabel('2026-12')).toBe('diciembre 2026')
  })
})

describe('periodRange', () => {
  const pinned = new Date('2026-05-17T12:00:00Z')

  it('returns null for "all" (no date filtering)', () => {
    expect(periodRange('all', pinned)).toBeNull()
  })

  it('returns the current month range for "this_month"', () => {
    expect(periodRange('this_month', pinned)).toEqual({ from: '2026-05-01', to: '2026-05-31' })
  })

  it('returns the current quarter for "this_quarter" (Q2: abr-jun)', () => {
    expect(periodRange('this_quarter', pinned)).toEqual({ from: '2026-04-01', to: '2026-06-30' })
  })

  it('returns the current year for "this_year"', () => {
    expect(periodRange('this_year', pinned)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('handles quarter boundaries (Q1 starts in enero)', () => {
    expect(periodRange('this_quarter', new Date('2026-02-15T12:00:00Z')))
      .toEqual({ from: '2026-01-01', to: '2026-03-31' })
  })
})

describe('suggestPatternFromTx', () => {
  it('prefers counterparty name when available', () => {
    expect(suggestPatternFromTx('AUTO1 SL', 'Transferencia')).toBe('AUTO1 SL')
  })

  it('falls back to literal description head when counterparty is empty', () => {
    // "EESS MOLINS DE RE" es el segmento antes del primer separador " |"
    expect(suggestPatternFromTx('', 'EESS MOLINS DE RE | 09736 / Fecha')).toBe('EESS MOLINS DE RE')
  })

  it('returns empty string when both fields are empty', () => {
    expect(suggestPatternFromTx('', '')).toBe('')
  })

  it('cuts at the first strong separator (3+ digits)', () => {
    expect(suggestPatternFromTx('', 'AGENCIA TRIBUTARIA 12345 referencia'))
      .toBe('AGENCIA TRIBUTARIA')
  })
})
