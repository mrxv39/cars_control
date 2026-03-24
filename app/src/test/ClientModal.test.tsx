import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClientModal } from '../components/ClientModal'
import type { ClientForm, StockVehicle } from '../types'
import { EMPTY_CLIENT_FORM } from '../types'

describe('ClientModal', () => {
  const defaultProps = {
    modal: { mode: 'create' as const },
    clientForm: { ...EMPTY_CLIENT_FORM },
    setClientForm: vi.fn(),
    selectedClientVehicle: '',
    setSelectedClientVehicle: vi.fn(),
    stock: [] as StockVehicle[],
    submitting: false,
    onSubmit: vi.fn((e) => e.preventDefault()),
    onClose: vi.fn(),
  }

  it('renders nothing when modal is null', () => {
    const { container } = render(<ClientModal {...defaultProps} modal={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders create mode', () => {
    render(<ClientModal {...defaultProps} />)
    expect(screen.getByText('Nuevo client')).toBeInTheDocument()
  })

  it('renders edit mode', () => {
    const modal = {
      mode: 'edit' as const,
      client: {
        id: 1, name: 'Pedro', phone: '600111222', email: 'pedro@test.com',
        dni: '12345678A', notes: '', vehicle_folder_path: null, source_lead_id: null,
      },
    }
    render(<ClientModal {...defaultProps} modal={modal} />)
    expect(screen.getByText('Editar client')).toBeInTheDocument()
  })

  it('renders conversion mode with custom title', () => {
    const modal = {
      mode: 'create' as const,
      sourceLeadId: 5,
      title: 'Convertir lead a cliente',
    }
    render(<ClientModal {...defaultProps} modal={modal} />)
    expect(screen.getByText('Conversión')).toBeInTheDocument()
    expect(screen.getByText('Convertir lead a cliente')).toBeInTheDocument()
  })

  it('updates DNI field', () => {
    const setClientForm = vi.fn()
    render(<ClientModal {...defaultProps} setClientForm={setClientForm} />)
    fireEvent.change(screen.getByPlaceholderText('12345678A'), { target: { value: '87654321B' } })
    expect(setClientForm).toHaveBeenCalledWith(expect.objectContaining({ dni: '87654321B' }))
  })

  it('shows Convertir button when sourceLeadId present', () => {
    const modal = { mode: 'create' as const, sourceLeadId: 3 }
    render(<ClientModal {...defaultProps} modal={modal} />)
    expect(screen.getByText('Convertir')).toBeInTheDocument()
  })

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn()
    render(<ClientModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Nuevo client').closest('.modal-overlay')!)
    expect(onClose).toHaveBeenCalled()
  })
})
