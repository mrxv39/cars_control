import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StockDetailView } from '../components/StockDetailView'
import { invoke } from '@tauri-apps/api/core'
import type { StockVehicle } from '../types'

const mockInvoke = invoke as ReturnType<typeof vi.fn>

function makeVehicle(overrides: Partial<StockVehicle> = {}): StockVehicle {
  return {
    name: 'Seat Ibiza 2019',
    folder_path: '/stock/seat-ibiza',
    ad_info: null,
    estado: 'disponible',
    precio_compra: 8500,
    precio_venta: 10500,
    km: 125000,
    anio: 2019,
    ...overrides,
  }
}

const defaultProps = {
  vehicle: makeVehicle(),
  thumbnail: null,
  submitting: false,
  onSave: vi.fn(),
  onDelete: vi.fn(),
  onBack: vi.fn(),
}

describe('StockDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue([])
  })

  it('renders vehicle name in header', () => {
    render(<StockDetailView {...defaultProps} />)
    expect(screen.getByText('Seat Ibiza 2019')).toBeInTheDocument()
  })

  it('shows form fields with vehicle data', () => {
    render(<StockDetailView {...defaultProps} />)
    expect(screen.getByLabelText('Marca y modelo')).toHaveValue('Seat Ibiza 2019')
    expect(screen.getByLabelText('Año')).toHaveValue(2019)
    expect(screen.getByLabelText('Kilometros')).toHaveValue(125000)
    expect(screen.getByLabelText('Precio compra')).toHaveValue(8500)
    expect(screen.getByLabelText('Precio venta')).toHaveValue(10500)
  })

  it('back button calls onBack', () => {
    render(<StockDetailView {...defaultProps} />)
    fireEvent.click(screen.getByText('Volver al stock'))
    expect(defaultProps.onBack).toHaveBeenCalled()
  })

  it('delete button calls onDelete', () => {
    render(<StockDetailView {...defaultProps} />)
    fireEvent.click(screen.getByText('Eliminar'))
    expect(defaultProps.onDelete).toHaveBeenCalledWith('/stock/seat-ibiza', 'Seat Ibiza 2019')
  })

  it('shows "Guardar cambios" submit button', () => {
    render(<StockDetailView {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('estado selector shows options disponible, reservado, vendido', () => {
    render(<StockDetailView {...defaultProps} />)
    const select = screen.getByLabelText('Estado')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Disponible' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Reservado' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Vendido' })).toBeInTheDocument()
  })

  it('shows photo section title "Fotografias"', () => {
    render(<StockDetailView {...defaultProps} />)
    expect(screen.getByText('Fotografias')).toBeInTheDocument()
  })

  it('shows "Cargando fotos..." initially', () => {
    // invoke resolves async, so on first render loadingPhotos is true
    mockInvoke.mockReturnValue(new Promise(() => {}))
    render(<StockDetailView {...defaultProps} />)
    expect(screen.getByText('Cargando fotos...')).toBeInTheDocument()
  })
})
