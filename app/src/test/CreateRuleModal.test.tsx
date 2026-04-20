import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { CreateRuleModal } from '../components/CreateRuleModal'
import type { BankTransaction } from '../lib/api'

vi.mock('../lib/api', () => ({
  createBankCategoryRule: vi.fn(),
  countUncategorizedMatching: vi.fn(),
  applyCategoryToUncategorizedMatching: vi.fn(),
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
  vi.mocked(api.countUncategorizedMatching).mockResolvedValue(0)
  vi.mocked(api.applyCategoryToUncategorizedMatching).mockResolvedValue(0)
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

  // Audit 2026-04-19: cuando counterparty está vacío y la descripción tiene
  // varias palabras útiles, suggestPattern toma hasta 3 consecutivas (no solo 1)
  // para evitar patrones genéricos peligrosos como "ricard".
  it('suggests multi-word pattern from description (not single word)', () => {
    render(<CreateRuleModal {...defaultProps} tx={makeTx({ counterparty_name: '', description: 'Ricard Codina fac | 00046 / RICARD CODINA LUDENA' })} />)
    const input = screen.getByPlaceholderText(/AUTO1/) as HTMLInputElement
    // Más de una palabra → el patrón es más específico (e.g. "ricard codina fac")
    expect(input.value.split(/\s+/).filter(Boolean).length).toBeGreaterThan(1)
  })

  it('warns when pattern is too short and likely too generic', () => {
    render(<CreateRuleModal {...defaultProps} tx={makeTx({ counterparty_name: 'AB', description: '' })} />)
    const input = screen.getByPlaceholderText(/AUTO1/) as HTMLInputElement
    // Forzar patrón corto manualmente
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/Patrón muy corto/i)
  })

  it('does not warn when pattern has enough characters', () => {
    render(<CreateRuleModal {...defaultProps} tx={makeTx({ counterparty_name: 'AGENCIA TRIBUTARIA' })} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

  // Audit 2026-04-20 (propuesta Ricard): al crear una regla, los SIN_CATEGORIZAR que
  // coinciden hoy también deben categorizarse — no solo los futuros imports. Evita
  // que el usuario tenga que tocar uno a uno los 3-4 "EESS MOLINS" ya importados.
  it('previews matching uncategorized transactions and applies retroactively on submit', async () => {
    vi.mocked(api.countUncategorizedMatching).mockResolvedValue(3)
    vi.mocked(api.applyCategoryToUncategorizedMatching).mockResolvedValue(3)
    vi.mocked(api.createBankCategoryRule).mockResolvedValue(7)

    render(<CreateRuleModal {...defaultProps} />)

    await waitFor(() => {
      expect(api.countUncategorizedMatching).toHaveBeenCalledWith(1, 'CEPSA')
    })
    expect(await screen.findByText(/3 movimientos sin categorizar/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Crear regla/i }))

    await waitFor(() => {
      expect(api.createBankCategoryRule).toHaveBeenCalled()
      expect(api.applyCategoryToUncategorizedMatching).toHaveBeenCalledWith(1, 'CEPSA', 'COMBUSTIBLE')
      expect(defaultProps.onCreated).toHaveBeenCalled()
    })
  })

  it('skips retroactive apply when user unchecks the box', async () => {
    vi.mocked(api.countUncategorizedMatching).mockResolvedValue(2)
    vi.mocked(api.createBankCategoryRule).mockResolvedValue(9)

    render(<CreateRuleModal {...defaultProps} />)
    await screen.findByText(/2 movimientos sin categorizar/)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Crear regla/i }))

    await waitFor(() => {
      expect(api.createBankCategoryRule).toHaveBeenCalled()
    })
    expect(api.applyCategoryToUncategorizedMatching).not.toHaveBeenCalled()
  })

  it('does not call apply when no uncategorized matches exist', async () => {
    vi.mocked(api.countUncategorizedMatching).mockResolvedValue(0)
    vi.mocked(api.createBankCategoryRule).mockResolvedValue(10)

    render(<CreateRuleModal {...defaultProps} />)
    await waitFor(() => {
      expect(api.countUncategorizedMatching).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: /Crear regla/i }))

    await waitFor(() => {
      expect(api.createBankCategoryRule).toHaveBeenCalled()
    })
    expect(api.applyCategoryToUncategorizedMatching).not.toHaveBeenCalled()
  })
})
