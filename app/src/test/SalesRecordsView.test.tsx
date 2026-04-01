import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SalesRecordsView } from '../components/SalesRecordsView'
import type { SalesRecord, StockVehicle, Client } from '../types'

vi.mock('../utils/reportGenerator', () => ({
  generateSalesReportPDF: vi.fn(),
}))

function makeRecord(overrides: Partial<SalesRecord> = {}): SalesRecord {
  return {
    id: 1,
    vehicle_folder_path: '/stock/seat-ibiza',
    client_id: null,
    price_final: 12500,
    date: '2026-01-20',
    notes: '',
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

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    name: 'Pedro López',
    phone: '698765432',
    email: '',
    dni: '',
    notes: '',
    vehicle_folder_path: null,
    source_lead_id: null,
    ...overrides,
  }
}

describe('SalesRecordsView', () => {
  const records = [
    makeRecord({ id: 1, price_final: 12500, date: '2026-01-20', vehicle_folder_path: '/stock/seat-ibiza' }),
    makeRecord({ id: 2, price_final: 18000, date: '2026-02-10', vehicle_folder_path: '/stock/ford-focus' }),
    makeRecord({ id: 3, price_final: 9500, date: '2026-03-05', vehicle_folder_path: '/stock/dacia-sandero', notes: 'Oferta especial' }),
  ]
  const stock = [
    makeVehicle({ name: 'Seat Ibiza 2019', folder_path: '/stock/seat-ibiza' }),
    makeVehicle({ name: 'Ford Focus 2020', folder_path: '/stock/ford-focus' }),
    makeVehicle({ name: 'Dacia Sandero', folder_path: '/stock/dacia-sandero' }),
  ]
  const clients = [makeClient()]

  const defaultProps = {
    records,
    stock,
    clients,
    onReload: vi.fn(),
    onAddRecord: vi.fn().mockResolvedValue(undefined),
    onDeleteRecord: vi.fn(),
    submitting: false,
  }

  it('renders sales records header', () => {
    render(<SalesRecordsView {...defaultProps} />)
    expect(screen.getByText('Historial de operaciones')).toBeInTheDocument()
  })

  it('shows correct sales count', () => {
    render(<SalesRecordsView {...defaultProps} />)
    expect(screen.getByText(/3 ventas registradas/)).toBeInTheDocument()
  })

  it('shows stats cards', () => {
    render(<SalesRecordsView {...defaultProps} />)
    expect(screen.getByText('Total facturado')).toBeInTheDocument()
    expect(screen.getByText('Promedio por venta')).toBeInTheDocument()
    expect(screen.getByText('Mejor venta')).toBeInTheDocument()
    expect(screen.getByText('Total operaciones')).toBeInTheDocument()
  })

  it('renders vehicle names in table', () => {
    render(<SalesRecordsView {...defaultProps} />)
    expect(screen.getByText('Seat Ibiza 2019')).toBeInTheDocument()
    expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
    expect(screen.getByText('Dacia Sandero')).toBeInTheDocument()
  })

  it('filters records by search', () => {
    render(<SalesRecordsView {...defaultProps} />)
    const searchInput = screen.getByPlaceholderText(/Buscar por vehiculo/i)
    fireEvent.change(searchInput, { target: { value: 'Oferta' } })
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
  })

  it('shows new sale form when button clicked', () => {
    render(<SalesRecordsView {...defaultProps} />)
    fireEvent.click(screen.getByText('Nueva Venta'))
    expect(screen.getByText('Nueva venta')).toBeInTheDocument()
    expect(screen.getByText('Registrar venta')).toBeInTheDocument()
  })

  it('calls onDeleteRecord when delete button is clicked', () => {
    render(<SalesRecordsView {...defaultProps} />)
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    expect(defaultProps.onDeleteRecord).toHaveBeenCalled()
  })

  it('shows empty state when no records', () => {
    render(<SalesRecordsView {...defaultProps} records={[]} />)
    expect(screen.getByText('No hay ventas registradas')).toBeInTheDocument()
  })

  it('shows PDF download button when records exist', () => {
    render(<SalesRecordsView {...defaultProps} />)
    expect(screen.getByText('Descargar PDF')).toBeInTheDocument()
  })

  it('hides PDF button when no records', () => {
    render(<SalesRecordsView {...defaultProps} records={[]} />)
    expect(screen.queryByText('Descargar PDF')).not.toBeInTheDocument()
  })
})
