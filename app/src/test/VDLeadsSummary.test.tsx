import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VDLeadsSummary } from '../components/web/vehicle-detail/VDLeadsSummary';
import type { Lead } from '../lib/api';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    name: 'Juan Pérez',
    phone: '600000001',
    email: 'juan@example.com',
    notes: '',
    vehicle_interest: '',
    converted_client_id: null,
    estado: 'nuevo',
    fecha_contacto: '2026-04-20',
    canal: 'coches.net',
    company_id: 1,
    vehicle_id: 5,
    ...overrides,
  };
}

describe('VDLeadsSummary', () => {
  it('muestra EmptyState cuando no hay leads', () => {
    render(<VDLeadsSummary vehicleLeads={[]} onOpenLead={vi.fn()} />);
    expect(screen.getByText('Sin leads')).toBeInTheDocument();
    expect(screen.queryByText(/Ver conversaciones/)).not.toBeInTheDocument();
  });

  it('muestra contador y nombres de todos los leads', () => {
    const leads = [
      makeLead({ id: 1, name: 'Juan Pérez' }),
      makeLead({ id: 2, name: 'Ana López' }),
      makeLead({ id: 3, name: 'Marc Riu' }),
    ];
    render(<VDLeadsSummary vehicleLeads={leads} onOpenLead={vi.fn()} />);
    expect(screen.getByText('Leads (3)')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('Marc Riu')).toBeInTheDocument();
  });

  it('click en un lead invoca onOpenLead con su id', () => {
    const onOpenLead = vi.fn();
    const leads = [makeLead({ id: 42, name: 'Ana López' })];
    render(<VDLeadsSummary vehicleLeads={leads} onOpenLead={onOpenLead} />);
    fireEvent.click(screen.getByLabelText('Abrir conversación con Ana López'));
    expect(onOpenLead).toHaveBeenCalledTimes(1);
    expect(onOpenLead).toHaveBeenCalledWith(42);
  });

  it('click en CTA "Ver conversaciones" invoca onOpenLead sin argumentos', () => {
    const onOpenLead = vi.fn();
    const leads = [makeLead()];
    render(<VDLeadsSummary vehicleLeads={leads} onOpenLead={onOpenLead} />);
    fireEvent.click(screen.getByText(/Ver conversaciones/));
    expect(onOpenLead).toHaveBeenCalledTimes(1);
    expect(onOpenLead).toHaveBeenCalledWith();
  });

  it('muestra fecha compacta del último contacto', () => {
    const leads = [makeLead({ fecha_contacto: '2026-04-20' })];
    render(<VDLeadsSummary vehicleLeads={leads} onOpenLead={vi.fn()} />);
    expect(screen.getByText('20 abr')).toBeInTheDocument();
  });

  it('renderiza status-dot con la clase del estado', () => {
    const leads = [makeLead({ estado: 'contactado' })];
    const { container } = render(<VDLeadsSummary vehicleLeads={leads} onOpenLead={vi.fn()} />);
    expect(container.querySelector('.lead-status-dot.contactado')).toBeInTheDocument();
  });
});
