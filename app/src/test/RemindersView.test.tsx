import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RemindersView } from '../components/RemindersView'
import { Lead } from '../types'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    name: 'Juan García',
    phone: '666111222',
    email: 'juan@test.com',
    notes: '',
    vehicle_interest: 'SEAT Leon',
    vehicle_folder_path: null,
    converted_client_id: null,
    ...overrides,
  }
}

const noop = () => {}

describe('RemindersView — filtering logic', () => {
  it('muestra leads nuevos sin fecha_contacto', () => {
    const leads = [
      makeLead({ id: 1, name: 'Lead Nuevo', estado: 'nuevo', fecha_contacto: null }),
    ]

    render(
      <RemindersView leads={leads} stock={[]} onEditLead={noop} onReload={noop} />
    )

    expect(screen.getByText('Lead Nuevo')).toBeInTheDocument()
    expect(screen.getByText(/Leads nuevos sin primer contacto/)).toBeInTheDocument()
  })

  it('muestra leads con fecha_contacto anterior al umbral', () => {
    // 10 días atrás — debería aparecer con umbral default de 7
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const leads = [
      makeLead({ id: 2, name: 'Lead Antiguo', estado: 'contactado', fecha_contacto: tenDaysAgo }),
    ]

    render(
      <RemindersView leads={leads} stock={[]} onEditLead={noop} onReload={noop} />
    )

    expect(screen.getByText('Lead Antiguo')).toBeInTheDocument()
    expect(screen.getByText(/Sin contacto/)).toBeInTheDocument()
  })

  it('NO muestra leads con fecha_contacto reciente (dentro del umbral)', () => {
    // 2 días atrás — NO debería aparecer
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const leads = [
      makeLead({ id: 3, name: 'Lead Reciente', estado: 'contactado', fecha_contacto: twoDaysAgo }),
    ]

    render(
      <RemindersView leads={leads} stock={[]} onEditLead={noop} onReload={noop} />
    )

    expect(screen.queryByText('Lead Reciente')).not.toBeInTheDocument()
    expect(screen.getByText(/Todos los leads están al día/)).toBeInTheDocument()
  })

  it('excluye leads con estado "cerrado" o "perdido"', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const leads = [
      makeLead({ id: 4, name: 'Lead Cerrado', estado: 'cerrado', fecha_contacto: thirtyDaysAgo }),
      makeLead({ id: 5, name: 'Lead Perdido', estado: 'perdido', fecha_contacto: null }),
    ]

    render(
      <RemindersView leads={leads} stock={[]} onEditLead={noop} onReload={noop} />
    )

    expect(screen.queryByText('Lead Cerrado')).not.toBeInTheDocument()
    expect(screen.queryByText('Lead Perdido')).not.toBeInTheDocument()
    expect(screen.getByText(/Todos los leads están al día/)).toBeInTheDocument()
  })

  it('respeta daysThreshold custom', () => {
    // 3 días atrás — debería aparecer con umbral de 2 pero no con 7
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const leads = [
      makeLead({ id: 6, name: 'Lead Umbral', estado: 'contactado', fecha_contacto: threeDaysAgo }),
    ]

    const { unmount } = render(
      <RemindersView leads={leads} stock={[]} onEditLead={noop} onReload={noop} daysThreshold={2} />
    )
    expect(screen.getByText('Lead Umbral')).toBeInTheDocument()
    unmount()

    render(
      <RemindersView leads={leads} stock={[]} onEditLead={noop} onReload={noop} daysThreshold={7} />
    )
    expect(screen.queryByText('Lead Umbral')).not.toBeInTheDocument()
  })

  it('muestra el conteo correcto de leads que requieren atención', () => {
    const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    const leads = [
      makeLead({ id: 10, name: 'Lead A', estado: 'nuevo', fecha_contacto: null }),
      makeLead({ id: 11, name: 'Lead B', estado: 'contactado', fecha_contacto: oldDate }),
      makeLead({ id: 12, name: 'Lead C', estado: 'cerrado', fecha_contacto: null }), // excluido
    ]

    render(
      <RemindersView leads={leads} stock={[]} onEditLead={noop} onReload={noop} />
    )

    expect(screen.getByRole('status')).toHaveTextContent('2 leads requieren atención')
  })

  it('llama onEditLead al hacer click en Contactar ahora', async () => {
    const onEditLead = vi.fn()
    const lead = makeLead({ id: 20, name: 'Lead Click', estado: 'nuevo', fecha_contacto: null })

    render(
      <RemindersView leads={[lead]} stock={[]} onEditLead={onEditLead} onReload={noop} />
    )

    screen.getByText('Contactar ahora').click()
    expect(onEditLead).toHaveBeenCalledWith(lead)
  })
})
