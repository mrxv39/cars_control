import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StockView } from '../components/StockView'
import type { StockVehicle } from '../types'

function makeVehicle(overrides: Partial<StockVehicle> = {}): StockVehicle {
  return {
    name: 'Seat Ibiza 2019',
    folder_path: '/stock/seat-ibiza',
    ad_info: null,
    estado: 'disponible',
    ...overrides,
  }
}

describe('StockView', () => {
  const defaultProps = {
    stock: [
      makeVehicle({ name: 'Seat Ibiza 2019', folder_path: '/a' }),
      makeVehicle({ name: 'Ford Focus 2020', folder_path: '/b', anio: 2020 }),
      makeVehicle({ name: 'BMW Serie 3', folder_path: '/c', precio_venta: 15000 }),
    ],
    stockCount: '3 vehículos',
    thumbnails: {} as Record<string, string | null>,
    onCreateVehicle: vi.fn(),
    onEditVehicle: vi.fn(),
    onReload: vi.fn(),
  }

  it('renders all vehicles', () => {
    render(<StockView {...defaultProps} />)
    expect(screen.getByText('Seat Ibiza 2019')).toBeInTheDocument()
    expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
    expect(screen.getByText('BMW Serie 3')).toBeInTheDocument()
  })

  it('filters vehicles by search', () => {
    render(<StockView {...defaultProps} />)
    const searchInput = screen.getByPlaceholderText(/Buscar por marca/i)
    fireEvent.change(searchInput, { target: { value: 'ford' } })
    expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
  })

  it('filters by year', () => {
    render(<StockView {...defaultProps} />)
    const searchInput = screen.getByPlaceholderText(/Buscar por marca/i)
    fireEvent.change(searchInput, { target: { value: '2020' } })
    expect(screen.getByText('Ford Focus 2020')).toBeInTheDocument()
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
  })

  it('shows no results for unknown search', () => {
    render(<StockView {...defaultProps} />)
    const searchInput = screen.getByPlaceholderText(/Buscar por marca/i)
    fireEvent.change(searchInput, { target: { value: 'tesla' } })
    expect(screen.getByText('0 resultados')).toBeInTheDocument()
  })

  it('shows stock count', () => {
    render(<StockView {...defaultProps} />)
    expect(screen.getByText('3 vehículos')).toBeInTheDocument()
  })

  it('calls onCreateVehicle when button clicked', () => {
    render(<StockView {...defaultProps} />)
    fireEvent.click(screen.getByText('Añadir vehículo'))
    expect(defaultProps.onCreateVehicle).toHaveBeenCalled()
  })
})
