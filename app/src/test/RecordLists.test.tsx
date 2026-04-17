import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ClientsList, SalesList, PurchasesList, SuppliersList } from '../components/web/RecordLists'
import type { Client, Vehicle, SalesRecord, PurchaseRecord, Supplier, Company } from '../lib/api'

vi.mock('../lib/api', () => ({
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  deleteSalesRecord: vi.fn(),
  deletePurchaseRecord: vi.fn(),
  createSupplier: vi.fn(),
  deleteSupplier: vi.fn(),
  listPurchaseIdsWithBankLink: vi.fn(),
}))

vi.mock('../lib/csv-export', () => ({
  exportToCSV: vi.fn(),
}))

vi.mock('../utils/invoiceGenerator', () => ({
  generateInvoicePDF: vi.fn(),
}))

const api = await import('../lib/api')

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1,
    name: 'Pedro López',
    phone: '698765432',
    email: 'pedro@example.com',
    dni: '12345678A',
    notes: '',
    source_lead_id: null,
    company_id: 1,
    vehicle_id: null,
    ...overrides,
  }
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    company_id: 1,
    name: 'Seat Ibiza 2019',
    precio_compra: 8000,
    precio_venta: 10500,
    km: 50000,
    anio: 2019,
    estado: 'disponible',
    ad_url: '',
    ad_status: '',
    fuel: 'Gasolina',
    cv: '',
    transmission: '',
    color: 'Blanco',
    notes: '',
    supplier_id: null,
    ...overrides,
  }
}

function makeSalesRecord(overrides: Partial<SalesRecord> = {}): SalesRecord {
  return {
    id: 1,
    vehicle_id: 1,
    client_id: 1,
    date: '2026-04-10',
    price_final: 10500,
    notes: '',
    company_id: 1,
    ...overrides,
  }
}

function makePurchaseRecord(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: 1,
    expense_type: 'COMPRA_VEHICULO',
    vehicle_name: 'Seat Ibiza',
    plate: '1234ABC',
    supplier_name: 'AutoVenta',
    purchase_date: '2026-01-15',
    purchase_price: 8000,
    invoice_number: 'F-001',
    payment_method: 'transferencia',
    notes: '',
    source_file: '',
    created_at: '2026-01-15',
    company_id: 1,
    vehicle_id: 1,
    ...overrides,
  }
}

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 1,
    company_id: 1,
    name: 'Taller Perez',
    cif: 'B12345678',
    address: 'Calle Mayor 1',
    phone: '612345678',
    email: 'info@taller.com',
    contact_person: 'Juan Perez',
    notes: '',
    created_at: '2026-01-01',
    ...overrides,
  }
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 1,
    trade_name: 'CodinaCars',
    legal_name: 'CodinaCars SL',
    cif: 'B12345678',
    address: 'Calle Mayor 1',
    phone: '612345678',
    email: 'info@codinacars.com',
    website: 'https://codinacars.com',
    created_at: '2026-01-01',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listPurchaseIdsWithBankLink).mockResolvedValue(new Set())
})

// ============================================================
// ClientsList
// ============================================================
describe('ClientsList', () => {
  const clients = [
    makeClient({ id: 1, name: 'Pedro López', phone: '698765432', dni: '12345678A' }),
    makeClient({ id: 2, name: 'Ana Martínez', phone: '611222333', email: 'ana@test.com', dni: '' }),
  ]

  it('renders client count', () => {
    render(<ClientsList clients={clients} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('2 clientes')).toBeInTheDocument()
  })

  it('renders client names', () => {
    render(<ClientsList clients={clients} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('Pedro López')).toBeInTheDocument()
    expect(screen.getByText('Ana Martínez')).toBeInTheDocument()
  })

  it('shows empty state when no clients', () => {
    render(<ClientsList clients={[]} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('Sin clientes registrados')).toBeInTheDocument()
  })

  it('shows singular form for one client', () => {
    render(<ClientsList clients={[clients[0]]} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('1 cliente')).toBeInTheDocument()
  })

  it('shows DNI when available', () => {
    render(<ClientsList clients={clients} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('DNI: 12345678A')).toBeInTheDocument()
  })
})

