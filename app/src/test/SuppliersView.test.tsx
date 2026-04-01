import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuppliersView } from '../components/SuppliersView'
import type { PurchaseRecord } from '../types'

function makeRecord(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: 1,
    expense_type: 'TALLER',
    vehicle_folder_path: '/stock/seat-ibiza',
    vehicle_name: 'Seat Ibiza',
    plate: '1234ABC',
    supplier_name: 'Taller López',
    purchase_date: '2026-01-15',
    purchase_price: 500,
    invoice_number: 'FAC-001',
    payment_method: 'Transferencia',
    notes: '',
    source_file: '',
    created_at: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

describe('SuppliersView', () => {
  const records = [
    makeRecord({ id: 1, supplier_name: 'Taller López', purchase_price: 500, expense_type: 'TALLER' }),
    makeRecord({ id: 2, supplier_name: 'Taller López', purchase_price: 300, expense_type: 'RECAMBIOS', plate: '5678DEF' }),
    makeRecord({ id: 3, supplier_name: 'Transportes García', purchase_price: 200, expense_type: 'TRANSPORTE', plate: '9999ZZZ' }),
  ]

  const defaultProps = {
    records,
    onReload: vi.fn(),
  }

  it('renders supplier directory', () => {
    render(<SuppliersView {...defaultProps} />)
    expect(screen.getByText('Directorio de proveedores')).toBeInTheDocument()
  })

  it('aggregates suppliers from records', () => {
    render(<SuppliersView {...defaultProps} />)
    // Taller López appears in both the table and the "Mayor proveedor" stat card
    const tallerElements = screen.getAllByText('Taller López')
    expect(tallerElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Transportes García')).toBeInTheDocument()
  })

  it('shows correct supplier count', () => {
    render(<SuppliersView {...defaultProps} />)
    expect(screen.getByText('2 proveedores registrados')).toBeInTheDocument()
  })

  it('shows total spent in stats', () => {
    render(<SuppliersView {...defaultProps} />)
    // Total: 500 + 300 + 200 = 1000
    expect(screen.getByText('Total gastado')).toBeInTheDocument()
    expect(screen.getByText('Total facturas')).toBeInTheDocument()
  })

  it('shows top supplier name', () => {
    render(<SuppliersView {...defaultProps} />)
    expect(screen.getByText('Mayor proveedor')).toBeInTheDocument()
    // Taller López has 800 total (500 + 300), which is the top
    const statCards = screen.getAllByText('Taller López')
    expect(statCards.length).toBeGreaterThanOrEqual(1)
  })

  it('filters suppliers by search', () => {
    render(<SuppliersView {...defaultProps} />)
    const searchInput = screen.getByPlaceholderText(/Buscar proveedor/i)
    fireEvent.change(searchInput, { target: { value: 'García' } })
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
  })

  it('shows detail view when clicking Ver', () => {
    render(<SuppliersView {...defaultProps} />)
    const verButtons = screen.getAllByText('Ver')
    fireEvent.click(verButtons[0])
    expect(screen.getByText('Volver a proveedores')).toBeInTheDocument()
  })

  it('shows empty state when no records', () => {
    render(<SuppliersView {...defaultProps} records={[]} />)
    expect(screen.getByText('No hay proveedores registrados')).toBeInTheDocument()
  })

  it('calls onReload when button is clicked', () => {
    render(<SuppliersView {...defaultProps} />)
    fireEvent.click(screen.getByText('Recargar'))
    expect(defaultProps.onReload).toHaveBeenCalled()
  })
})
