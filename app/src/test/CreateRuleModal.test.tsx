import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { CreateRuleModal } from '../components/CreateRuleModal'
import type { BankTransaction } from '../lib/api'

vi.mock('../lib/api', () => ({
  createBankCategoryRule: vi.fn(),
}))

vi.mock('../lib/toast', () => ({
  showToast: vi.fn(),
}))

const api = await import('../lib/api')
const toast = await import('../lib/toast')

function makeTx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: 1,
    bank_account_id: 1,
    external_id: 'TX001',
    booking_date: '2026-03-15',
    value_date: null,
    amount: -120,
    currency: 'EUR',
    counterparty_name: 'CEPSA',
    description: 'Combustible',
    balance_after: 5000,
    category: 'COMBUSTIBLE',
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

describe('CreateRuleModal', () => {
  const defaultProps = {
    tx: makeTx(),
    category: 'COMBUSTIBLE',
    companyId: 1,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  }

  it('prefills pattern from counterparty name', () => {
    render(<CreateRuleModal {...defaultProps} />)
    expect(screen.getByDisplayValue('CEPSA')).toBeInTheDocument()
  })

  it('falls back to a description word when counterparty is empty', () => {
    render(<CreateRuleModal {...defaultProps} tx={makeTx({ counterparty_name: '', description: 'Transferencia AUTO1 pagoo' })} />)
    const input = screen.getByPlaceholderText(/AUTO1/) as HTMLInputElement
    expect(input.value.toLowerCase()).toContain('auto1')
  })

  it('shows target category in the header', () => {
    render(<CreateRuleModal {...defaultProps} />)
    expect(screen.getByText(/Combustible/)).toBeInTheDocument()
  })

  it('calls createBankCategoryRule on submit', async () => {
    vi.mocked(api.createBankCategoryRule).mockResolvedValue(7)
    render(<CreateRuleModal {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /Crear regla/i }))

    await waitFor(() => {
      expect(api.createBankCategoryRule).toHaveBeenCalledWith(1, 'CEPSA', 'COMBUSTIBLE', null, 100)
      expect(defaultProps.onCreated).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it('disables submit when pattern is empty', () => {
    render(<CreateRuleModal {...defaultProps} tx={makeTx({ counterparty_name: '', description: '' })} />)
    const submit = screen.getByRole('button', { name: /Crear regla/i }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('shows error toast on failure', async () => {
    vi.mocked(api.createBankCategoryRule).mockRejectedValue(new Error('constraint violation'))
    render(<CreateRuleModal {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /Crear regla/i }))

    await waitFor(() => {
      expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error')
      expect(defaultProps.onCreated).not.toHaveBeenCalled()
    })
  })

  it('closes when clicking × button', () => {
    render(<CreateRuleModal {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Cerrar diálogo'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})
