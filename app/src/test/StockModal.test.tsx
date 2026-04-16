import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StockModal } from '../components/StockModal'
import { EMPTY_STOCK_VEHICLE_FORM } from '../types'
import type { StockVehicleForm, StockModal as StockModalType } from '../types'

function renderModal(overrides: Partial<{
  modal: StockModalType;
  vehicleNameInput: string;
  stockVehicleForm: StockVehicleForm;
  supplierInput: string;
  suppliers: string[];
  submitting: boolean;
}> = {}) {
  const props = {
    modal: { mode: 'create' as const },
    vehicleNameInput: '',
    setVehicleNameInput: vi.fn(),
    stockVehicleForm: { ...EMPTY_STOCK_VEHICLE_FORM },
    setStockVehicleForm: vi.fn(),
    supplierInput: '',
    setSupplierInput: vi.fn(),
    suppliers: ['AUTO1', 'Particular'],
    submitting: false,
    onSubmit: vi.fn((e) => e.preventDefault()),
    onClose: vi.fn(),
    ...overrides,
  }
  return { ...render(<StockModal {...props} />), props }
}

describe('StockModal', () => {
  it('renders nothing when modal is null', () => {
    const { container } = renderModal({ modal: null })
    expect(container.innerHTML).toBe('')
  })

  it('shows create mode title', () => {
    renderModal()
    expect(screen.getByText('Añadir vehiculo al stock')).toBeInTheDocument()
  })

  it('shows edit mode title with vehicle name', () => {
    renderModal({
      modal: { mode: 'edit', vehicle: { name: 'SEAT Ibiza', folder_path: '/x', ad_info: null } },
      vehicleNameInput: 'SEAT Ibiza',
    })
    expect(screen.getByText('Editar vehiculo')).toBeInTheDocument()
  })

  it('calls setVehicleNameInput on name input change', () => {
    const { props } = renderModal()
    fireEvent.change(screen.getByPlaceholderText(/SEAT Ibiza/), { target: { value: 'BMW' } })
    expect(props.setVehicleNameInput).toHaveBeenCalledWith('BMW')
  })

  it('shows supplier field only in create mode', () => {
    renderModal({ modal: { mode: 'create' } })
    expect(screen.getByPlaceholderText(/AUTO1/)).toBeInTheDocument()
  })

  it('hides supplier field in edit mode', () => {
    renderModal({
      modal: { mode: 'edit', vehicle: { name: 'X', folder_path: '/x', ad_info: null } },
    })
    expect(screen.queryByPlaceholderText(/AUTO1/)).not.toBeInTheDocument()
  })

  it('shows estado select only in edit mode', () => {
    renderModal({
      modal: { mode: 'edit', vehicle: { name: 'X', folder_path: '/x', ad_info: null } },
    })
    expect(screen.getByLabelText('Estado')).toBeInTheDocument()
  })

  it('calls onSubmit when form is submitted', () => {
    const { props } = renderModal()
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(props.onSubmit).toHaveBeenCalled()
  })

  it('calls onClose when cancel is clicked', () => {
    const { props } = renderModal()
    fireEvent.click(screen.getByText('Cancelar'))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('disables buttons when submitting', () => {
    renderModal({ submitting: true })
    expect(screen.getByText('Guardando...')).toBeDisabled()
    expect(screen.getByText('Cancelar')).toBeDisabled()
  })
})
