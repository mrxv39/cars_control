import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock all heavy dependencies to avoid pulling in the entire app tree
vi.mock('../lib/api', () => ({
  login: vi.fn(),
  listVehicles: vi.fn().mockResolvedValue([]),
  listAllVehicles: vi.fn().mockResolvedValue([]),
  listLeads: vi.fn().mockResolvedValue([]),
  listClients: vi.fn().mockResolvedValue([]),
  listSalesRecords: vi.fn().mockResolvedValue([]),
  listPurchaseRecords: vi.fn().mockResolvedValue([]),
  listSuppliers: vi.fn().mockResolvedValue([]),
}))

vi.mock('../lib/platform-api', () => ({
  signInWithGoogle: vi.fn(),
  linkOAuthSession: vi.fn(),
  signOutOAuth: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ data: [], error: null }) }) },
}))

vi.mock('../components/web/PublicCatalog', () => ({
  PublicCatalog: ({ onLogin }: { onLogin: () => void }) => <div data-testid="public-catalog"><button onClick={onLogin}>Login</button></div>,
  CatalogHeader: ({ onLogin, onCatalog }: { onLogin: () => void; onCatalog: () => void }) => <header data-testid="catalog-header"><button onClick={onLogin}>Login</button><button onClick={onCatalog}>Catalog</button></header>,
}))

vi.mock('../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Stub lucide-react icons
const IconStub = () => <span data-testid="icon" />
vi.mock('lucide-react/dist/esm/icons/layout-dashboard', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/car', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/receipt', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/shopping-cart', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/landmark', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/truck', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/users', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/user-check', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/clipboard-check', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/building-2', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/user', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/log-out', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/search', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/menu', () => ({ default: IconStub }))
vi.mock('lucide-react/dist/esm/icons/x', () => ({ default: IconStub }))

// Stub heavy child components
vi.mock('../components/web/WebDashboard', () => ({ WebDashboard: () => <div data-testid="web-dashboard" /> }))
vi.mock('../components/web/StockList', () => ({ StockList: () => <div data-testid="stock-list" /> }))
vi.mock('../components/web/LeadsList', () => ({ LeadsList: () => <div data-testid="leads-list" /> }))
vi.mock('../components/web/RecordLists', () => ({
  ClientsList: () => <div />,
  SalesList: () => <div />,
  PurchasesList: () => <div />,
  SuppliersList: () => <div />,
}))
vi.mock('../components/web/VehicleDetailPanel', () => ({
  VehicleDetail: () => <div />,
}))
vi.mock('../components/web/Skeleton', () => ({
  SkeletonGrid: () => <div data-testid="skeleton-grid" />,
}))
vi.mock('../components/web/OnboardingTour', () => ({
  default: () => null,
}))
vi.mock('../components/web/RevisionSheet', () => ({
  RevisionSheet: () => <div />,
}))
vi.mock('../components/web/ProfileCompanyViews', () => ({
  ProfileView: () => <div />,
  CompanyView: () => <div />,
}))
vi.mock('../components/BankList', () => ({
  BankList: () => <div />,
}))
vi.mock('../components/FeedbackButton', () => ({
  FeedbackButton: () => null,
}))
vi.mock('../components/platform/PlatformLayout', () => ({
  PlatformLayout: () => <div />,
}))
vi.mock('../components/platform/RegistrationPage', () => ({
  RegistrationPage: ({ onBackToLogin }: { onBackToLogin: () => void }) => <div data-testid="registration-page"><button onClick={onBackToLogin}>Back</button></div>,
}))
vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}))

describe('WebApp', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset hostname to localhost (both mode)
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', hash: '', pathname: '/', href: 'http://localhost:3000' },
      writable: true,
      configurable: true,
    })
    vi.resetModules()
  })

  async function importAndRender() {
    const mod = await import('../WebApp')
    const WebApp = mod.default
    return render(<WebApp />)
  }

  it('shows public catalog by default on localhost with no session', async () => {
    await importAndRender()
    expect(screen.getByTestId('public-catalog')).toBeInTheDocument()
  })

  it('shows login page on admin domain (carscontrol)', async () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'carscontrol.vercel.app', hash: '', pathname: '/', href: 'https://carscontrol.vercel.app' },
      writable: true,
      configurable: true,
    })
    await importAndRender()
    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument()
  })

  it('shows login form with email and password fields', async () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'carscontrol.vercel.app', hash: '', pathname: '/', href: 'https://carscontrol.vercel.app' },
      writable: true,
      configurable: true,
    })
    await importAndRender()
    expect(screen.getByLabelText(/Email o usuario/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Contraseña/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('shows Google login button on login page', async () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'carscontrol.vercel.app', hash: '', pathname: '/', href: 'https://carscontrol.vercel.app' },
      writable: true,
      configurable: true,
    })
    await importAndRender()
    expect(screen.getByText('Entrar con Google')).toBeInTheDocument()
  })

  it('shows field validation errors on empty submit', async () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'carscontrol.vercel.app', hash: '', pathname: '/', href: 'https://carscontrol.vercel.app' },
      writable: true,
      configurable: true,
    })
    await importAndRender()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Usuario obligatorio')).toBeInTheDocument()
    expect(screen.getByText('Contraseña obligatoria')).toBeInTheDocument()
  })

  it('shows register link on login page', async () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'carscontrol.vercel.app', hash: '', pathname: '/', href: 'https://carscontrol.vercel.app' },
      writable: true,
      configurable: true,
    })
    await importAndRender()
    expect(screen.getByText(/No tienes cuenta/)).toBeInTheDocument()
  })

  it('restores session from localStorage and shows admin panel', async () => {
    const session = {
      user: { id: 1, full_name: 'Ricard', username: 'ricard', email: 'ricard@test.com', role: 'admin' },
      company: { id: 1, trade_name: 'CodinaCars', legal_name: 'CodinaCars SL', cif: '', address: '', phone: '', email: '', website: '' },
    }
    localStorage.setItem('cc_session', JSON.stringify(session))
    await importAndRender()
    // Wait for loadAll to resolve and loading skeleton to disappear
    await waitFor(() => expect(screen.getByText('CodinaCars')).toBeInTheDocument())
  })

  it('shows nav items in authenticated panel', async () => {
    const session = {
      user: { id: 1, full_name: 'Ricard', username: 'ricard', email: 'ricard@test.com', role: 'admin' },
      company: { id: 1, trade_name: 'CodinaCars', legal_name: 'CodinaCars SL', cif: '', address: '', phone: '', email: '', website: '' },
    }
    localStorage.setItem('cc_session', JSON.stringify(session))
    await importAndRender()
    await waitFor(() => expect(screen.getByText('Resumen')).toBeInTheDocument())
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText('Ventas')).toBeInTheDocument()
    expect(screen.getByText('Interesados')).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.getByText('Banco')).toBeInTheDocument()
  })

  it('shows Cerrar sesión button in authenticated panel', async () => {
    const session = {
      user: { id: 1, full_name: 'Ricard', username: 'ricard', email: 'ricard@test.com', role: 'admin' },
      company: { id: 1, trade_name: 'CodinaCars', legal_name: 'CodinaCars SL', cif: '', address: '', phone: '', email: '', website: '' },
    }
    localStorage.setItem('cc_session', JSON.stringify(session))
    await importAndRender()
    await waitFor(() => expect(screen.getByText(/Cerrar sesión/)).toBeInTheDocument())
  })
})
