import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { CreatePurchaseModal } from '../components/CreatePurchaseModal'
import type { BankTransaction } from '../lib/api'

vi.mock('../lib/api', () => ({
  createPurchaseFromTransaction: vi.fn(),
}))

vi.mock('../lib/toast', () => ({
  showToast: vi.fn(),
}))

const api = await import('../lib/api')
const toast = await import('../lib/toast')

function makeTx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: 42,
    bank_account_id: 1,
    external_id: 'TX042',
    booking_date: '2026-03-15',
    value_date: null,
    amount: -1200,
    currency: 'EUR',
    counterparty_name: 'TALLER MECÁNICO SL',
    description: 'Reparación motor',
    balance_after: 5000,
    category: 'REPARACION',
    linked_sale_id: null,
    linked_purchase_id: null,
    reviewed_by_user: false,
    notes: '',
    created_at: '2026-03-15',
    updated_at: '2026-03-15',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CreatePurchaseModal', () => {
  const defaultProps = {
    tx: makeTx(),
    companyId: 1,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  }

  it('prefills supplier name from counterparty', () => {
    render(<CreatePurchaseModal {...defaultProps} />)
    expect(screen.getByDisplayValue('TALLER MECÁNICO SL')).toBeInTheDocument()
  })

  it('shows transaction details in header', () => {
    render(<CreatePurchaseModal {...defaultProps} />)
    expect(screen.getByText(/Reparación motor/)).toBeInTheDocument()
    expect(screen.getByText(/Crear compra desde movimiento/)).toBeInTheDocument()
  })

  it('maps REPARACION category to TALLER expense type', () => {
    render(<CreatePurchaseModal {...defaultProps} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('TALLER')
  })

  it('maps COMPRA_VEHICULO category to COMPRA_VEHICULO expense type', () => {
    render(<CreatePurchaseModal {...defaultProps} tx={makeTx({ category: 'COMPRA_VEHICULO' })} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('COMPRA_VEHICULO')
  })

  it('falls back to OTRO for unknown category', () => {
    render(<CreatePurchaseModal {...defaultProps} tx={makeTx({ category: 'SIN_CATEGORIZAR' })} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('OTRO')
  })

  it('calls createPurchaseFromTransaction on submit', async () => {
    vi.mocked(api.createPurchaseFromTransaction).mockResolvedValue(99)
    render(<CreatePurchaseModal {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /Crear compra/i }))

    await waitFor(() => {
      expect(api.createPurchaseFromTransaction).toHaveBeenCalledWith(
        1, 42, 'TALLER', 'TALLER MECÁNICO SL', null,
      )
      expect(defaultProps.onCreated).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it('blocks submit when supplier is empty (counterparty + description vacíos)', async () => {
    render(<CreatePurchaseModal {...defaultProps} tx={makeTx({ counterparty_name: '', description: '' })} />)
    const submit = screen.getByRole('button', { name: /Crear compra/i }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  // Audit 2026-04-19: cuando counterparty está vacío (común en N43), parsear el
  // primer segmento de la descripción como sugerencia de proveedor.
  it('falls back to first segment of description when counterparty is empty', () => {
    render(<CreatePurchaseModal {...defaultProps} tx={makeTx({ counterparty_name: '', description: 'EESS MOLINS DE RE | 09736 / Fecha 07-04' })} />)
    expect(screen.getByDisplayValue('EESS MOLINS DE RE')).toBeInTheDocument()
  })

  it('shows error toast on failure', async () => {
    vi.mocked(api.createPurchaseFromTransaction).mockRejectedValue(new Error('DB error'))
    render(<CreatePurchaseModal {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /Crear compra/i }))

    await waitFor(() => {
      expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error')
      expect(defaultProps.onCreated).not.toHaveBeenCalled()
    })
  })

  it('closes when clicking overlay', () => {
    const { container } = render(<CreatePurchaseModal {...defaultProps} />)
    fireEvent.click(container.firstChild!)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('closes when clicking the × button', () => {
    render(<CreatePurchaseModal {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Cerrar diálogo'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})