// ============================================================
// SalesList
// ============================================================
describe('SalesList', () => {
  const vehicles = [makeVehicle({ id: 1, name: 'Seat Ibiza 2019' })]
  const clients = [makeClient({ id: 1, name: 'Pedro López' })]
  const records = [
    makeSalesRecord({ id: 1, vehicle_id: 1, client_id: 1, price_final: 10500, date: '2026-04-10' }),
    makeSalesRecord({ id: 2, vehicle_id: 1, client_id: null, price_final: 8000, date: '2026-03-15' }),
  ]
  const company = makeCompany()

  it('renders sales count and total', () => {
    render(<SalesList records={records} vehicles={vehicles} clients={clients} companyId={1} company={company} onReload={vi.fn()} />)
    expect(screen.getByText(/2 ventas/)).toBeInTheDocument()
  })

  it('renders vehicle and client names in table', () => {
    render(<SalesList records={records} vehicles={vehicles} clients={clients} companyId={1} company={company} onReload={vi.fn()} />)
    expect(screen.getAllByText('Seat Ibiza 2019').length).toBeGreaterThan(0)
    expect(screen.getByText('Pedro López')).toBeInTheDocument()
  })

  it('shows empty state when no records', () => {
    render(<SalesList records={[]} vehicles={[]} clients={[]} companyId={1} company={company} onReload={vi.fn()} />)
    expect(screen.getByText('Sin ventas registradas')).toBeInTheDocument()
  })

  it('shows singular form for one sale', () => {
    render(<SalesList records={[records[0]]} vehicles={vehicles} clients={clients} companyId={1} company={company} onReload={vi.fn()} />)
    expect(screen.getByText(/1 venta/)).toBeInTheDocument()
  })
})

// ============================================================
// PurchasesList
// ============================================================
describe('PurchasesList', () => {
  const records = [
    makePurchaseRecord({ id: 1, supplier_name: 'AutoVenta', purchase_price: 8000 }),
    makePurchaseRecord({ id: 2, supplier_name: 'Taller Perez', purchase_price: 500, expense_type: 'REPARACION' }),
  ]

  it('renders purchase count and total', () => {
    render(<PurchasesList records={records} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText(/2 registros/)).toBeInTheDocument()
  })

  it('renders supplier names in table', async () => {
    render(<PurchasesList records={records} companyId={1} onReload={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('AutoVenta')).toBeInTheDocument()
      expect(screen.getByText('Taller Perez')).toBeInTheDocument()
    })
  })

  it('shows empty state when no records', () => {
    render(<PurchasesList records={[]} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('Sin compras registradas')).toBeInTheDocument()
  })

  it('shows bank link badge when purchase is linked', async () => {
    vi.mocked(api.listPurchaseIdsWithBankLink).mockResolvedValue(new Set([1]))
    render(<PurchasesList records={records} companyId={1} onReload={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('✓ Banco')).toBeInTheDocument()
    })
  })
})

// ============================================================
// SuppliersList
// ============================================================
describe('SuppliersList', () => {
  const suppliers = [
    makeSupplier({ id: 1, name: 'Taller Perez', cif: 'B12345678', contact_person: 'Juan' }),
    makeSupplier({ id: 2, name: 'Recambios Madrid', cif: 'B87654321', contact_person: 'Maria' }),
  ]

  it('renders supplier count', () => {
    render(<SuppliersList suppliers={suppliers} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('2 proveedores')).toBeInTheDocument()
  })

  it('renders supplier names in table', () => {
    render(<SuppliersList suppliers={suppliers} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('Taller Perez')).toBeInTheDocument()
    expect(screen.getByText('Recambios Madrid')).toBeInTheDocument()
  })

  it('shows singular form for one supplier', () => {
    render(<SuppliersList suppliers={[suppliers[0]]} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText('1 proveedor')).toBeInTheDocument()
  })

  it('shows empty state when no suppliers', () => {
    render(<SuppliersList suppliers={[]} companyId={1} onReload={vi.fn()} />)
    expect(screen.getByText(/Sin proveedores/)).toBeInTheDocument()
  })

  it('shows add form when button is clicked', () => {
    render(<SuppliersList suppliers={suppliers} companyId={1} onReload={vi.fn()} />)
    fireEvent.click(screen.getByText('Nuevo proveedor'))
    expect(screen.getByText('Nombre proveedor')).toBeInTheDocument()
  })
})
