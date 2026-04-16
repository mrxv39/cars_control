import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StockList } from '../components/web/StockList'
import type { Vehicle, Lead, PurchaseRecord } from '../lib/api'

vi.mock('../lib/api', () => ({
  getStockPhotoSummary: vi.fn(),
  getStockDocSummary: vi.fn(),
  listKnownExternalIds: vi.fn(),
  fetchCochesNetPreview: vi.fn(),
  importCochesNetVehicles: vi.fn(),
  markVehiclesNeedsReview: vi.fn(),
  createVehicle: vi.fn(),
}))

vi.mock('../lib/csv-export', () => ({
  exportToCSV: vi.fn(),
}))

const api = await import('../lib/api')

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    company_id: 1,
    name: 'Seat Ibiza 2019',
    precio_compra: 8000,
    precio_venta: 10500,
    km: 50000,
    anio: 2019,
    estado: 'disponible',
    ad_url: '',
    ad_status: '',
    fuel: 'Gasolina',
    cv: '',
    transmission: '',
    color: 'Blanco',
    notes: '',
    ...overrides,
  }
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    name: 'Juan García',
    phone: '612345678',
    email: 'juan@example.com',
    notes: '',
    vehicle_interest: '',
    converted_client_id: null,
    estado: 'nuevo',
    fecha_contacto: '',
    canal: 'web',
    company_id: 1,
    vehicle_id: null,
    ...overrides,
  }
}

function makePurchaseRecord(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: 1,
    expense_type: 'COMPRA_VEHICULO',
    vehicle_name: 'Seat Ibiza',
    plate: '1234ABC',
    supplier_name: 'AutoVenta',
    purchase_date: '2026-01-15',
    purchase_price: 8000,
    invoice_number: 'F-001',
    payment_method: 'transferencia',
    notes: '',
    source_file: '',
    created_at: '2026-01-15',
    company_id: 1,
    vehicle_id: 1,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getStockPhotoSummary).mockResolvedValue(new Map())
  vi.mocked(api.getStockDocSummary).mockResolvedValue(new Map())
})

describe('StockList', () => {
  const vehicles = [
    makeVehicle({ id: 1, name: 'Seat Ibiza 2019', fuel: 'Gasolina', anio: 2019, precio_venta: 10500 }),
    makeVehicle({ id: 2, name: 'Ford Focus 2020', fuel: 'Diésel', anio: 2020, precio_venta: 12000 }),
    makeVehicle({ id: 3, name: 'BMW Serie 3', fuel: 'Gasolina', anio: 2021, precio_venta: null }),
  ]

  const defaultProps = {
    vehicles,
    allVehicles: vehicles,
    leads: [] as Lead[],
    purchaseRecords: [] as PurchaseRecord[],
    companyId: 1,
    dealerWebsite: 'https://coches.net/dealer',
    onSelect: vi.fn(),
    onReload: vi.fn(),
  }

  it('renders vehicle count', () => {
    render(<StockList {...defaultProps} />)
    expect(screen.getByText('3 vehículos')).toBeInTheDocument()
  })

  it('renders all vehicle names', async () => {
    render(<StockList {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Seat Ibiza 2019')).toBeInTheDocument()
      expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
      expect(screen.getByText('BMW Serie 3')).toBeInTheDocument()
    })
  })

  it('filters vehicles by search text', async () => {
    render(<StockList {...defaultProps} />)
    const searchInput = screen.getByPlaceholderText('Buscar...')
    fireEvent.change(searchInput, { target: { value: 'ford' } })
    await waitFor(() => {
      expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
      expect(screen.getByText('1 de 3')).toBeInTheDocument()
    })
  })

  it('shows singular form for one vehicle', () => {
    render(<StockList {...defaultProps} vehicles={[vehicles[0]]} />)
    expect(screen.getByText('1 vehículo')).toBeInTheDocument()
  })

  it('shows add form when button is clicked', () => {
    render(<StockList {...defaultProps} />)
    fireEvent.click(screen.getByText('Añadir vehículo'))
    expect(screen.getByText('Marca y modelo')).toBeInTheDocument()
  })

  it('calls onSelect when vehicle row is clicked', async () => {
    render(<StockList {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Seat Ibiza 2019')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Seat Ibiza 2019'))
    expect(defaultProps.onSelect).toHaveBeenCalledWith(vehicles[0])
  })

  it('renders empty list with 0 count', () => {
    render(<StockList {...defaultProps} vehicles={[]} />)
    expect(screen.getByText('0 vehículos')).toBeInTheDocument()
  })

  it('shows price for vehicles with precio_venta', async () => {
    render(<StockList {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('10.500 €')).toBeInTheDocument()
    })
  })

  it('shows "Sin precio" for vehicles without precio_venta', () => {
    render(<StockList {...defaultProps} />)
    // "Sin precio" appears both as a filter button label and in the vehicle row
    const elements = screen.getAllByText('Sin precio')
    expect(elements.length).toBeGreaterThanOrEqual(2)
  })

  it('shows leads count chip when vehicle has unanswered leads', () => {
    const leads = [
      makeLead({ id: 1, vehicle_id: 1, estado: 'nuevo' }),
      makeLead({ id: 2, vehicle_id: 1, estado: 'nuevo' }),
    ]
    render(<StockList {...defaultProps} leads={leads} />)
    // The chip renders as "💬 2"
    const chips = screen.getAllByTitle('Leads sin contestar')
    expect(chips.length).toBeGreaterThan(0)
    expect(chips[0].textContent).toContain('2')
  })

  it('loads photo and doc summaries on mount', async () => {
    render(<StockList {...defaultProps} />)
    await waitFor(() => {
      expect(api.getStockPhotoSummary).toHaveBeenCalledWith([1, 2, 3])
      expect(api.getStockDocSummary).toHaveBeenCalledWith([1, 2, 3])
    })
  })
})
