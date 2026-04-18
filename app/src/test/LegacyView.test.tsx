import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LegacyView } from '../components/LegacyView'
import type { LegacyEntryNode } from '../types'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

function makeNode(name: string, overrides: Partial<LegacyEntryNode> = {}): LegacyEntryNode {
  return {
    entry_path: `/fake/${name}`,
    open_path: `/fake/${name}`,
    name,
    is_dir: true,
    children: [],
    ...overrides,
  }
}

describe('LegacyView', () => {
  const baseProps = {
    fiscalEntries: [],
    fiscalRoot: null,
    fiscalMessage: null,
    gastosEntries: [],
    gastosRoot: null,
    gastosMessage: null,
    onReload: () => {},
  }

  it('renders header with count labels for empty state', () => {
    render(<LegacyView {...baseProps} />)
    expect(screen.getByText(/0 elementos fiscales/)).toBeInTheDocument()
    expect(screen.getByText(/0 elementos de gastos/)).toBeInTheDocument()
  })

  it('pluralises counts when only one element', () => {
    const props = {
      ...baseProps,
      fiscalEntries: [makeNode('2025')],
      gastosEntries: [makeNode('enero')],
    }
    render(<LegacyView {...props} />)
    expect(screen.getByText(/1 elemento fiscales/)).toBeInTheDocument()
    expect(screen.getByText(/1 elemento de gastos/)).toBeInTheDocument()
  })

  it('shows empty-state messages when no entries', () => {
    render(
      <LegacyView
        {...baseProps}
        fiscalMessage="Ruta fiscal no configurada"
        gastosMessage="Ruta gastos no configurada"
      />,
    )
    expect(screen.getByText('No hay contenido fiscal disponible')).toBeInTheDocument()
    expect(screen.getByText('No hay contenido de gastos disponible')).toBeInTheDocument()
    expect(screen.getByText('Ruta fiscal no configurada')).toBeInTheDocument()
    expect(screen.getByText('Ruta gastos no configurada')).toBeInTheDocument()
  })

  it('renders tree with nested children and open buttons', () => {
    const child = makeNode('2025.pdf', { is_dir: false, children: [] })
    const parent = makeNode('fiscal', { children: [child] })
    render(<LegacyView {...baseProps} fiscalEntries={[parent]} fiscalRoot="C:/docs_legacy/fiscal" />)

    expect(screen.getByText('fiscal')).toBeInTheDocument()
    expect(screen.getByText('2025.pdf')).toBeInTheDocument()
    expect(screen.getByText('C:/docs_legacy/fiscal')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /abrir carpeta contenedora/i })).toBeInTheDocument()
    // Parent (is_dir) has "Abrir carpeta" label; child (file) has "Abrir carpeta contenedora".
    const openDirBtns = screen.getAllByRole('button', { name: /^abrir carpeta$/i })
    expect(openDirBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onReload when clicking the reload button', () => {
    const onReload = vi.fn()
    render(<LegacyView {...baseProps} onReload={onReload} />)
    fireEvent.click(screen.getByRole('button', { name: /recargar/i }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })
})
