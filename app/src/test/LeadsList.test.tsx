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
  suggestLeadReply: vi.fn(),
  sendLeadReply: vi.fn(),
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
  vi.mocked(api.suggestLeadReply).mockResolvedValue({ ok: true, reply: 'Buenas!!', language: 'es' })
  vi.mocked(api.sendLeadReply).mockResolvedValue({ ok: true, gmail_message_id: 'gid', lead_message_id: 1 })
})

// ── Empty state ─────────────────────────────────────────────────────────

describe('LeadsList — empty state', () => {
  it('shows empty state when no leads', () => {
    render(<LeadsList {...defaultProps} />)
    expect(screen.getByText('Sin leads todavía')).toBeInTheDocument()
  })

  it('does not render search when no leads', () => {
    render(<LeadsList {...defaultProps} />)
    expect(screen.queryByPlaceholderText('Buscar lead...')).not.toBeInTheDocument()
  })
})

// ── Lista de contactos ──────────────────────────────────────────────────

describe('LeadsList — lista', () => {
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

  it('renders all lead names in list', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    expect(screen.getByText('Juan García')).toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.getByText('Pedro Ruiz')).toBeInTheDocument()
  })

  it('shows filter buttons with counts', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    expect(screen.getByText(/Sin contestar/)).toBeInTheDocument()
    expect(screen.getByText(/Todos/)).toBeInTheDocument()
  })

  it('shows coches.net badge for coches.net leads', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    const badges = screen.getAllByText('coches.net')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows vehicle interest when present (in list card)', () => {
    render(<LeadsList {...defaultProps} leads={[makeLead({ vehicle_interest: 'BMW Serie 3' })]} />)
    expect(screen.getByText(/BMW Serie 3/)).toBeInTheDocument()
  })

  it('shows "Convertido" badge for converted leads', () => {
    render(<LeadsList {...defaultProps} leads={[makeLead({ converted_client_id: 5 })]} />)
    expect(screen.getByText('Convertido')).toBeInTheDocument()
  })

  it('shows empty-detail placeholder when no lead is selected', () => {
    render(<LeadsList {...defaultProps} leads={leads} />)
    expect(screen.getByText(/Selecciona un contacto/)).toBeInTheDocument()
  })
})

// ── Búsqueda ────────────────────────────────────────────────────────────

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

  // Audit 2026-04-22: el buscador ignoraba el email; Ricard escribía "pedro@"
  // y no encontraba al lead. Ahora también busca por email y vehicle_interest
  // con fallback tolerante a campos null.
  it('filters by email via search', () => {
    const withEmail = [
      makeLead({ id: 1, name: 'Ana Torres', phone: '600111222', email: 'ana@gmail.com' }),
      makeLead({ id: 2, name: 'Carlos Díaz', phone: '600333444', email: 'carlos@acme.es' }),
    ]
    render(<LeadsList {...defaultProps} leads={withEmail} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar lead...'), { target: { value: 'acme' } })
    expect(screen.getByText('Carlos Díaz')).toBeInTheDocument()
    expect(screen.queryByText('Ana Torres')).not.toBeInTheDocument()
  })

  it('search does not crash when a lead field is null', () => {
    const withNull = [
      makeLead({ id: 1, name: 'Ana', phone: '600111222', email: null as unknown as string, vehicle_interest: null as unknown as string }),
    ]
    render(<LeadsList {...defaultProps} leads={withNull} />)
    fireEvent.change(screen.getByPlaceholderText('Buscar lead...'), { target: { value: 'ana' } })
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })
})

// ── Filtros de estado ───────────────────────────────────────────────────

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

  // Audit 2026-04-22: counts de filtros ahora son particiones disjuntas;
  // sin_contestar + activos + cerrados == todos.
  it('shows disjoint counts: sin_contestar + activos + cerrados = todos', () => {
    const many = [
      makeLead({ id: 1, estado: 'nuevo' }),
      makeLead({ id: 2, estado: '', phone: '600000002' }),
      makeLead({ id: 3, estado: 'contactado', phone: '600000003' }),
      makeLead({ id: 4, estado: 'negociando', phone: '600000004' }),
      makeLead({ id: 5, estado: 'cerrado', phone: '600000005' }),
      makeLead({ id: 6, estado: 'perdido', phone: '600000006' }),
    ]
    render(<LeadsList {...defaultProps} leads={many} />)
    // 6 en total, 2 sin_contestar (nuevo+vacío), 2 activos (contactado+negociando), 2 cerrados (cerrado+perdido)
    const textOf = (label: string) => screen.getByText(label).closest('button')?.textContent ?? ''
    expect(textOf('Sin contestar')).toMatch(/\(2\)/)
    expect(textOf('Activos')).toMatch(/\(2\)/)
    expect(textOf('Cerrados')).toMatch(/\(2\)/)
    expect(textOf('Todos')).toMatch(/\(6\)/)
  })

  it('"Activos" filter excludes nuevos and cerrados', () => {
    const many = [
      makeLead({ id: 1, name: 'NuevoLead', estado: 'nuevo' }),
      makeLead({ id: 2, name: 'ActivoLead', estado: 'contactado', phone: '600000002' }),
      makeLead({ id: 3, name: 'CerradoLead', estado: 'cerrado', phone: '600000003' }),
    ]
    render(<LeadsList {...defaultProps} leads={many} />)
    fireEvent.click(screen.getByText(/^Activos/))
    expect(screen.getByText('ActivoLead')).toBeInTheDocument()
    expect(screen.queryByText('NuevoLead')).not.toBeInTheDocument()
    expect(screen.queryByText('CerradoLead')).not.toBeInTheDocument()
  })
})

