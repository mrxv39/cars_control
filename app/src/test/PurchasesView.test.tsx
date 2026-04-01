import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PurchasesView } from '../components/PurchasesView'
import type { PurchaseRecord, StockVehicle } from '../types'

function makeRecord(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: 1,
    expense_type: 'COMPRA_VEHICULO',
    vehicle_folder_path: '/stock/seat-ibiza',
    vehicle_name: 'Seat Ibiza',
    plate: '1234ABC',
    supplier_name: 'Vendedor Particular',
    purchase_date: '2026-01-15',
    purchase_price: 8500,
    invoice_number: 'FAC-001',
    payment_method: 'Transferencia',
    notes: '',
    source_file: '',
    created_at: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

function makeVehicle(overrides: Partial<StockVehicle> = {}): StockVehicle {
  return {
    name: 'Seat Ibiza 2019',
    folder_path: '/stock/seat-ibiza',
    ad_info: null,
    estado: 'disponible',
    ...overrides,
  }
}

describe('PurchasesView', () => {
  const records = [
    makeRecord({ id: 1, expense_type: 'COMPRA_VEHICULO', purchase_price: 8500, supplier_name: 'Vendedor A' }),
    makeRecord({ id: 2, expense_type: 'TALLER', purchase_price: 350, supplier_name: 'Taller López', invoice_number: 'FAC-002' }),
    makeRecord({ id: 3, expense_type: 'TRANSPORTE', purchase_price: 150, supplier_name: 'Transportes García', invoice_number: 'FAC-003' }),
  ]
  const stock = [makeVehicle()]

  const defaultProps = {
    records,
    stock,
    onReload: vi.fn(),
    onAddRecord: vi.fn().mockResolvedValue(undefined),
    onDeleteRecord: vi.fn(),
    submitting: false,
  }

  it('renders purchase records table', () => {
    render(<PurchasesView {...defaultProps} />)
    expect(screen.getByText('Registro de compras y gastos')).toBeInTheDocument()
  })

  it('shows correct record count', () => {
    render(<PurchasesView {...defaultProps} />)
    expect(screen.getByText(/3 registros/)).toBeInTheDocument()
  })

  it('shows stats cards with totals', () => {
    render(<PurchasesView {...defaultProps} />)
    expect(screen.getByText('Total gastado')).toBeInTheDocument()
    expect(screen.getByText('Compras vehiculos')).toBeInTheDocument()
    expect(screen.getByText('Otros gastos')).toBeInTheDocument()
    expect(screen.getByText('Total registros')).toBeInTheDocument()
  })

  it('filters by expense type', () => {
    render(<PurchasesView {...defaultProps} />)
    const typeSelect = screen.getByDisplayValue('Todos los tipos')
    fireEvent.change(typeSelect, { target: { value: 'TALLER' } })
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
  })

  it('filters by search text', () => {
    render(<PurchasesView {...defaultProps} />)
    const searchInput = screen.getByPlaceholderText(/Buscar por vehiculo/i)
    fireEvent.change(searchInput, { target: { value: 'Transportes' } })
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
  })

  it('shows new expense form when button clicked', () => {
    render(<PurchasesView {...defaultProps} />)
    fireEvent.click(screen.getByText('Nuevo Gasto'))
    expect(screen.getByText('Nuevo gasto')).toBeInTheDocument()
    expect(screen.getByText('Registrar gasto')).toBeInTheDocument()
  })

  it('hides form when Cancelar is clicked', () => {
    render(<PurchasesView {...defaultProps} />)
    fireEvent.click(screen.getByText('Nuevo Gasto'))
    expect(screen.getByText('Nuevo gasto')).toBeInTheDocument()
    // The hero button text changes to "Cancelar"
    fireEvent.click(screen.getAllByText('Cancelar')[0])
    expect(screen.queryByText('Registrar gasto')).not.toBeInTheDocument()
  })

  it('calls onDeleteRecord when delete button is clicked', () => {
    render(<PurchasesView {...defaultProps} />)
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    expect(defaultProps.onDeleteRecord).toHaveBeenCalledWith(1)
  })

  it('shows empty state when no records', () => {
    render(<PurchasesView {...defaultProps} records={[]} />)
    expect(screen.getByText('No hay compras o gastos registrados')).toBeInTheDocument()
  })

  it('displays expense type badges', () => {
    render(<PurchasesView {...defaultProps} />)
    // "Compra vehiculo" appears in both the select option and the table badge
    const compraElements = screen.getAllByText('Compra vehiculo')
    expect(compraElements.length).toBeGreaterThanOrEqual(2)
    // Taller appears in both select and table
    const tallerElements = screen.getAllByText('Taller')
    expect(tallerElements.length).toBeGreaterThanOrEqual(2)
  })
})
