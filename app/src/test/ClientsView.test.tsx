import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClientsView } from '../components/ClientsView'
import type { Client, StockVehicle, Lead } from '../types'

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    name: 'Pedro López',
    phone: '698765432',
    email: 'pedro@example.com',
    dni: '12345678A',
    notes: '',
    vehicle_folder_path: null,
    source_lead_id: null,
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

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    name: 'Juan García',
    phone: '612345678',
    email: 'juan@example.com',
    notes: '',
    vehicle_interest: '',
    vehicle_folder_path: null,
    converted_client_id: null,
    ...overrides,
  }
}

describe('ClientsView', () => {
  const clientsList = [
    makeClient({ id: 1, name: 'Pedro López', phone: '698765432', dni: '12345678A' }),
    makeClient({ id: 2, name: 'Ana Martínez', phone: '611222333', email: 'ana@test.com', dni: '87654321B', source_lead_id: 5 }),
    makeClient({ id: 3, name: 'Luis Fernández', phone: '655444111', dni: '', vehicle_folder_path: '/stock/seat-ibiza' }),
  ]
  const stock = [makeVehicle()]
  const leads = [makeLead({ id: 5, name: 'Ana (lead)' })]

  const defaultProps = {
    clients: clientsList,
    filteredClients: clientsList,
    clientSearch: '',
    setClientSearch: vi.fn(),
    stock,
    leads,
    onCreateClient: vi.fn(),
    onEditClient: vi.fn(),
    onDeleteClient: vi.fn(),
    onReload: vi.fn(),
  }

  it('renders all clients', () => {
    render(<ClientsView {...defaultProps} />)
    expect(screen.getByText('Pedro López')).toBeInTheDocument()
    expect(screen.getByText('Ana Martínez')).toBeInTheDocument()
    expect(screen.getByText('Luis Fernández')).toBeInTheDocument()
  })

  it('shows correct client count', () => {
    render(<ClientsView {...defaultProps} />)
    expect(screen.getByText('3 clientes registrados')).toBeInTheDocument()
  })

  it('shows filtered count when searching', () => {
    render(<ClientsView {...defaultProps} filteredClients={[clientsList[0]]} clientSearch="pedro" />)
    expect(screen.getByText('1 de 3 clientes visible')).toBeInTheDocument()
  })

  it('calls setClientSearch on input change', () => {
    const setClientSearch = vi.fn()
    render(<ClientsView {...defaultProps} setClientSearch={setClientSearch} />)
    const input = screen.getByPlaceholderText(/Nombre, teléfono/i)
    fireEvent.change(input, { target: { value: 'pedro' } })
    expect(setClientSearch).toHaveBeenCalledWith('pedro')
  })

  it('calls onCreateClient when button is clicked', () => {
    render(<ClientsView {...defaultProps} />)
    fireEvent.click(screen.getByText('Añadir client'))
    expect(defaultProps.onCreateClient).toHaveBeenCalled()
  })

  it('calls onEditClient when edit button is clicked', () => {
    render(<ClientsView {...defaultProps} />)
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    expect(defaultProps.onEditClient).toHaveBeenCalledWith(clientsList[0])
  })

  it('calls onDeleteClient when delete button is clicked', () => {
    render(<ClientsView {...defaultProps} />)
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    expect(defaultProps.onDeleteClient).toHaveBeenCalledWith(1, 'Pedro López')
  })

  it('shows DNI when available', () => {
    render(<ClientsView {...defaultProps} />)
    expect(screen.getByText(/DNI\/NIF:.*12345678A/)).toBeInTheDocument()
  })

  it('shows lead origin when source_lead_id is set', () => {
    render(<ClientsView {...defaultProps} />)
    expect(screen.getByText('Lead origen: Ana (lead)')).toBeInTheDocument()
  })

  it('shows linked vehicle name', () => {
    render(<ClientsView {...defaultProps} />)
    expect(screen.getByText('Vehículo vinculado: Seat Ibiza 2019')).toBeInTheDocument()
  })

  it('shows empty state when no clients', () => {
    render(<ClientsView {...defaultProps} clients={[]} filteredClients={[]} />)
    expect(screen.getByText('No hay clientes registrados')).toBeInTheDocument()
  })

  it('shows no-match state when filter yields no results', () => {
    render(<ClientsView {...defaultProps} filteredClients={[]} clientSearch="zzz" />)
    expect(screen.getByText('No hay clients que coincidan')).toBeInTheDocument()
  })
})
