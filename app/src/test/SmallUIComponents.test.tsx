import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EmptyState from '../components/web/EmptyState'
import Spinner from '../components/web/Spinner'
import { SkeletonCard, SkeletonGrid, SkeletonTable } from '../components/web/Skeleton'
import UndoToast from '../components/web/UndoToast'

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Sin resultados" />)
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<EmptyState icon="🚗" title="Sin vehículos" />)
    expect(screen.getByText('🚗')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Sin stock" description="Añade tu primer vehículo" />)
    expect(screen.getByText('Añade tu primer vehículo')).toBeInTheDocument()
  })

  it('does not render description when omitted', () => {
    render(<EmptyState title="Sin stock" />)
    expect(screen.queryByText('Añade tu primer vehículo')).not.toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Sin leads" action={{ label: 'Añadir', onClick }} />)
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeInTheDocument()
  })

  it('calls action onClick when button is clicked', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Sin leads" action={{ label: 'Añadir', onClick }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not render action button when action is omitted', () => {
    render(<EmptyState title="Sin leads" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
describe('Spinner', () => {
  it('renders without label', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('.loading-screen')).toBeInTheDocument()
    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  it('renders with label text', () => {
    render(<Spinner label="Cargando..." />)
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
  })

  it('applies sm class when size is sm', () => {
    const { container } = render(<Spinner size="sm" />)
    expect(container.querySelector('.spinner.sm')).toBeInTheDocument()
  })

  it('applies lg class when size is lg', () => {
    const { container } = render(<Spinner size="lg" />)
    expect(container.querySelector('.spinner.lg')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
describe('Skeleton', () => {
  it('SkeletonCard renders with skeleton-card class', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.querySelector('.skeleton-card')).toBeInTheDocument()
  })

  it('SkeletonGrid renders 6 cards by default', () => {
    const { container } = render(<SkeletonGrid />)
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(6)
  })

  it('SkeletonGrid renders custom count of cards', () => {
    const { container } = render(<SkeletonGrid count={4} />)
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(4)
  })

  it('SkeletonTable renders 5 rows by default', () => {
    const { container } = render(<SkeletonTable />)
    expect(container.querySelectorAll('.skeleton-table-row')).toHaveLength(5)
  })

  it('SkeletonTable renders custom row count', () => {
    const { container } = render(<SkeletonTable rows={3} />)
    expect(container.querySelectorAll('.skeleton-table-row')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// UndoToast
// ---------------------------------------------------------------------------
describe('UndoToast', () => {
  it('renders the message', () => {
    render(
      <UndoToast
        message="Vehículo eliminado"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByText('Vehículo eliminado')).toBeInTheDocument()
  })

  it('calls onUndo when "Deshacer" button is clicked', () => {
    const onUndo = vi.fn()
    render(
      <UndoToast
        message="Vehículo eliminado"
        onUndo={onUndo}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Deshacer'))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <UndoToast
        message="Vehículo eliminado"
        onUndo={vi.fn()}
        onDismiss={onDismiss}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has role="alert"', () => {
    render(
      <UndoToast
        message="Vehículo eliminado"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
