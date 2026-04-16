import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SalesView } from '../components/SalesView'
import type { SalesFolderNode } from '../types'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

function makeNode(overrides: Partial<SalesFolderNode> = {}): SalesFolderNode {
  return {
    name: 'Venta Seat Ibiza 2019',
    folder_path: '/docs_legacy/ventas/seat-ibiza-2019',
    children: [],
    ...overrides,
  }
}

describe('SalesView', () => {
  const defaultProps = {
    salesHistory: [
      makeNode({ name: 'Venta Seat Ibiza 2019', folder_path: '/ventas/seat-ibiza' }),
      makeNode({ name: 'Venta Ford Focus 2020', folder_path: '/ventas/ford-focus' }),
    ],
    salesRoot: '/docs_legacy/ventas',
    salesMessage: null,
    onReload: vi.fn(),
  }

  it('renders header', () => {
    render(<SalesView {...defaultProps} />)
    expect(screen.getByText('Ventas históricas')).toBeInTheDocument()
    expect(screen.getByText('Lectura desde docs_legacy')).toBeInTheDocument()
  })

  it('renders sales count label', () => {
    render(<SalesView {...defaultProps} />)
    expect(screen.getByText('2 carpetas de ventas')).toBeInTheDocument()
  })

  it('renders singular form for one sale', () => {
    render(<SalesView {...defaultProps} salesHistory={[defaultProps.salesHistory[0]]} />)
    expect(screen.getByText('1 carpeta de ventas')).toBeInTheDocument()
  })

  it('renders sales root path', () => {
    render(<SalesView {...defaultProps} />)
    expect(screen.getByText('/docs_legacy/ventas')).toBeInTheDocument()
  })

  it('renders "No disponible" when salesRoot is null', () => {
    render(<SalesView {...defaultProps} salesRoot={null} />)
    expect(screen.getByText('No disponible')).toBeInTheDocument()
  })

  it('renders folder names', () => {
    render(<SalesView {...defaultProps} />)
    expect(screen.getByText('Venta Seat Ibiza 2019')).toBeInTheDocument()
    expect(screen.getByText('Venta Ford Focus 2020')).toBeInTheDocument()
  })

  it('shows empty state when no sales history', () => {
    render(<SalesView {...defaultProps} salesHistory={[]} />)
    expect(screen.getByText('No hay ventas históricas disponibles')).toBeInTheDocument()
  })

  it('shows custom message in empty state', () => {
    render(<SalesView {...defaultProps} salesHistory={[]} salesMessage="Carpeta no encontrada" />)
    expect(screen.getByText('Carpeta no encontrada')).toBeInTheDocument()
  })

  it('calls onReload when Recargar is clicked', () => {
    render(<SalesView {...defaultProps} />)
    fireEvent.click(screen.getByText('Recargar'))
    expect(defaultProps.onReload).toHaveBeenCalled()
  })

  it('renders nested children', () => {
    const nodes = [
      makeNode({
        name: 'Ventas 2026',
        folder_path: '/ventas/2026',
        children: [
          makeNode({ name: 'Enero', folder_path: '/ventas/2026/enero' }),
        ],
      }),
    ]
    render(<SalesView {...defaultProps} salesHistory={nodes} />)
    expect(screen.getByText('Ventas 2026')).toBeInTheDocument()
    expect(screen.getByText('Enero')).toBeInTheDocument()
  })

  it('renders Abrir carpeta buttons for each node', () => {
    render(<SalesView {...defaultProps} />)
    const buttons = screen.getAllByText('Abrir carpeta')
    expect(buttons.length).toBe(2)
  })
})
