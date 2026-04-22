import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { LinkPurchaseModal } from '../components/LinkPurchaseModal'
import type { BankTransaction, PurchaseRecord } from '../lib/api'

vi.mock('../lib/api', () => ({
  suggestPurchasesForTransaction: vi.fn(),
  linkTransactionToPurchase: vi.fn(),
}))

const api = await import('../lib/api')

function makeTx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: 1,
    bank_account_id: 1,
    external_id: 'TX001',
    booking_date: '2026-03-15',
    value_date: null,
    amount: -8500,
    currency: 'EUR',
    counterparty_name: 'AUTO1',
    description: 'Compra vehículo',
    balance_after: 5000,
    category: 'COMPRA_VEHICULO',
    linked_sale_id: null,
    linked_purchase_id: null,
    reviewed_by_user: false,
    notes: '',
    created_at: '2026-03-15',
    updated_at: '2026-03-15',
    ...overrides,
  }
}

function makePurchase(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: 1,
    expense_type: 'compra_vehiculo',
    vehicle_name: 'SEAT Ibiza 2019',
    plate: '1234ABC',
    supplier_name: 'AUTO1',
    purchase_date: '2026-03-14',
    purchase_price: 8500,
    invoice_number: 'F-001',
    payment_method: 'transferencia',
    notes: '',
    source_file: '',
    created_at: '2026-03-14',
    company_id: 1,
    vehicle_id: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LinkPurchaseModal', () => {
  const defaultProps = {
    tx: makeTx(),
    companyId: 1,
    onClose: vi.fn(),
    onLinked: vi.fn(),
  }

  it('shows loading state initially', () => {
    vi.mocked(api.suggestPurchasesForTransaction).mockReturnValue(new Promise(() => {}))
    render(<LinkPurchaseModal {...defaultProps} />)
    expect(screen.getByText(/Buscando candidatos/)).toBeInTheDocument()
  })

  it('shows transaction details in header', () => {
    vi.mocked(api.suggestPurchasesForTransaction).mockReturnValue(new Promise(() => {}))
    render(<LinkPurchaseModal {...defaultProps} />)
    expect(screen.getByText(/Compra vehículo/)).toBeInTheDocument()
    expect(screen.getByText(/Vincular a compra existente/)).toBeInTheDocument()
  })

  it('shows empty state when no suggestions', async () => {
    vi.mocked(api.suggestPurchasesForTransaction).mockResolvedValue([])
    render(<LinkPurchaseModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/No hay compras parecidas/)).toBeInTheDocument()
    })
  })

  // Audit 2026-04-19 B2: empty state con CTA para crear desde el movimiento
  // cuando el padre pasa onCreatePurchase.
  it('renders create-purchase CTA in empty state when callback provided', async () => {
    const onCreatePurchase = vi.fn()
    const onClose = vi.fn()
    vi.mocked(api.suggestPurchasesForTransaction).mockResolvedValue([])
    render(
      <LinkPurchaseModal {...defaultProps} onClose={onClose} onCreatePurchase={onCreatePurchase} />
    )
    const cta = await screen.findByRole('button', { name: /Crear compra desde este movimiento/ })
    fireEvent.click(cta)
    expect(onCreatePurchase).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('renders purchase suggestions', async () => {
    const purchases = [
      makePurchase({ id: 1, supplier_name: 'AUTO1', vehicle_name: 'SEAT Ibiza' }),
      makePurchase({ id: 2, supplier_name: 'Particular', vehicle_name: 'BMW Serie 3' }),
    ]
    vi.mocked(api.suggestPurchasesForTransaction).mockResolvedValue(purchases)
    render(<LinkPurchaseModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('AUTO1')).toBeInTheDocument()
      expect(screen.getByText('Particular')).toBeInTheDocument()
    })
  })

  it('calls linkTransactionToPurchase when clicking a suggestion', async () => {
    const purchases = [makePurchase({ id: 42, supplier_name: 'AUTO1' })]
    vi.mocked(api.suggestPurchasesForTransaction).mockResolvedValue(purchases)
    vi.mocked(api.linkTransactionToPurchase).mockResolvedValue(undefined)

    render(<LinkPurchaseModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('AUTO1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('AUTO1'))

    await waitFor(() => {
      expect(api.linkTransactionToPurchase).toHaveBeenCalledWith(1, 42)
      expect(defaultProps.onLinked).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it('calls onClose when clicking the overlay', () => {
    vi.mocked(api.suggestPurchasesForTransaction).mockReturnValue(new Promise(() => {}))
    const { container } = render(<LinkPurchaseModal {...defaultProps} />)
    // Click the overlay (first div)
    fireEvent.click(container.firstChild!)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking the close button', () => {
    vi.mocked(api.suggestPurchasesForTransaction).mockReturnValue(new Promise(() => {}))
    render(<LinkPurchaseModal {...defaultProps} />)
    fireEvent.click(screen.getByText('×'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('passes correct params to suggestPurchasesForTransaction', async () => {
    vi.mocked(api.suggestPurchasesForTransaction).mockResolvedValue([])
    render(<LinkPurchaseModal {...defaultProps} />)
    await waitFor(() => {
      expect(api.suggestPurchasesForTransaction).toHaveBeenCalledWith(1, -8500, '2026-03-15')
    })
  })
})
