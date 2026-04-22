import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BankList } from '../components/BankList'
import type { BankAccount, BankTransaction } from '../lib/api'

vi.mock('../lib/api', () => ({
  listBankAccounts: vi.fn(),
  listBankTransactions: vi.fn(),
  updateBankTransactionCategory: vi.fn(),
  suggestPurchasesForTransaction: vi.fn(),
  suggestSalesForTransaction: vi.fn(),
  linkTransactionToPurchase: vi.fn(),
  linkTransactionToSale: vi.fn(),
  createBankCategoryRule: vi.fn(),
  createPurchaseFromTransaction: vi.fn(),
  countUncategorizedMatching: vi.fn(),
  applyCategoryToUncategorizedMatching: vi.fn(),
}))

const api = await import('../lib/api')

function makeAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    id: 1,
    company_id: 1,
    alias: 'Autónomo CaixaBank',
    iban: 'ES1234567890',
    bank_name: 'CaixaBank',
    account_type: 'checking',
    is_personal: false,
    provider: 'n43_manual',
    external_id: null,
    consent_expires_at: null,
    last_synced_at: null,
    created_at: '2026-01-01',
    ...overrides,
  }
}

function makeTx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: 1,
    bank_account_id: 1,
    external_id: 'TX001',
    booking_date: '2026-03-15',
    value_date: null,
    amount: -500,
    currency: 'EUR',
    counterparty_name: 'Taller Mecánico',
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

