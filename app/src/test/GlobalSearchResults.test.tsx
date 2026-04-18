import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GlobalSearchResults } from '../components/web/GlobalSearchResults'
import type { Vehicle, Lead, Client } from '../lib/api'

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

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    company_id: 1,
    name: 'Juan Perez',
    phone: '600111222',
    email: 'juan@example.com',
    vehicle_interest: 'Seat Ibiza',
    canal: 'coches.net',
    estado: 'nuevo',
    notes: '',
    vehicle_id: null,
    ...overrides,
  } as Lead
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    company_id: 1,
    name: 'Ana Lopez',
    dni: '12345678A',
    email: 'ana@example.com',
    phone: '600333444',
    address: '',
    ...overrides,
  } as Client
}

describe('GlobalSearchResults', () => {
  it('renders "Sin resultados" when query matches nothing', () => {
    render(
      <GlobalSearchResults
        query="zzz"
        vehicles={[makeVehicle()]}
        leads={[makeLead()]}
        clients={[makeClient()]}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('filters vehicles by name', () => {
    render(
      <GlobalSearchResults
        query="ibiza"
        vehicles={[makeVehicle(), makeVehicle({ id: 2, name: 'Audi A3' })]}
        leads={[]}
        clients={[]}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText(/Seat Ibiza/)).toBeInTheDocument()
    expect(screen.queryByText(/Audi A3/)).not.toBeInTheDocument()
  })

  it('filters vehicles by year', () => {
    render(
      <GlobalSearchResults
        query="2019"
        vehicles={[makeVehicle(), makeVehicle({ id: 2, name: 'Audi A3', anio: 2015 })]}
        leads={[]}
        clients={[]}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText(/Seat Ibiza/)).toBeInTheDocument()
    expect(screen.queryByText(/Audi A3/)).not.toBeInTheDocument()
  })

  it('filters leads by name, phone and vehicle_interest', () => {
    const leads = [
      makeLead(),
      makeLead({ id: 2, name: 'Otro', phone: '600999888', vehicle_interest: 'Audi' }),
      makeLead({ id: 3, name: 'Tercer', phone: '600000000', vehicle_interest: 'Seat' }),
    ]
    const { rerender } = render(
      <GlobalSearchResults query="juan" vehicles={[]} leads={leads} clients={[]} onSelect={vi.fn()} />
    )
    expect(screen.getByText('Juan Perez')).toBeInTheDocument()
    expect(screen.queryByText('Otro')).not.toBeInTheDocument()

    rerender(
      <GlobalSearchResults query="600999" vehicles={[]} leads={leads} clients={[]} onSelect={vi.fn()} />
    )
    expect(screen.getByText('Otro')).toBeInTheDocument()

    rerender(
      <GlobalSearchResults query="audi" vehicles={[]} leads={leads} clients={[]} onSelect={vi.fn()} />
    )
    expect(screen.getByText('Otro')).toBeInTheDocument()
  })

  it('filters clients by name, DNI, email and phone', () => {
    const clients = [
      makeClient(),
      makeClient({ id: 2, name: 'Otro', dni: '87654321B', email: 'otro@foo.com', phone: '611222333' }),
    ]
    const { rerender } = render(
      <GlobalSearchResults query="ana" vehicles={[]} leads={[]} clients={clients} onSelect={vi.fn()} />
    )
    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.queryByText('Otro')).not.toBeInTheDocument()

    rerender(
      <GlobalSearchResults query="87654321" vehicles={[]} leads={[]} clients={clients} onSelect={vi.fn()} />
    )
    expect(screen.getByText('Otro')).toBeInTheDocument()

    rerender(
      <GlobalSearchResults query="otro@foo" vehicles={[]} leads={[]} clients={clients} onSelect={vi.fn()} />
    )
    expect(screen.getByText('Otro')).toBeInTheDocument()
  })

  it('limits each category to 5 results', () => {
    const vehicles = Array.from({ length: 10 }, (_, i) =>
      makeVehicle({ id: i + 1, name: `Coche ${i} ibiza` })
    )
    render(
      <GlobalSearchResults query="ibiza" vehicles={vehicles} leads={[]} clients={[]} onSelect={vi.fn()} />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  it('calls onSelect with the right type and id when a row is clicked', () => {
    const onSelect = vi.fn()
    render(
      <GlobalSearchResults
        query="seat"
        vehicles={[makeVehicle({ id: 42 })]}
        leads={[]}
        clients={[]}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText(/Seat Ibiza/))
    expect(onSelect).toHaveBeenCalledWith('vehicle', 42)
  })

  it('calls onSelect("lead", id) for a lead click', () => {
    const onSelect = vi.fn()
    render(
      <GlobalSearchResults
        query="juan"
        vehicles={[]}
        leads={[makeLead({ id: 7 })]}
        clients={[]}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('Juan Perez'))
    expect(onSelect).toHaveBeenCalledWith('lead', 7)
  })

  it('calls onSelect("client", id) for a client click', () => {
    const onSelect = vi.fn()
    render(
      <GlobalSearchResults
        query="ana"
        vehicles={[]}
        leads={[]}
        clients={[makeClient({ id: 13 })]}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('Ana Lopez'))
    expect(onSelect).toHaveBeenCalledWith('client', 13)
  })

  it('is case-insensitive', () => {
    render(
      <GlobalSearchResults query="SEAT" vehicles={[makeVehicle()]} leads={[]} clients={[]} onSelect={vi.fn()} />
    )
    expect(screen.getByText(/Seat Ibiza/)).toBeInTheDocument()
  })
})
