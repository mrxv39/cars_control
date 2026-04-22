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

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

vi.mock('../lib/csv-export', () => ({ exportToCSV: vi.fn() }))

const api = await import('../lib/api')
const { exportToCSV } = await import('../lib/csv-export')

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    company_id: 1,
    name: 'Seat Ibiza 1.0 TSI',
    precio_compra: 8000,
    precio_venta: 10500,
    km: 45000,
    anio: 2021,
    estado: 'disponible',
    ad_url: '',
    ad_status: '',
    fuel: 'Gasolina',
    cv: '',
    transmission: '',
    color: 'Blanco',
    notes: '',
    supplier_id: null,
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
    vehicle_interest: 'Seat Ibiza',
    converted_client_id: null,
    estado: 'nuevo',
    fecha_contacto: '2026-04-01',
    canal: 'web',
    company_id: 1,
    vehicle_id: null,
    ...overrides,
  }
}



const defaultProps = {
  vehicles: [] as Vehicle[],
  allVehicles: [] as Vehicle[],
  leads: [] as Lead[],
  purchaseRecords: [] as PurchaseRecord[],
  companyId: 1,
  dealerWebsite: 'https://coches.net/dealer/codina',
  onSelect: vi.fn(),
  onReload: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getStockPhotoSummary).mockResolvedValue(new Map())
  vi.mocked(api.getStockDocSummary).mockResolvedValue(new Map())
  vi.mocked(api.createVehicle).mockResolvedValue(makeVehicle())
  // StockList persiste filtros en localStorage (audit 2026-04-22) — aislamiento entre tests
  localStorage.clear()
})

describe('StockList — empty state', () => {
  it('shows zero count when no vehicles', () => {
    render(<StockList {...defaultProps} />)
    expect(screen.getByText('0 vehículos')).toBeInTheDocument()
  })

  it('renders header title', () => {
    render(<StockList {...defaultProps} />)
    expect(screen.getByText('Vehículos en stock')).toBeInTheDocument()
  })
})

describe('StockList — rendering vehicles', () => {
  const vehicles = [
    makeVehicle({ id: 1, name: 'Seat Ibiza 1.0 TSI', anio: 2021, km: 45000, precio_venta: 10500 }),
    makeVehicle({ id: 2, name: 'BMW Serie 3 320d', anio: 2020, km: 80000, precio_venta: 22000, fuel: 'Diésel' }),
    makeVehicle({ id: 3, name: 'Renault Clio', anio: 2019, km: 60000, precio_venta: null, fuel: 'Gasolina' }),
  ]

  it('renders vehicle count in header', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    expect(screen.getByText('3 vehículos')).toBeInTheDocument()
  })

  it('renders singular when one vehicle', () => {
    render(<StockList {...defaultProps} vehicles={[vehicles[0]]} allVehicles={[vehicles[0]]} />)
    expect(screen.getByText('1 vehículo')).toBeInTheDocument()
  })

  it('renders all vehicle names', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    expect(screen.getByText('Seat Ibiza 1.0 TSI')).toBeInTheDocument()
    expect(screen.getByText('BMW Serie 3 320d')).toBeInTheDocument()
    expect(screen.getByText('Renault Clio')).toBeInTheDocument()
  })

  it('shows "Sin precio" label for vehicles without precio_venta', () => {
    render(<StockList {...defaultProps} vehicles={[vehicles[2]]} allVehicles={[vehicles[2]]} />)
    // One "Sin precio" in the row, another in the filter button
    const matches = screen.getAllByText('Sin precio')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('shows precio_venta formatted with euro sign', async () => {
    render(<StockList {...defaultProps} vehicles={[vehicles[0]]} allVehicles={[vehicles[0]]} />)
    await waitFor(() => {
      expect(screen.getByText('10.500 €')).toBeInTheDocument()
    })
  })

  it('calls onSelect when clicking a vehicle row', async () => {
    const onSelect = vi.fn()
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} onSelect={onSelect} />)
    await waitFor(() => {
      expect(screen.getByText('Seat Ibiza 1.0 TSI')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Seat Ibiza 1.0 TSI'))
    expect(onSelect).toHaveBeenCalledWith(vehicles[0])
  })

  it('loads photo and doc summaries on mount', async () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    await waitFor(() => {
      expect(api.getStockPhotoSummary).toHaveBeenCalledWith([1, 2, 3])
      expect(api.getStockDocSummary).toHaveBeenCalledWith([1, 2, 3])
    })
  })
})

describe('StockList — status badges', () => {
  it('shows estado badge when not "disponible"', () => {
    const v = makeVehicle({ id: 10, name: 'Ford Focus', estado: 'reservado' })
    render(<StockList {...defaultProps} vehicles={[v]} allVehicles={[v]} />)
    expect(screen.getByText('reservado')).toBeInTheDocument()
  })

  it('does not show estado badge when "disponible"', () => {
    const v = makeVehicle({ id: 10, name: 'Ford Focus', estado: 'disponible' })
    render(<StockList {...defaultProps} vehicles={[v]} allVehicles={[v]} />)
    // "disponible" should not appear as a badge (only vehicles with non-disponible estado show badge)
    const badges = screen.queryAllByText('disponible')
    expect(badges).toHaveLength(0)
  })
})

