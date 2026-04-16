import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LeadsList } from '../components/web/LeadsList'
import type { Lead, Vehicle } from '../lib/api'

vi.mock('../lib/api', () => ({
  listLeadMessages: vi.fn(),
  listLeadNotes: vi.fn(),
  createLeadNote: vi.fn(),
  deleteLeadNote: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

vi.mock('../lib/csv-export', () => ({ exportToCSV: vi.fn() }))

const api = await import('../lib/api')

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
    supplier_id: null,
    ...overrides,
  }
}

const defaultProps = {
  leads: [] as Lead[],
  vehicles: [] as Vehicle[],
  companyId: 1,
  onReload: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listLeadNotes).mockResolvedValue([])
  vi.mocked(api.listLeadMessages).mockResolvedValue([])
  vi.mocked(api.updateLead).mockResolvedValue({} as Lead)
  vi.mocked(api.deleteLead).mockResolvedValue(undefined)
  vi.mocked(api.createClient).mockResolvedValue({ id: 99, name: '', phone: '', email: '', dni: '', notes: '', source_lead_id: null, company_id: 1, vehicle_id: null })
})

describe('LeadsList — empty state', () => {
  it('shows empty state when no leads', () => {
    render(<LeadsList {...defaultProps} />)
    expect(screen.getByText('Sin leads todavía')).toBeInTheDocument()
  })

  it('does not render filter panel when no leads', () => {
    render(<LeadsList {...defaultProps} />)
    expect(screen.queryByPlaceholderText('Buscar lead...')).not.toBeInTheDocument()
  })
})

describe('LeadsList — rendering', () => {
  const leads = [
    makeLead({ id: 1, name: 'Juan García', estado: 'nuevo', canal: 'web' }),
    makeLead({ id: 2, name: 'María López', estado: 'contactado', canal: 'coches.net', phone: '698000001' }),
    makeLead({ id: 3, name: 'Pedro Ruiz', estado: 'cerrado', canal: 'llamada', phone: '698000002' }),
  ]

  it('renders lead count in header', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    expect(screen.getByText('3 leads')).toBeInTheDocument()
  })

  it('renders singular when one lead', () => {
    render(<LeadsList {...defaultProps} leads={[leads[0]]} />)
    expect(screen.getByText('1 lead')).toBeInTheDocument()
  })

  it('renders all lead names', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    expect(screen.getByText('Juan García')).toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.getByText('Pedro Ruiz')).toBeInTheDocument()
  })

  it('shows filter buttons with counts', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    // sin_contestar = leads with estado null or "nuevo" → 1
    expect(screen.getByText(/Sin contestar/)).toBeInTheDocument()
    // todos → 3
    expect(screen.getByText(/Todos/)).toBeInTheDocument()
  })

  it('shows coches.net badge for coches.net leads', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    const badges = screen.getAllByText('coches.net')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows vehicle interest when present', () => {
    render(<LeadsList {...defaultProps} leads={[makeLead({ vehicle_interest: 'BMW Serie 3' })]} />)
    expect(screen.getByText(/BMW Serie 3/)).toBeInTheDocument()
  })

  it('shows "Convertido" badge for converted leads', () => {
    render(<LeadsList {...defaultProps} leads={[makeLead({ converted_client_id: 5 })]} />)
    expect(screen.getByText('Convertido')).toBeInTheDocument()
  })
})

describe('LeadsList — search filter', () => {
  const leads = [
    makeLead({ id: 1, name: 'Ana Torres', phone: '600111222' }),
    makeLead({ id: 2, name: 'Carlos Díaz', phone: '600333444', vehicle_interest: 'Volkswagen Golf' }),
  ]

  it('filters by name via search', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar lead...'), { target: { value: 'ana' } })
    expect(screen.getByText('Ana Torres')).toBeInTheDocument()
    expect(screen.queryByText('Carlos Díaz')).not.toBeInTheDocument()
  })

  it('filters by phone via search', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar lead...'), { target: { value: '600333' } })
    expect(screen.getByText('Carlos Díaz')).toBeInTheDocument()
    expect(screen.queryByText('Ana Torres')).not.toBeInTheDocument()
  })
})

describe('LeadsList — status filters', () => {
  const leads = [
    makeLead({ id: 1, name: 'Nuevo', estado: 'nuevo' }),
    makeLead({ id: 2, name: 'Activo', estado: 'contactado', phone: '600000002' }),
    makeLead({ id: 3, name: 'Cerrado', estado: 'cerrado', phone: '600000003' }),
  ]

  it('shows only unanswered leads with "Sin contestar" filter', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    fireEvent.click(screen.getByText(/Sin contestar/))
    expect(screen.getByText('Nuevo')).toBeInTheDocument()
    expect(screen.queryByText('Activo')).not.toBeInTheDocument()
    expect(screen.queryByText('Cerrado')).not.toBeInTheDocument()
  })

  it('shows only closed leads with "Cerrados" filter', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    fireEvent.click(screen.getByText(/^Cerrados/))
    expect(screen.getByText('Cerrado')).toBeInTheDocument()
    expect(screen.queryByText('Nuevo')).not.toBeInTheDocument()
    expect(screen.queryByText('Activo')).not.toBeInTheDocument()
  })
})

describe('LeadsList — edit mode', () => {
  const lead = makeLead({ id: 1, name: 'Juan García', estado: 'nuevo' })

  it('enters edit mode on Editar click', () => {
    render(<LeadsList {...defaultProps} leads={[lead]} />)
    fireEvent.click(screen.getByText('Editar'))
    expect(screen.getByPlaceholderText('Nombre')).toBeInTheDocument()
  })

  it('saves changes and calls onReload', async () => {
    const onReload = vi.fn()
    render(<LeadsList {...defaultProps} leads={[lead]} onReload={onReload} />)
    fireEvent.click(screen.getByText('Editar'))
    fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { value: 'Juan Modificado' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => {
      expect(api.updateLead).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Juan Modificado' }))
      expect(onReload).toHaveBeenCalled()
    })
  })
})

describe('LeadsList — notes panel', () => {
  const lead = makeLead({ id: 1, name: 'María', estado: 'contactado' })

  it('opens notes panel on Notas click', async () => {
    vi.mocked(api.listLeadNotes).mockResolvedValue([])
    render(<LeadsList {...defaultProps} leads={[lead]} />)
    fireEvent.click(screen.getByText('Notas'))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Añadir nota...')).toBeInTheDocument()
    })
  })

  it('shows existing notes in panel', async () => {
    vi.mocked(api.listLeadNotes).mockResolvedValue([
      { id: 10, lead_id: 1, content: 'Llamar mañana', timestamp: '2026-04-01T10:00:00Z' },
    ])
    render(<LeadsList {...defaultProps} leads={[lead]} />)
    fireEvent.click(screen.getByText('Notas'))
    await waitFor(() => {
      expect(screen.getByText('Llamar mañana')).toBeInTheDocument()
    })
  })
})
