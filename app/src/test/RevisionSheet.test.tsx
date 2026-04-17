import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RevisionSheet } from '../components/web/RevisionSheet'
import type { Vehicle } from '../lib/api'

vi.mock('../lib/api', () => ({
  listVehicleInspections: vi.fn().mockResolvedValue([]),
  deleteVehicleInspection: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    company_id: 1,
    name: 'Seat Ibiza 1.0 TSI',
    precio_compra: 8000,
    precio_venta: 10500,
    km: 45000,
    anio: 2021,
    estado: 'disponible',
    ad_url: '',
    ad_status: '',
    fuel: 'Gasolina',
    cv: '',
    transmission: '',
    color: 'Blanco',
    notes: '',
    supplier_id: null,
    plate: 'AB-1234-CD',
    ...overrides,
  }
}

const defaultProps = {
  vehicles: [] as Vehicle[],
  companyId: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RevisionSheet', () => {
  it('renders title "Hoja de revisión"', () => {
    render(<RevisionSheet {...defaultProps} />)
    expect(screen.getByText('Hoja de revisión')).toBeTruthy()
  })

  it('shows vehicle selector with placeholder', () => {
    render(<RevisionSheet {...defaultProps} />)
    expect(screen.getByText('-- Seleccionar vehículo --')).toBeTruthy()
  })

  it('shows inspector name input', () => {
    render(<RevisionSheet {...defaultProps} />)
    const input = screen.getByPlaceholderText('Nombre del inspector')
    expect(input).toBeTruthy()
  })

  it('shows all 7 inspection section titles', () => {
    render(<RevisionSheet {...defaultProps} />)
    const sections = [
      'Exterior',
      'Interior',
      'Motor y mecánica',
      'Transmisión y dirección',
      'Frenos y suspensión',
      'Eléctrica',
      'Documentación',
    ]
    for (const title of sections) {
      expect(screen.getByText(title)).toBeTruthy()
    }
  })

  it('Guardar button is disabled when no vehicle is selected', () => {
    render(<RevisionSheet {...defaultProps} />)
    const btn = screen.getByRole('button', { name: 'Guardar revision' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('vehicle dropdown shows vehicle names', () => {
    const vehicles = [
      makeVehicle({ id: 1, name: 'Seat Ibiza 1.0 TSI', anio: 2021, plate: 'AB-1234-CD' }),
      makeVehicle({ id: 2, name: 'Renault Clio', anio: 2019, plate: 'ZZ-9999-ZZ' }),
    ]
    render(<RevisionSheet vehicles={vehicles} companyId={1} />)
    expect(screen.getByText('Seat Ibiza 1.0 TSI (2021) - AB-1234-CD')).toBeTruthy()
    expect(screen.getByText('Renault Clio (2019) - ZZ-9999-ZZ')).toBeTruthy()
  })

  it('OK and NO buttons exist for inspection items', () => {
    render(<RevisionSheet {...defaultProps} />)
    const okButtons = screen.getAllByRole('button', { name: 'OK' })
    const noButtons = screen.getAllByRole('button', { name: 'NO' })
    expect(okButtons.length).toBeGreaterThan(0)
    expect(noButtons.length).toBeGreaterThan(0)
    // 7 sections with a total of 40 items → 40 OK and 40 NO buttons
    expect(okButtons.length).toBe(40)
    expect(noButtons.length).toBe(40)
  })

  it('Resultado general textarea is present', () => {
    render(<RevisionSheet {...defaultProps} />)
    const textarea = screen.getByPlaceholderText('Observaciones generales de la revision...')
    expect(textarea).toBeTruthy()
    expect((textarea as HTMLTextAreaElement).tagName).toBe('TEXTAREA')
  })
})
