import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WebDashboard } from '../components/web/WebDashboard'
import type { Vehicle, Lead, SalesRecord, PurchaseRecord } from '../lib/api'

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

describe('WebDashboard', () => {
  const defaultProps = {
    vehicles: [
      makeVehicle({ id: 1, estado: 'disponible' }),
      makeVehicle({ id: 2, estado: 'reservado' }),
    ],
    allVehicles: [
      makeVehicle({ id: 1, estado: 'disponible' }),
      makeVehicle({ id: 2, estado: 'reservado' }),
      makeVehicle({ id: 3, estado: 'vendido', precio_compra: 5000, precio_venta: 8000 }),
    ],
    leads: [
      makeLead({ id: 1, estado: 'nuevo' }),
      makeLead({ id: 2, estado: 'contactado' }),
      makeLead({ id: 3, estado: 'negociando' }),
      makeLead({ id: 4, estado: 'cerrado' }),
      makeLead({ id: 5, estado: 'perdido' }),
    ],
    salesRecords: [] as SalesRecord[],
    purchaseRecords: [] as PurchaseRecord[],
    onReload: vi.fn(),
    onNavigate: vi.fn(),
  }

  it('renders dashboard header', () => {
    render(<WebDashboard {...defaultProps} />)
    expect(screen.getByText('Estado del negocio')).toBeInTheDocument()
  })

  it('shows stock disponible count', () => {
    render(<WebDashboard {...defaultProps} />)
    const card = screen.getByText('Stock disponible').closest('section')!
    expect(card).toBeInTheDocument()
    // 1 disponible (excludes reservado and vendido)
    expect(card.querySelector('.sales-stat-value')?.textContent).toBe('1')
  })

  it('shows reservados count', () => {
    render(<WebDashboard {...defaultProps} />)
    expect(screen.getByText('Reservados')).toBeInTheDocument()
  })

  it('shows vendidos count', () => {
    render(<WebDashboard {...defaultProps} />)
    expect(screen.getByText('Vendidos')).toBeInTheDocument()
  })

  it('shows lead counts by estado', () => {
    render(<WebDashboard {...defaultProps} />)
    expect(screen.getByText('Leads nuevos')).toBeInTheDocument()
    expect(screen.getByText('Contactados')).toBeInTheDocument()
    expect(screen.getByText('Negociando')).toBeInTheDocument()
  })

  it('shows cerrados and perdidos', () => {
    render(<WebDashboard {...defaultProps} />)
    expect(screen.getByText('Cerrados / Perdidos')).toBeInTheDocument()
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
  })

  it('calls onReload when Recargar is clicked', () => {
    render(<WebDashboard {...defaultProps} />)
    fireEvent.click(screen.getByText('Recargar'))
    expect(defaultProps.onReload).toHaveBeenCalled()
  })

  it('calls onNavigate when stock card is clicked', () => {
    render(<WebDashboard {...defaultProps} />)
    fireEvent.click(screen.getByText('Stock disponible').closest('[role="button"]')!)
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('stock')
  })

  it('calls onNavigate when leads card is clicked', () => {
    render(<WebDashboard {...defaultProps} />)
    fireEvent.click(screen.getByText('Leads nuevos').closest('[role="button"]')!)
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('leads')
  })

  it('shows empty state when no data', () => {
    render(<WebDashboard {...defaultProps} vehicles={[]} allVehicles={[]} leads={[]} />)
    expect(screen.getByText('Dashboard vacío')).toBeInTheDocument()
  })

  it('calculates margen potencial from vehicles with both prices', () => {
    const vehicles = [
      makeVehicle({ id: 1, precio_compra: 8000, precio_venta: 10500 }),
      makeVehicle({ id: 2, precio_compra: 5000, precio_venta: 7000 }),
    ]
    render(<WebDashboard {...defaultProps} vehicles={vehicles} />)
    // (10500-8000) + (7000-5000) = 2500 + 2000 = 4500
    expect(screen.getByText('Margen potencial')).toBeInTheDocument()
  })

  it('shows leads sin seguimiento warning for old leads', () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const leads = [
      makeLead({ id: 1, estado: 'nuevo', fecha_contacto: oldDate }),
    ]
    render(<WebDashboard {...defaultProps} leads={leads} />)
    expect(screen.getByText('Ver leads pendientes')).toBeInTheDocument()
  })

  it('shows margin report for sold vehicles', () => {
    const allVehicles = [
      makeVehicle({ id: 1, estado: 'vendido', precio_compra: 5000, precio_venta: 8000 }),
    ]
    render(<WebDashboard {...defaultProps} allVehicles={allVehicles} />)
    expect(screen.getByText('Informe de margen')).toBeInTheDocument()
    expect(screen.getByText('Margen por vehículo vendido')).toBeInTheDocument()
  })
})
