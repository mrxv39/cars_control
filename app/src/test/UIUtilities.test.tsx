import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from '../components/web/ConfirmDialog'
import { PaginationControls } from '../components/web/PaginationControls'
import EmptyState from '../components/web/EmptyState'
import { SkeletonCard, SkeletonGrid, SkeletonTable } from '../components/web/Skeleton'
import Spinner from '../components/web/Spinner'
import UndoToast from '../components/web/UndoToast'

// ============================================================
// ConfirmDialog
// ============================================================
describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    title: 'Eliminar elemento',
    message: '¿Estás seguro de que quieres eliminar este elemento?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Eliminar elemento')).toBeInTheDocument()
    expect(screen.getByText('¿Estás seguro de que quieres eliminar este elemento?')).toBeInTheDocument()
  })

  it('renders default button labels', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Eliminar')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('renders custom button labels', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Sí, borrar" cancelLabel="No, volver" />)
    expect(screen.getByText('Sí, borrar')).toBeInTheDocument()
    expect(screen.getByText('No, volver')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Eliminar'))
    expect(defaultProps.onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when overlay is clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })

  it('has danger button for danger variant', () => {
    render(<ConfirmDialog {...defaultProps} variant="danger" />)
    const confirmBtn = screen.getByText('Eliminar')
    expect(confirmBtn.className).toContain('danger')
  })

  it('has primary button for warning variant', () => {
    render(<ConfirmDialog {...defaultProps} variant="warning" />)
    const confirmBtn = screen.getByText('Eliminar')
    expect(confirmBtn.className).toContain('primary')
  })

  it('has proper aria attributes', () => {
    render(<ConfirmDialog {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-title')
  })
})

// ============================================================
// PaginationControls
// ============================================================
describe('PaginationControls', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(<PaginationControls page={0} totalPages={1} setPage={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders page info when multiple pages', () => {
    render(<PaginationControls page={0} totalPages={3} setPage={vi.fn()} />)
    expect(screen.getByText('Pagina 1 de 3')).toBeInTheDocument()
  })

  it('disables Anterior on first page', () => {
    render(<PaginationControls page={0} totalPages={3} setPage={vi.fn()} />)
    expect(screen.getByText('Anterior')).toBeDisabled()
  })

  it('disables Siguiente on last page', () => {
    render(<PaginationControls page={2} totalPages={3} setPage={vi.fn()} />)
    expect(screen.getByText('Siguiente')).toBeDisabled()
  })

  it('enables both buttons on middle page', () => {
    render(<PaginationControls page={1} totalPages={3} setPage={vi.fn()} />)
    expect(screen.getByText('Anterior')).not.toBeDisabled()
    expect(screen.getByText('Siguiente')).not.toBeDisabled()
  })

  it('calls setPage with previous page on Anterior click', () => {
    const setPage = vi.fn()
    render(<PaginationControls page={1} totalPages={3} setPage={setPage} />)
    fireEvent.click(screen.getByText('Anterior'))
    expect(setPage).toHaveBeenCalledWith(0)
  })

  it('calls setPage with next page on Siguiente click', () => {
    const setPage = vi.fn()
    render(<PaginationControls page={1} totalPages={3} setPage={setPage} />)
    fireEvent.click(screen.getByText('Siguiente'))
    expect(setPage).toHaveBeenCalledWith(2)
  })
})

// ============================================================
// EmptyState
// ============================================================
describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No hay datos" />)
    expect(screen.getByText('No hay datos')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Sin datos" description="Añade algo para empezar." />)
    expect(screen.getByText('Añade algo para empezar.')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<EmptyState icon="📦" title="Sin datos" />)
    expect(screen.getByText('📦')).toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Sin datos" action={{ label: 'Crear nuevo', onClick }} />)
    const btn = screen.getByText('Crear nuevo')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalled()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="Sin datos" />)
    expect(container.querySelector('.empty-state-desc')).toBeNull()
  })
})

// ============================================================
// Skeleton
// ============================================================
describe('Skeleton', () => {
  it('renders SkeletonCard with three skeleton lines', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.querySelectorAll('.skeleton-line').length).toBe(3)
  })

  it('renders SkeletonGrid with default 6 cards', () => {
    const { container } = render(<SkeletonGrid />)
    expect(container.querySelectorAll('.skeleton-card').length).toBe(6)
  })

  it('renders SkeletonGrid with custom count', () => {
    const { container } = render(<SkeletonGrid count={3} />)
    expect(container.querySelectorAll('.skeleton-card').length).toBe(3)
  })

  it('renders SkeletonTable with default 5 rows', () => {
    const { container } = render(<SkeletonTable />)
    expect(container.querySelectorAll('.skeleton-table-row').length).toBe(5)
  })

  it('renders SkeletonTable with custom rows', () => {
    const { container } = render(<SkeletonTable rows={3} />)
    expect(container.querySelectorAll('.skeleton-table-row').length).toBe(3)
  })
})

// ============================================================
// Spinner
// ============================================================
describe('Spinner', () => {
  it('renders without label', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('.spinner')).toBeTruthy()
  })

  it('renders with label', () => {
    render(<Spinner label="Cargando datos..." />)
    expect(screen.getByText('Cargando datos...')).toBeInTheDocument()
  })

  it('applies sm class for small size', () => {
    const { container } = render(<Spinner size="sm" />)
    expect(container.querySelector('.spinner.sm')).toBeTruthy()
  })

  it('applies lg class for large size', () => {
    const { container } = render(<Spinner size="lg" />)
    expect(container.querySelector('.spinner.lg')).toBeTruthy()
  })

  it('applies no size class for default md', () => {
    const { container } = render(<Spinner size="md" />)
    const spinner = container.querySelector('.spinner')
    expect(spinner?.className).toBe('spinner ')
  })
})

// ============================================================
// UndoToast
// ============================================================
describe('UndoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders message', () => {
    render(<UndoToast message="Elemento eliminado" onUndo={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText('Elemento eliminado')).toBeInTheDocument()
  })

  it('renders Deshacer button', () => {
    render(<UndoToast message="Test" onUndo={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText('Deshacer')).toBeInTheDocument()
  })

  it('calls onUndo when Deshacer is clicked', () => {
    const onUndo = vi.fn()
    render(<UndoToast message="Test" onUndo={onUndo} onDismiss={vi.fn()} />)
    fireEvent.click(screen.getByText('Deshacer'))
    expect(onUndo).toHaveBeenCalled()
  })

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn()
    render(<UndoToast message="Test" onUndo={vi.fn()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('Cerrar'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('has role="alert" for accessibility', () => {
    render(<UndoToast message="Test" onUndo={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('has a progress bar', () => {
    const { container } = render(<UndoToast message="Test" onUndo={vi.fn()} onDismiss={vi.fn()} />)
    expect(container.querySelector('.undo-toast-progress')).toBeTruthy()
  })
})
