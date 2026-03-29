import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeadModal } from '../components/LeadModal'
import type { StockVehicle } from '../types'
import { EMPTY_LEAD_FORM } from '../types'

describe('LeadModal', () => {
  const defaultProps = {
    modal: { mode: 'create' as const },
    leadForm: { ...EMPTY_LEAD_FORM },
    setLeadForm: vi.fn(),
    selectedLeadVehicle: '',
    setSelectedLeadVehicle: vi.fn(),
    stock: [] as StockVehicle[],
    submitting: false,
    onSubmit: vi.fn((e) => e.preventDefault()),
    onClose: vi.fn(),
  }

  it('renders nothing when modal is null', () => {
    const { container } = render(<LeadModal {...defaultProps} modal={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders create mode correctly', () => {
    render(<LeadModal {...defaultProps} />)
    expect(screen.getByText('Nuevo lead')).toBeInTheDocument()
    expect(screen.getByText('Registrar lead')).toBeInTheDocument()
  })

  it('renders edit mode correctly', () => {
    const modal = {
      mode: 'edit' as const,
      lead: {
        id: 1, name: 'Juan', phone: '612345678', email: 'juan@test.com',
        notes: '', vehicle_interest: 'SUV', vehicle_folder_path: null,
        converted_client_id: null,
      },
    }
    render(<LeadModal {...defaultProps} modal={modal} />)
    expect(screen.getByText('Editar lead')).toBeInTheDocument()
  })

  it('updates name field', () => {
    const setLeadForm = vi.fn()
    render(<LeadModal {...defaultProps} setLeadForm={setLeadForm} />)
    fireEvent.change(screen.getByPlaceholderText('Nombre del contacto'), { target: { value: 'María' } })
    expect(setLeadForm).toHaveBeenCalledWith(expect.objectContaining({ name: 'María' }))
  })

  it('updates phone field', () => {
    const setLeadForm = vi.fn()
    render(<LeadModal {...defaultProps} setLeadForm={setLeadForm} />)
    fireEvent.change(screen.getByPlaceholderText('600 123 123'), { target: { value: '612999888' } })
    expect(setLeadForm).toHaveBeenCalledWith(expect.objectContaining({ phone: '612999888' }))
  })

  it('shows vehicle options in select', () => {
    const stock: StockVehicle[] = [
      { name: 'Seat Ibiza', folder_path: '/seat', ad_info: null },
      { name: 'Ford Focus', folder_path: '/ford', ad_info: null },
    ]
    render(<LeadModal {...defaultProps} stock={stock} />)
    expect(screen.getByText('Seat Ibiza')).toBeInTheDocument()
    expect(screen.getByText('Ford Focus')).toBeInTheDocument()
  })

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn()
    render(<LeadModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Nuevo lead').closest('.modal-overlay')!)
    expect(onClose).toHaveBeenCalled()
  })

  it('disables submit when submitting', () => {
    render(<LeadModal {...defaultProps} submitting={true} />)
    const buttons = screen.getAllByRole('button')
    const submitBtn = buttons.find(b => b.getAttribute('type') === 'submit' || b.textContent === 'Crear')
    expect(submitBtn).toBeDisabled()
  })
})
