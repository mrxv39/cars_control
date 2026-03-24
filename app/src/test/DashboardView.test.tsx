import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardView } from '../components/DashboardView'
import type { StockVehicle, Lead } from '../types'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    name: 'Test Lead',
    phone: '600000000',
    email: 'test@test.com',
    notes: '',
    vehicle_interest: 'SUV',
    vehicle_folder_path: null,
    converted_client_id: null,
    ...overrides,
  }
}

function makeVehicle(overrides: Partial<StockVehicle> = {}): StockVehicle {
  return {
    name: 'Seat Ibiza',
    folder_path: '/stock/seat-ibiza',
    ad_info: null,
    ...overrides,
  }
}

describe('DashboardView', () => {
  const defaultProps = {
    stock: [] as StockVehicle[],
    leads: [] as Lead[],
    onReload: vi.fn(),
    onNavigate: vi.fn(),
  }

  it('renders with empty data', () => {
    render(<DashboardView {...defaultProps} />)
    expect(screen.getByText('Estado del negocio')).toBeInTheDocument()
  })

  it('counts stock by estado correctly', () => {
    const stock = [
      makeVehicle({ name: 'A', folder_path: '/a', estado: 'disponible' }),
      makeVehicle({ name: 'B', folder_path: '/b', estado: 'disponible' }),
      makeVehicle({ name: 'C', folder_path: '/c', estado: 'reservado' }),
      makeVehicle({ name: 'D', folder_path: '/d', estado: 'vendido' }),
    ]
    render(<DashboardView {...defaultProps} stock={stock} />)
    // 2 disponibles, 1 reservado, 1 vendido
    expect(screen.getByText('Disponibles').previousElementSibling?.textContent).toBe('2')
    expect(screen.getByText('Reservados').previousElementSibling?.textContent).toBe('1')
    expect(screen.getByText('Vendidos').previousElementSibling?.textContent).toBe('1')
  })

  it('calculates potential profit correctly', () => {
    const stock = [
      makeVehicle({ precio_compra: 5000, precio_venta: 8000 }),
      makeVehicle({ name: 'B', folder_path: '/b', precio_compra: 3000, precio_venta: 5500 }),
      makeVehicle({ name: 'C', folder_path: '/c' }), // no prices, should be ignored
    ]
    render(<DashboardView {...defaultProps} stock={stock} />)
    // 3000 + 2500 = 5500€ potential profit — rendered via toLocaleString("es-ES")
    expect(screen.getByText(/5\.?500/)).toBeInTheDocument()
  })

  it('counts lead statuses', () => {
    const leads = [
      makeLead({ id: 1, estado: 'nuevo' }),
      makeLead({ id: 2, estado: 'contactado' }),
      makeLead({ id: 3, estado: 'negociando' }),
      makeLead({ id: 4, estado: 'cerrado' }),
      makeLead({ id: 5, estado: 'perdido' }),
      makeLead({ id: 6 }), // no estado = nuevo
    ]
    render(<DashboardView {...defaultProps} leads={leads} />)
    // 2 nuevos (id 1 + id 6), 2 activos (contactado + negociando), 1 cerrado, 1 perdido
    expect(screen.getByText('Nuevos').previousElementSibling?.textContent).toBe('2')
    expect(screen.getByText('En negociación').previousElementSibling?.textContent).toBe('2')
  })

  it('shows reload button', () => {
    render(<DashboardView {...defaultProps} />)
    expect(screen.getByText('Recargar')).toBeInTheDocument()
  })
})