// ── Selección y detalle ─────────────────────────────────────────────────

describe('LeadsList — selección y detalle', () => {
  const lead = makeLead({ id: 1, name: 'Juan García', estado: 'nuevo', canal: 'coches.net' })

  it('clicking a lead in the list shows its detail header', async () => {
    render(<LeadsList {...defaultProps} leads={[lead]} />)
    fireEvent.click(screen.getByText('Juan García'))
    await waitFor(() => {
      expect(screen.getByText('Mensaje')).toBeInTheDocument()
      expect(screen.getByText('juan@example.com')).toBeInTheDocument()
    })
  })

  it('shows action buttons only after selecting a lead', () => {
    render(<LeadsList {...defaultProps} leads={[lead]} />)
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Juan García'))
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Eliminar')).toBeInTheDocument()
    expect(screen.getByText('Notas')).toBeInTheDocument()
  })
})

// ── Edit mode ───────────────────────────────────────────────────────────

describe('LeadsList — edit mode', () => {
  const lead = makeLead({ id: 1, name: 'Juan García', estado: 'nuevo' })

  it('enters edit mode on Editar click', () => {
    render(<LeadsList {...defaultProps} leads={[lead]} />)
    fireEvent.click(screen.getByText('Juan García'))
    fireEvent.click(screen.getByText('Editar'))
    expect(screen.getByPlaceholderText('Nombre')).toBeInTheDocument()
  })

  it('saves changes and calls onReload', async () => {
    const onReload = vi.fn()
    render(<LeadsList {...defaultProps} leads={[lead]} onReload={onReload} />)
    fireEvent.click(screen.getByText('Juan García'))
    fireEvent.click(screen.getByText('Editar'))
    fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { value: 'Juan Modificado' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => {
      expect(api.updateLead).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Juan Modificado' }))
      expect(onReload).toHaveBeenCalled()
    })
  })

  // Audit 2026-04-22: canal ya no es editable desde el form. coches.net viene
  // automático del sync; WhatsApp/llamadas/walk-in no son leads en este CRM.
  it('does not expose a canal selector in edit mode', () => {
    render(<LeadsList {...defaultProps} leads={[lead]} />)
    fireEvent.click(screen.getByText('Juan García'))
    fireEvent.click(screen.getByText('Editar'))
    expect(screen.queryByRole('option', { name: 'WhatsApp' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Llamada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Visita presencial' })).not.toBeInTheDocument()
  })
})

// ── Sugerir y Enviar (AI + Gmail) ───────────────────────────────────────

describe('LeadsList — composer (sugerir y enviar)', () => {
  const leadCochesNet = makeLead({ id: 1, name: 'Jose Luis', estado: 'nuevo', canal: 'coches.net' })
  const leadWeb = makeLead({ id: 2, name: 'Ana Web', estado: 'nuevo', canal: 'web', phone: '600000002' })

  it('does not show composer buttons without a selected lead', () => {
    render(<LeadsList {...defaultProps} leads={[leadCochesNet]} />)
    expect(screen.queryByText(/Sugerir/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Enviar/)).not.toBeInTheDocument()
  })

  it('shows composer after selecting any lead', () => {
    render(<LeadsList {...defaultProps} leads={[leadWeb]} />)
    fireEvent.click(screen.getByText('Ana Web'))
    expect(screen.getByPlaceholderText('Escribe tu mensaje...')).toBeInTheDocument()
    expect(screen.getByText(/Sugerir/)).toBeInTheDocument()
    expect(screen.getByText(/Enviar/)).toBeInTheDocument()
  })

  it('Sugerir fills the textarea with the API reply', async () => {
    vi.mocked(api.suggestLeadReply).mockResolvedValue({ ok: true, reply: 'Buenas Jose Luis!! Soy Ricard', language: 'es' })
    render(<LeadsList {...defaultProps} leads={[leadCochesNet]} />)
    fireEvent.click(screen.getByText('Jose Luis'))
    fireEvent.click(screen.getByText(/Sugerir/))
    await waitFor(() => {
      expect(api.suggestLeadReply).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('Escribe tu mensaje...') as HTMLTextAreaElement
      expect(textarea.value).toBe('Buenas Jose Luis!! Soy Ricard')
    })
  })

  it('Sugerir shows language badge when language present', async () => {
    vi.mocked(api.suggestLeadReply).mockResolvedValue({ ok: true, reply: 'bona', language: 'ca' })
    render(<LeadsList {...defaultProps} leads={[leadCochesNet]} />)
    fireEvent.click(screen.getByText('Jose Luis'))
    fireEvent.click(screen.getByText(/Sugerir/))
    await waitFor(() => {
      expect(screen.getByText('CA')).toBeInTheDocument()
    })
  })

  it('Sugerir on error shows warning and fills with fallback', async () => {
    vi.mocked(api.suggestLeadReply).mockResolvedValue({
      ok: false,
      reply: 'Buenas Jose!! Soy Ricard de CodinaCars.',
      language: 'es',
      error: 'Claude API 500: boom',
    })
    render(<LeadsList {...defaultProps} leads={[leadCochesNet]} />)
    fireEvent.click(screen.getByText('Jose Luis'))
    fireEvent.click(screen.getByText(/Sugerir/))
    await waitFor(() => {
      expect(screen.getByText(/Plantilla de respaldo/)).toBeInTheDocument()
      const textarea = screen.getByPlaceholderText('Escribe tu mensaje...') as HTMLTextAreaElement
      expect(textarea.value).toContain('Ricard')
    })
  })

  it('Enviar calls sendLeadReply with current draft text', async () => {
    render(<LeadsList {...defaultProps} leads={[leadCochesNet]} />)
    fireEvent.click(screen.getByText('Jose Luis'))
    const textarea = screen.getByPlaceholderText('Escribe tu mensaje...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Escrito por Ricard' } })
    fireEvent.click(screen.getByText(/Enviar/))
    await waitFor(() => {
      expect(api.sendLeadReply).toHaveBeenCalledWith(1, 'Escrito por Ricard')
    })
  })

  it('Enviar is disabled when textarea is empty', () => {
    render(<LeadsList {...defaultProps} leads={[leadCochesNet]} />)
    fireEvent.click(screen.getByText('Jose Luis'))
    const sendBtn = screen.getByRole('button', { name: /Enviar mensaje/i })
    expect(sendBtn).toBeDisabled()
  })
})

// ── Notas ───────────────────────────────────────────────────────────────

describe('LeadsList — notas', () => {
  const lead = makeLead({ id: 1, name: 'María', estado: 'contactado' })

  it('opens notes panel on Notas click (after selecting lead)', async () => {
    vi.mocked(api.listLeadNotes).mockResolvedValue([])
    render(<LeadsList {...defaultProps} leads={[lead]} />)
    fireEvent.click(screen.getByText('María'))
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
    fireEvent.click(screen.getByText('María'))
    fireEvent.click(screen.getByText('Notas'))
    await waitFor(() => {
      expect(screen.getByText('Llamar mañana')).toBeInTheDocument()
    })
  })
})

// ── Deep-link vía initialLeadId ─────────────────────────────────────────

describe('LeadsList — initialLeadId (deep-link desde ficha vehículo)', () => {
  const leads = [
    makeLead({ id: 1, name: 'Ana Martínez', canal: 'coches.net' }),
    makeLead({ id: 2, name: 'Carlos Ruiz', canal: 'coches.net' }),
  ]

  it('abre la conversación del lead indicado al montar', async () => {
    render(<LeadsList {...defaultProps} leads={leads} initialLeadId={2} />)
    // Al seleccionar el lead 2, su item de lista recibe aria-selected="true"
    // y desaparece el placeholder "Selecciona un contacto...".
    await waitFor(() => {
      const selectedOption = screen.getByRole('option', { selected: true })
      expect(selectedOption).toHaveTextContent('Carlos Ruiz')
    })
    expect(screen.queryByText(/Selecciona un contacto/)).not.toBeInTheDocument()
  })

  it('mantiene el placeholder de detalle cuando initialLeadId es null', () => {
    render(<LeadsList {...defaultProps} leads={leads} initialLeadId={null} />)
    expect(screen.getByText(/Selecciona un contacto/)).toBeInTheDocument()
  })
})
