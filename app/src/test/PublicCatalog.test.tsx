import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicCatalog, CatalogHeader } from '../components/web/PublicCatalog'
import type { Vehicle } from '../lib/api'

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
}))

vi.mock('../lib/api', () => ({
  listPublicVehicles: vi.fn(),
  listPrimaryPhotos: vi.fn(),
  listVehiclePhotos: vi.fn(),
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
    cv: '90cv',
    transmission: 'Manual',
    color: 'Blanco',
    notes: '',
    supplier_id: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listPublicVehicles).mockResolvedValue([])
  vi.mocked(api.listPrimaryPhotos).mockResolvedValue(new Map())
  vi.mocked(api.listVehiclePhotos).mockResolvedValue([])
})

describe('CatalogHeader', () => {
  it('renders the brand logo and phone link', () => {
    render(<CatalogHeader onLogin={vi.fn()} onCatalog={vi.fn()} />)
    expect(screen.getByAltText('CodinaCars')).toBeInTheDocument()
    expect(screen.getByText('646 13 15 65')).toBeInTheDocument()
  })

  it('calls onCatalog when brand button is clicked', () => {
    const onCatalog = vi.fn()
    render(<CatalogHeader onLogin={vi.fn()} onCatalog={onCatalog} />)
    fireEvent.click(screen.getByLabelText('Ir al catálogo'))
    expect(onCatalog).toHaveBeenCalledOnce()
  })

  it('calls onLogin when login button is clicked', () => {
    const onLogin = vi.fn()
    render(<CatalogHeader onLogin={onLogin} onCatalog={vi.fn()} />)
    fireEvent.click(screen.getByText('Acceso usuarios'))
    expect(onLogin).toHaveBeenCalledOnce()
  })
})

describe('PublicCatalog', () => {
  const vehicles = [
    makeVehicle({ id: 1, name: 'Seat Ibiza 2019', fuel: 'Gasolina', anio: 2019, precio_venta: 10500, km: 50000 }),
    makeVehicle({ id: 2, name: 'Ford Focus 2020', fuel: 'Diésel', anio: 2020, precio_venta: 15000, km: 30000 }),
    makeVehicle({ id: 3, name: 'BMW Serie 3 2022', fuel: 'Gasolina', anio: 2022, precio_venta: 28000, km: 10000 }),
  ]

  function setupWithVehicles(list: Vehicle[] = vehicles) {
    vi.mocked(api.listPublicVehicles).mockResolvedValue(list)
    vi.mocked(api.listPrimaryPhotos).mockResolvedValue(new Map())
  }

  it('renders the hero banner with title and location', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Vehículos de ocasión')).toBeInTheDocument()
    })
    expect(screen.getByText('Compraventa de coches en Molins de Rei, Barcelona')).toBeInTheDocument()
  })

  it('shows vehicle count after loading', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('3 vehículos').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders vehicle cards with name, year, km, and price', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Seat Ibiza 2019')).toBeInTheDocument()
    })
    expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
    expect(screen.getByText('BMW Serie 3 2022')).toBeInTheDocument()
  })

  it('filters vehicles by search text', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Seat Ibiza 2019')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Buscar vehículos'), { target: { value: 'bmw' } })
    expect(screen.queryByText('Seat Ibiza 2019')).not.toBeInTheDocument()
    expect(screen.getByText('BMW Serie 3 2022')).toBeInTheDocument()
    expect(screen.getAllByText('1 vehículo').length).toBeGreaterThanOrEqual(1)
  })

  it('filters vehicles by fuel type', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('3 vehículos').length).toBeGreaterThanOrEqual(1)
    })
    fireEvent.change(screen.getByLabelText('Combustible'), { target: { value: 'Diésel' } })
    expect(screen.queryByText('Seat Ibiza 2019')).not.toBeInTheDocument()
    expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
    expect(screen.getAllByText('1 vehículo').length).toBeGreaterThanOrEqual(1)
  })

  it('filters vehicles by max price', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('3 vehículos').length).toBeGreaterThanOrEqual(1)
    })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '12000' } })
    expect(screen.getByText('Seat Ibiza 2019')).toBeInTheDocument()
    expect(screen.queryByText('BMW Serie 3 2022')).not.toBeInTheDocument()
  })

  it('excludes vehicles with estado vendido', async () => {
    const withSold = [
      ...vehicles,
      makeVehicle({ id: 4, name: 'Opel Corsa Vendido', estado: 'vendido', precio_venta: 7000 }),
    ]
    setupWithVehicles(withSold)
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('3 vehículos').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.queryByText('Opel Corsa Vendido')).not.toBeInTheDocument()
  })

  it('shows empty state when no vehicles match filters', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('3 vehículos').length).toBeGreaterThanOrEqual(1)
    })
    fireEvent.change(screen.getByLabelText('Buscar vehículos'), { target: { value: 'nonexistent' } })
    expect(screen.getByText('No se encontraron vehículos con estos filtros')).toBeInTheDocument()
  })

  it('renders footer with address and contact info', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('3 vehículos').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText(/Molins de Rei/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/codinacars@gmail.com/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders WhatsApp FAB link', async () => {
    setupWithVehicles()
    render(<PublicCatalog onLogin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('3 vehículos').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByLabelText('Contactar por WhatsApp')).toBeInTheDocument()
  })
})
