import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeadsView } from '../components/LeadsView'
import type { Lead, StockVehicle, Client } from '../types'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    name: 'Juan García',
    phone: '612345678',
    email: 'juan@example.com',
    notes: '',
    vehicle_interest: 'Seat Ibiza',
    vehicle_folder_path: null,
    converted_client_id: null,
    estado: 'nuevo',
    fecha_contacto: '2026-01-15',
    canal: 'coches.net',
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
    email: 'pedro@example.com',
    dni: '12345678A',
    notes: '',
    vehicle_folder_path: null,
    source_lead_id: null,
    ...overrides,
  }
}

describe('LeadsView', () => {
  const leads = [
    makeLead({ id: 1, name: 'Juan García', phone: '612345678', canal: 'coches.net' }),
    makeLead({ id: 2, name: 'María López', phone: '698111222', vehicle_interest: 'BMW Serie 3', canal: 'wallapop' }),
    makeLead({ id: 3, name: 'Carlos Ruiz', phone: '677999888', converted_client_id: 10 }),
  ]
  const stock = [makeVehicle()]
  const clients = [makeClient({ id: 10, name: 'Carlos Ruiz (client)' })]

  const defaultProps = {
    leads,
    filteredLeads: leads,
    leadSearch: '',
    setLeadSearch: vi.fn(),
    stock,
    clients,
    onCreateLead: vi.fn(),
    onEditLead: vi.fn(),
    onConvertLead: vi.fn(),
    onDeleteLead: vi.fn(),
    onReload: vi.fn(),
  }

  it('renders all leads', () => {
    render(<LeadsView {...defaultProps} />)
    expect(screen.getByText('Juan García')).toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument()
  })

  it('shows correct lead count', () => {
    render(<LeadsView {...defaultProps} />)
    expect(screen.getByText('3 leads registrados')).toBeInTheDocument()
  })

  it('shows filtered count when search is active', () => {
    const filtered = [leads[0]]
    render(<LeadsView {...defaultProps} filteredLeads={filtered} leadSearch="juan" />)
    expect(screen.getByText('1 de 3 leads visibles')).toBeInTheDocument()
  })

  it('calls setLeadSearch on search input change', () => {
    const setLeadSearch = vi.fn()
    render(<LeadsView {...defaultProps} setLeadSearch={setLeadSearch} />)
    const input = screen.getByPlaceholderText(/Nombre, teléfono, interés/i)
    fireEvent.change(input, { target: { value: 'juan' } })
    expect(setLeadSearch).toHaveBeenCalledWith('juan')
  })

  it('calls onCreateLead when button is clicked', () => {
    render(<LeadsView {...defaultProps} />)
    fireEvent.click(screen.getByText('Añadir lead'))
    expect(defaultProps.onCreateLead).toHaveBeenCalled()
  })

  it('calls onEditLead when edit button is clicked', () => {
    render(<LeadsView {...defaultProps} />)
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    expect(defaultProps.onEditLead).toHaveBeenCalledWith(leads[0])
  })

  it('calls onDeleteLead when delete button is clicked', () => {
    render(<LeadsView {...defaultProps} />)
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[0])
    expect(defaultProps.onDeleteLead).toHaveBeenCalledWith(1, 'Juan García')
  })

  it('shows converted badge for converted leads', () => {
    render(<LeadsView {...defaultProps} />)
    expect(screen.getByText('Convertido')).toBeInTheDocument()
  })

  it('disables convert button for already converted leads', () => {
    render(<LeadsView {...defaultProps} />)
    const convertedButton = screen.getByText('Ya es client')
    expect(convertedButton).toBeDisabled()
  })

  it('shows empty state when no leads', () => {
    render(<LeadsView {...defaultProps} leads={[]} filteredLeads={[]} />)
    expect(screen.getByText('No hay contactos registrados')).toBeInTheDocument()
  })

  it('shows no-match state when filter yields no results', () => {
    render(<LeadsView {...defaultProps} filteredLeads={[]} leadSearch="zzz" />)
    expect(screen.getByText('No hay leads que coincidan')).toBeInTheDocument()
  })

  it('displays canal info', () => {
    render(<LeadsView {...defaultProps} />)
    const canalElements = screen.getAllByText(/^Canal:/)
    expect(canalElements.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Canal: wallapop')).toBeInTheDocument()
  })
})