describe('StockList — search filter', () => {
  const vehicles = [
    makeVehicle({ id: 1, name: 'Seat Ibiza 1.0 TSI', fuel: 'Gasolina' }),
    makeVehicle({ id: 2, name: 'BMW Serie 3 320d', fuel: 'Diésel' }),
  ]

  it('filters by name via search input', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'bmw' } })
    expect(screen.getByText('BMW Serie 3 320d')).toBeInTheDocument()
    expect(screen.queryByText('Seat Ibiza 1.0 TSI')).not.toBeInTheDocument()
  })

  it('shows filtered count when searching', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'seat' } })
    expect(screen.getByText('1 de 2')).toBeInTheDocument()
  })

  it('applies externalSearch prop as initial search', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} externalSearch="bmw" />)
    expect(screen.getByText('BMW Serie 3 320d')).toBeInTheDocument()
    expect(screen.queryByText('Seat Ibiza 1.0 TSI')).not.toBeInTheDocument()
  })
})

describe('StockList — filter buttons', () => {
  const vehicles = [
    makeVehicle({ id: 1, name: 'Con precio', precio_venta: 10000 }),
    makeVehicle({ id: 2, name: 'Sin precio venta', precio_venta: null }),
  ]

  it('renders all filter buttons', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    expect(screen.getByRole('button', { name: /Pendientes/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Con leads/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Listos/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sin precio/ })).toBeInTheDocument()
  })

  it('filters to "Sin precio" vehicles when clicking that filter', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    fireEvent.click(screen.getByRole('button', { name: /Sin precio/ }))
    expect(screen.getByText('Sin precio venta')).toBeInTheDocument()
    expect(screen.queryByText('Con precio')).not.toBeInTheDocument()
  })

  it('toggles filter off when clicking active filter again', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    fireEvent.click(screen.getByRole('button', { name: /Sin precio/ }))
    // Click again to deactivate
    fireEvent.click(screen.getByRole('button', { name: /Sin precio/ }))
    expect(screen.getByText('Con precio')).toBeInTheDocument()
    expect(screen.getByText('Sin precio venta')).toBeInTheDocument()
  })

  // Audit 2026-04-22: al abrir un coche y volver, los filtros se reseteaban.
  // Ahora filterKey/sortBy/fuel/price/year se guardan en localStorage.
  it('persists active filter to localStorage when clicked', () => {
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    fireEvent.click(screen.getByRole('button', { name: /Sin precio/ }))
    expect(localStorage.getItem('cc_stock_filterKey')).toBe('sin_precio')
  })

  it('restores active filter from localStorage on mount', () => {
    localStorage.setItem('cc_stock_filterKey', 'sin_precio')
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    // Filtro aplicado: solo queda el vehículo "Sin precio venta"
    expect(screen.getByText('Sin precio venta')).toBeInTheDocument()
    expect(screen.queryByText('Con precio')).not.toBeInTheDocument()
  })

  it('ignores an invalid filterKey stored in localStorage', () => {
    localStorage.setItem('cc_stock_filterKey', '<malicious>')
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    // Fallback a "todos" → ambos vehículos visibles
    expect(screen.getByText('Con precio')).toBeInTheDocument()
    expect(screen.getByText('Sin precio venta')).toBeInTheDocument()
  })
})

describe('StockList — leads pending chip', () => {
  it('shows leads chip when vehicle has unanswered leads', () => {
    const vehicles = [makeVehicle({ id: 1, name: 'Seat Ibiza' })]
    const leads = [
      makeLead({ id: 1, vehicle_id: 1, estado: 'nuevo' }),
      makeLead({ id: 2, vehicle_id: 1, estado: 'nuevo', phone: '699000001' }),
    ]
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} leads={leads} />)
    const chip = screen.getByTitle('Leads sin contestar')
    expect(chip).toBeInTheDocument()
    expect(chip.textContent).toContain('2')
  })

  it('does not show leads chip when no unanswered leads', () => {
    const vehicles = [makeVehicle({ id: 1, name: 'Seat Ibiza' })]
    const leads = [
      makeLead({ id: 1, vehicle_id: 1, estado: 'contactado' }),
    ]
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} leads={leads} />)
    expect(screen.queryByTitle('Leads sin contestar')).not.toBeInTheDocument()
  })
})

describe('StockList — add vehicle form', () => {
  it('shows add form when clicking "Añadir vehículo"', () => {
    render(<StockList {...defaultProps} />)
    fireEvent.click(screen.getByText('Añadir vehículo'))
    expect(screen.getByText('Marca y modelo')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Escribe para buscar coincidencias...')).toBeInTheDocument()
  })

  it('hides add form when clicking "Cancelar"', () => {
    render(<StockList {...defaultProps} />)
    fireEvent.click(screen.getByText('Añadir vehículo'))
    expect(screen.getByPlaceholderText('Escribe para buscar coincidencias...')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancelar'))
    expect(screen.queryByPlaceholderText('Escribe para buscar coincidencias...')).not.toBeInTheDocument()
  })

  it('shows name validation error on blur when empty', () => {
    render(<StockList {...defaultProps} />)
    fireEvent.click(screen.getByText('Añadir vehículo'))
    const input = screen.getByPlaceholderText('Escribe para buscar coincidencias...')
    fireEvent.blur(input)
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument()
  })

  it('calls exportToCSV when clicking export button', () => {
    const vehicles = [makeVehicle({ id: 1 })]
    render(<StockList {...defaultProps} vehicles={vehicles} allVehicles={vehicles} />)
    fireEvent.click(screen.getByText('Exportar CSV'))
    expect(exportToCSV).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ Nombre: 'Seat Ibiza 1.0 TSI' })]),
      'stock',
    )
  })
})