describe('BankList', () => {
  it('shows loading state initially', () => {
    vi.mocked(api.listBankAccounts).mockReturnValue(new Promise(() => {}))
    render(<BankList companyId={1} />)
    expect(screen.getByText(/Cargando cuentas bancarias/)).toBeInTheDocument()
  })

  it('shows empty state when no accounts', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([])
    render(<BankList companyId={1} />)
    await waitFor(() => {
      expect(screen.getByText('No hay cuentas bancarias configuradas')).toBeInTheDocument()
    })
  })

  it('shows error when loading accounts fails', async () => {
    vi.mocked(api.listBankAccounts).mockRejectedValue(new Error('Network error'))
    render(<BankList companyId={1} />)
    await waitFor(() => {
      expect(screen.getByText(/error inesperado/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('renders account buttons and transactions', async () => {
    const accounts = [
      makeAccount({ id: 1, alias: 'Autónomo' }),
      makeAccount({ id: 2, alias: 'Personal', is_personal: true }),
    ]
    const txs = [
      makeTx({ id: 1, amount: -500, counterparty_name: 'Taller' }),
      makeTx({ id: 2, amount: 1200, counterparty_name: 'Comprador', category: 'VENTA_VEHICULO' }),
    ]
    vi.mocked(api.listBankAccounts).mockResolvedValue(accounts)
    vi.mocked(api.listBankTransactions).mockResolvedValue(txs)

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Autónomo')).toBeInTheDocument()
      expect(screen.getByText('Personal')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/2 movimiento/)).toBeInTheDocument()
    })
  })

  it('selects the non-personal checking account by default', async () => {
    const accounts = [
      makeAccount({ id: 10, alias: 'Personal', is_personal: true }),
      makeAccount({ id: 20, alias: 'Autónomo', is_personal: false, account_type: 'checking' }),
    ]
    vi.mocked(api.listBankAccounts).mockResolvedValue(accounts)
    vi.mocked(api.listBankTransactions).mockResolvedValue([])

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(api.listBankTransactions).toHaveBeenCalledWith(20, expect.anything())
    })
  })

  it('shows personal account warning when selected', async () => {
    const accounts = [makeAccount({ id: 1, alias: 'Personal', is_personal: true })]
    vi.mocked(api.listBankAccounts).mockResolvedValue(accounts)
    vi.mocked(api.listBankTransactions).mockResolvedValue([])

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(screen.getByText(/Esta cuenta está marcada como/)).toBeInTheDocument()
    })
  })

  it('switches account on button click', async () => {
    const accounts = [
      makeAccount({ id: 1, alias: 'Autónomo' }),
      makeAccount({ id: 2, alias: 'Póliza', account_type: 'credit_line' }),
    ]
    vi.mocked(api.listBankAccounts).mockResolvedValue(accounts)
    vi.mocked(api.listBankTransactions).mockResolvedValue([])

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Póliza')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Póliza'))

    await waitFor(() => {
      expect(api.listBankTransactions).toHaveBeenCalledWith(2, expect.anything())
    })
  })

  it('counts uncategorized transactions', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR' }),
      makeTx({ id: 2, category: 'SIN_CATEGORIZAR' }),
      makeTx({ id: 3, category: 'REPARACION' }),
    ])

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(screen.getByText(/2 sin categorizar/)).toBeInTheDocument()
    })
  })

  // Audit 2026-04-19: el modal de regla ya NO se abre automáticamente al recategorizar
  // (era intrusivo cuando había cientos de SIN_CATEGORIZAR). Ahora aparece un botón
  // inline "+ regla" en la fila recién cambiada y solo el click lo abre.
  it('shows inline + regla button after recategorizing, without opening modal', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR', counterparty_name: 'CEPSA', description: 'Combustible' }),
    ])
    vi.mocked(api.updateBankTransactionCategory).mockResolvedValue(undefined)

    render(<BankList companyId={1} />)

    const catSelect = await screen.findByLabelText(/Categoría para/)
    fireEvent.change(catSelect, { target: { value: 'COMBUSTIBLE' } })

    await waitFor(() => {
      expect(api.updateBankTransactionCategory).toHaveBeenCalledWith(1, 'COMBUSTIBLE', true)
    })
    expect(screen.queryByText('Crear regla de categorización')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Crear regla.*Combustible/i })).toBeInTheDocument()
  })

  it('opens rule modal only when inline + regla button is clicked', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR', counterparty_name: 'CEPSA', description: 'Combustible' }),
    ])
    vi.mocked(api.updateBankTransactionCategory).mockResolvedValue(undefined)

    render(<BankList companyId={1} />)

    const catSelect = await screen.findByLabelText(/Categoría para/)
    fireEvent.change(catSelect, { target: { value: 'COMBUSTIBLE' } })

    const ruleBtn = await screen.findByRole('button', { name: /Crear regla.*Combustible/i })
    fireEvent.click(ruleBtn)

    expect(screen.getByText('Crear regla de categorización')).toBeInTheDocument()
  })

  it('does not open rule modal when category is already set', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'REPARACION' }),
    ])
    vi.mocked(api.updateBankTransactionCategory).mockResolvedValue(undefined)

    render(<BankList companyId={1} />)

    const catSelect = await screen.findByLabelText(/Categoría para/)
    fireEvent.change(catSelect, { target: { value: 'COMBUSTIBLE' } })

    await waitFor(() => {
      expect(api.updateBankTransactionCategory).toHaveBeenCalled()
    })
    expect(screen.queryByText('Crear regla de categorización')).not.toBeInTheDocument()
  })

  it('shows + Compra button for unlinked expenses', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, amount: -500, linked_purchase_id: null, linked_sale_id: null }),
    ])

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Crear compra desde movimiento/ })).toBeInTheDocument()
    })
  })

  it('opens create-purchase modal when + Compra is clicked', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, amount: -500, counterparty_name: 'TALLER' }),
    ])

    render(<BankList companyId={1} />)

    const btn = await screen.findByRole('button', { name: /Crear compra desde movimiento/ })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('Crear compra desde movimiento')).toBeInTheDocument()
    })
  })

  // Audit 2026-04-22 fix: antes el CTA "+ regla" sólo aparecía en la última
  // fila cambiada. Ahora persiste en TODAS las filas categorizadas durante
  // la sesión, hasta recargar. Permite revisar en bloque y crear reglas al final.
  it('keeps + regla button visible on all recently categorized rows', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR', description: 'CEPSA gasolina' }),
      makeTx({ id: 2, category: 'SIN_CATEGORIZAR', description: 'Taller Mecánico' }),
    ])
    vi.mocked(api.updateBankTransactionCategory).mockResolvedValue(undefined)

    render(<BankList companyId={1} />)

    const selects = await screen.findAllByLabelText(/Categoría para/)
    expect(selects.length).toBe(2)

    fireEvent.change(selects[0], { target: { value: 'COMBUSTIBLE' } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Crear regla.*Combustible/i })).toBeInTheDocument()
    })

    fireEvent.change(selects[1], { target: { value: 'REPARACION' } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Crear regla.*Reparación/i })).toBeInTheDocument()
    })

    // El primer botón sigue presente
    expect(screen.getByRole('button', { name: /Crear regla.*Combustible/i })).toBeInTheDocument()
  })

  it('removes + regla button when row is re-set to SIN_CATEGORIZAR', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR', description: 'CEPSA' }),
    ])
    vi.mocked(api.updateBankTransactionCategory).mockResolvedValue(undefined)

    render(<BankList companyId={1} />)

    const select = await screen.findByLabelText(/Categoría para/)
    fireEvent.change(select, { target: { value: 'COMBUSTIBLE' } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Crear regla.*Combustible/i })).toBeInTheDocument()
    })

    fireEvent.change(select, { target: { value: 'SIN_CATEGORIZAR' } })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Crear regla/i })).not.toBeInTheDocument()
    })
  })

  // Audit 2026-04-22: ingresos no tenían CTA de vinculación manual.
  it('shows "Vincular venta" button for income (positive amount) transactions', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, amount: 9500, counterparty_name: 'Comprador', category: 'VENTA_VEHICULO' }),
    ])

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Asociar ingreso.*venta/ })).toBeInTheDocument()
    })
  })

  it('opens link-sale modal when "Vincular venta" is clicked', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, amount: 9500, counterparty_name: 'Comprador', category: 'VENTA_VEHICULO' }),
    ])
    vi.mocked(api.suggestSalesForTransaction).mockResolvedValue([])

    render(<BankList companyId={1} />)

    const btn = await screen.findByRole('button', { name: /Asociar ingreso.*venta/ })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('Vincular a venta existente')).toBeInTheDocument()
    })
  })

  it('does not show link-sale button when income is already linked', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, amount: 9500, linked_sale_id: 42, category: 'VENTA_VEHICULO' }),
    ])

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(screen.getByText('vinculado')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Asociar ingreso/ })).not.toBeInTheDocument()
  })

  // Audit 2026-04-19 M6: categoría IGNORAR opt-in para movimientos triviales
  // que no deben contar como "sin categorizar".
  it('offers IGNORAR as a selectable category', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR', description: 'Comisión 0.50€' }),
    ])

    render(<BankList companyId={1} />)

    const select = await screen.findByLabelText(/Categoría para/)
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value)
    expect(options).toContain('IGNORAR')
  })

  // Audit 2026-04-20b M7: al categorizar SIN_CATEGORIZAR → categoría concreta,
  // se propone aplicar el mismo cambio a otros con la misma contraparte sin abrir modal.
  it('shows propagate banner after categorizing SIN_CATEGORIZAR when similars exist', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR', counterparty_name: 'CEPSA', description: 'Combustible' }),
    ])
    vi.mocked(api.updateBankTransactionCategory).mockResolvedValue(undefined)
    vi.mocked(api.countUncategorizedMatching).mockResolvedValue(4)

    render(<BankList companyId={1} />)

    const catSelect = await screen.findByLabelText(/Categoría para/)
    fireEvent.change(catSelect, { target: { value: 'COMBUSTIBLE' } })

    expect(await screen.findByText(/4 movimientos sin categorizar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aplicar a todos/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Solo este/ })).toBeInTheDocument()
  })

  it('applies category to similars when clicking "Aplicar a todos"', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR', counterparty_name: 'CEPSA', description: 'Combustible' }),
    ])
    vi.mocked(api.updateBankTransactionCategory).mockResolvedValue(undefined)
    vi.mocked(api.countUncategorizedMatching).mockResolvedValue(3)
    vi.mocked(api.applyCategoryToUncategorizedMatching).mockResolvedValue(3)

    render(<BankList companyId={1} />)

    const catSelect = await screen.findByLabelText(/Categoría para/)
    fireEvent.change(catSelect, { target: { value: 'COMBUSTIBLE' } })

    const applyBtn = await screen.findByRole('button', { name: /Aplicar a todos/ })
    fireEvent.click(applyBtn)

    await waitFor(() => {
      expect(api.applyCategoryToUncategorizedMatching).toHaveBeenCalledWith(1, 'CEPSA', 'COMBUSTIBLE')
    })
  })

  // Audit B5: la cuenta POLIZA es una línea de crédito y necesita aviso diferencial.
  it('shows credit-line warning when credit_line account is selected', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([
      makeAccount({ id: 1, alias: 'POLIZA CODINACARS', account_type: 'credit_line' }),
    ])
    vi.mocked(api.listBankTransactions).mockResolvedValue([])

    render(<BankList companyId={1} />)

    await waitFor(() => {
      expect(screen.getByText(/póliza de crédito/i)).toBeInTheDocument()
    })
  })

  // Audit B1: botón manual para recargar los movimientos.
  it('shows "Sincronizar ahora" button and triggers a reload', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([])

    render(<BankList companyId={1} />)

    const btn = await screen.findByRole('button', { name: /Recargar movimientos desde el servidor/ })
    vi.mocked(api.listBankTransactions).mockClear()
    fireEvent.click(btn)

    await waitFor(() => {
      expect(api.listBankTransactions).toHaveBeenCalled()
    })
  })

  it('does not propose propagation when category set to IGNORAR', async () => {
    vi.mocked(api.listBankAccounts).mockResolvedValue([makeAccount()])
    vi.mocked(api.listBankTransactions).mockResolvedValue([
      makeTx({ id: 1, category: 'SIN_CATEGORIZAR', counterparty_name: 'CEPSA', description: 'Combustible' }),
    ])
    vi.mocked(api.updateBankTransactionCategory).mockResolvedValue(undefined)
    vi.mocked(api.countUncategorizedMatching).mockResolvedValue(4)

    render(<BankList companyId={1} />)

    const catSelect = await screen.findByLabelText(/Categoría para/)
    fireEvent.change(catSelect, { target: { value: 'IGNORAR' } })

    await waitFor(() => {
      expect(api.updateBankTransactionCategory).toHaveBeenCalledWith(1, 'IGNORAR', true)
    })
    expect(api.countUncategorizedMatching).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Aplicar a todos/ })).not.toBeInTheDocument()
  })
})
