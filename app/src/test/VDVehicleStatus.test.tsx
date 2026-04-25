import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VDVehicleStatus } from '../components/web/vehicle-detail/VDVehicleStatus'
import type { Vehicle, Supplier } from '../lib/api'

vi.mock('../lib/api', () => ({
  updateVehicle: vi.fn(),
}))
vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))

const api = await import('../lib/api')

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    company_id: 1,
    name: 'Dacia Dokker',
    precio_compra: 5000,
    precio_venta: 8000,
    km: 100000,
    anio: 2018,
    estado: 'DISPONIBLE',
    ad_url: '',
    ad_status: '',
    fuel: '',
    cv: '',
    transmission: '',
    color: '',
    notes: '',
    supplier_id: null,
    motor_ok: false,
    motor_ok_at: null,
    motor_supplier_id: null,
    motor_notes: null,
    carroceria_ok: false,
    carroceria_ok_at: null,
    carroceria_supplier_id: null,
    carroceria_notes: null,
    neumaticos_ok: false,
    neumaticos_ok_at: null,
    neumaticos_supplier_id: null,
    neumaticos_notes: null,
    itv_ok: false,
    itv_ok_at: null,
    itv_supplier_id: null,
    itv_notes: null,
    limpieza_ok: false,
    limpieza_ok_at: null,
    limpieza_supplier_id: null,
    limpieza_notes: null,
    ...overrides,
  } as Vehicle
}

function makeSupplier(id: number, name: string): Supplier {
  return {
    id, company_id: 1, name,
    cif: '', address: '', phone: '', email: '', contact_person: '', notes: '',
    created_at: '2026-01-01',
  }
}

const SUPPLIERS = [makeSupplier(10, 'Taller Pepe'), makeSupplier(20, 'ITV Granollers')]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.updateVehicle).mockResolvedValue(undefined as never)
})

describe('VDVehicleStatus', () => {
  it('renders 5 secciones en orden fijo: Motor → Plancha → Neumáticos → ITV → Limpieza', () => {
    const vehicle = makeVehicle()
    render(<VDVehicleStatus vehicle={vehicle} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    const labels = screen.getAllByRole('checkbox').map(
      (cb) => cb.parentElement?.querySelector('.vd-status-name')?.textContent?.trim()
    )
    expect(labels).toEqual(['Motor', 'Plancha y pintura', 'Neumáticos', 'ITV', 'Limpieza'])
  })

  it('muestra contador 0/5 cuando ningún ok', () => {
    render(<VDVehicleStatus vehicle={makeVehicle()} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('muestra contador 3/5 cuando 3 secciones están OK', () => {
    const v = makeVehicle({ motor_ok: true, itv_ok: true, limpieza_ok: true })
    render(<VDVehicleStatus vehicle={v} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('al marcar checkbox: persiste {key}_ok=true y {key}_ok_at=ISO', async () => {
    const onUpdate = vi.fn()
    render(<VDVehicleStatus vehicle={makeVehicle()} suppliers={SUPPLIERS} onUpdate={onUpdate} />)
    const motorCheckbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(motorCheckbox)
    await waitFor(() => {
      expect(api.updateVehicle).toHaveBeenCalledWith(1, expect.objectContaining({
        motor_ok: true,
        motor_ok_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }))
    })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ motor_ok: true }))
  })

  it('al desmarcar checkbox ya OK: persiste ok=false y ok_at=null', async () => {
    const v = makeVehicle({ motor_ok: true, motor_ok_at: '2026-04-20T10:00:00Z' })
    render(<VDVehicleStatus vehicle={v} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    const motorCheckbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(motorCheckbox)
    await waitFor(() => {
      expect(api.updateVehicle).toHaveBeenCalledWith(1, { motor_ok: false, motor_ok_at: null })
    })
  })

  it('cuando isOk: muestra fecha y proveedor en meta, NO muestra textarea ni select', () => {
    const v = makeVehicle({
      motor_ok: true,
      motor_ok_at: '2026-04-20T10:00:00Z',
      motor_supplier_id: 10,
    })
    const { container } = render(<VDVehicleStatus vehicle={v} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    // Meta del item OK incluye fecha + nombre del proveedor
    const meta = container.querySelector('.vd-status-ok-meta')
    expect(meta?.textContent).toMatch(/Taller Pepe/)
    // No hay textarea para motor (solo lo hay para las 4 secciones no-OK)
    expect(screen.getAllByRole('textbox').length).toBe(4)
  })

  it('cuando NO isOk: muestra textarea con notas previas como defaultValue', () => {
    const v = makeVehicle({ motor_notes: 'Cambiar correa de distribución' })
    render(<VDVehicleStatus vehicle={v} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    expect(screen.getByDisplayValue('Cambiar correa de distribución')).toBeInTheDocument()
  })

  it('al cambiar notas y blur: persiste {key}_notes con el nuevo valor', async () => {
    render(<VDVehicleStatus vehicle={makeVehicle()} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    const motorTextarea = screen.getAllByRole('textbox')[0]
    fireEvent.change(motorTextarea, { target: { value: 'Revisar embrague' } })
    fireEvent.blur(motorTextarea)
    await waitFor(() => {
      expect(api.updateVehicle).toHaveBeenCalledWith(1, { motor_notes: 'Revisar embrague' })
    })
  })

  it('blur sin cambios en notas: NO persiste', async () => {
    const v = makeVehicle({ motor_notes: 'Original' })
    render(<VDVehicleStatus vehicle={v} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    const motorTextarea = screen.getAllByRole('textbox')[0]
    fireEvent.blur(motorTextarea)
    await new Promise((r) => setTimeout(r, 50))
    expect(api.updateVehicle).not.toHaveBeenCalled()
  })

  it('al seleccionar proveedor en !ok: persiste {key}_supplier_id', async () => {
    render(<VDVehicleStatus vehicle={makeVehicle()} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    const motorSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(motorSelect, { target: { value: '20' } })
    await waitFor(() => {
      expect(api.updateVehicle).toHaveBeenCalledWith(1, { motor_supplier_id: 20 })
    })
  })

  it('al deseleccionar proveedor (Sin proveedor): persiste null', async () => {
    const v = makeVehicle({ motor_supplier_id: 10 })
    render(<VDVehicleStatus vehicle={v} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    const motorSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(motorSelect, { target: { value: '' } })
    await waitFor(() => {
      expect(api.updateVehicle).toHaveBeenCalledWith(1, { motor_supplier_id: null })
    })
  })

  it('notas no se borran al marcar OK (solo se ocultan: re-aparecen al desmarcar)', () => {
    // Vehículo con notas pero ok=true: no se ven en textarea (sección colapsada).
    const v = makeVehicle({
      motor_ok: true,
      motor_ok_at: '2026-04-20T10:00:00Z',
      motor_notes: 'Pendiente cambiar bujías',
    })
    const { rerender } = render(<VDVehicleStatus vehicle={v} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    expect(screen.queryByDisplayValue('Pendiente cambiar bujías')).not.toBeInTheDocument()

    // Re-render con ok=false: las notas siguen ahí (no se borraron).
    rerender(<VDVehicleStatus vehicle={{ ...v, motor_ok: false, motor_ok_at: null }} suppliers={SUPPLIERS} onUpdate={vi.fn()} />)
    expect(screen.getByDisplayValue('Pendiente cambiar bujías')).toBeInTheDocument()
  })
})
