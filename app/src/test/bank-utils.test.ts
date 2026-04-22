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
