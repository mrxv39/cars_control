import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OnboardingTour from '../components/web/OnboardingTour'
import ConfirmDialog from '../components/web/ConfirmDialog'
import EmptyState from '../components/web/EmptyState'
import { SkeletonCard, SkeletonGrid, SkeletonTable } from '../components/web/Skeleton'

// ---------------------------------------------------------------------------
// OnboardingTour
// ---------------------------------------------------------------------------
describe('OnboardingTour', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<OnboardingTour show={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the first step when show is true', () => {
    render(<OnboardingTour show={true} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Navegación')).toBeInTheDocument()
    expect(screen.getByText('Siguiente')).toBeInTheDocument()
    // "Anterior" should NOT appear on the first step
    expect(screen.queryByText('Anterior')).not.toBeInTheDocument()
  })

  it('navigates forward and backward through steps', () => {
    render(<OnboardingTour show={true} />)
    // Go to second step
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Anterior')).toBeInTheDocument()

    // Go back
    fireEvent.click(screen.getByText('Anterior'))
    expect(screen.getByText('Navegación')).toBeInTheDocument()
  })

  it('calls onClose and hides when "Saltar" is clicked', () => {
    const onClose = vi.fn()
    render(<OnboardingTour show={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Saltar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows "Empezar" on the last step and dismisses on click', () => {
    const onClose = vi.fn()
    render(<OnboardingTour show={true} onClose={onClose} />)
    // Navigate to the last step (5 steps total, click Siguiente 4 times)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText(i < 3 ? 'Siguiente' : 'Siguiente'))
    }
    expect(screen.getByText('Empezar')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Empezar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------
describe('ConfirmDialog', () => {
  const baseProps = {
    open: true,
    title: 'Confirmar eliminación',
    message: '¿Estás seguro?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('renders nothing when open is false', () => {
    const { container } = render(<ConfirmDialog {...baseProps} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders title, message and default button labels', () => {
    render(<ConfirmDialog {...baseProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Confirmar eliminación')).toBeInTheDocument()
    expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument()
    expect(screen.getByText('Eliminar')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('calls onConfirm and onCancel on respective button clicks', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Eliminar'))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('uses custom button labels and warning variant', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        confirmLabel="Sí, continuar"
        cancelLabel="No, volver"
        variant="warning"
      />
    )
    expect(screen.getByText('Sí, continuar')).toBeInTheDocument()
    expect(screen.getByText('No, volver')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
describe('EmptyState', () => {
  it('renders title only (minimal props)', () => {
    render(<EmptyState title="Sin resultados" />)
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('renders icon, title, and description', () => {
    render(<EmptyState icon="📦" title="Sin stock" description="Añade tu primer vehículo" />)
    expect(screen.getByText('📦')).toBeInTheDocument()
    expect(screen.getByText('Sin stock')).toBeInTheDocument()
    expect(screen.getByText('Añade tu primer vehículo')).toBeInTheDocument()
  })

  it('renders action button and fires onClick', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        title="Sin leads"
        action={{ label: 'Importar leads', onClick }}
      />
    )
    const btn = screen.getByRole('button', { name: 'Importar leads' })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
describe('Skeleton', () => {
  it('SkeletonCard renders three skeleton lines', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.querySelector('.skeleton-card')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(3)
  })

  it('SkeletonGrid renders the default 6 cards', () => {
    const { container } = render(<SkeletonGrid />)
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(6)
  })

  it('SkeletonGrid renders custom count', () => {
    const { container } = render(<SkeletonGrid count={3} />)
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(3)
  })

  it('SkeletonTable renders default 5 rows', () => {
    const { container } = render(<SkeletonTable />)
    expect(container.querySelectorAll('.skeleton-table-row')).toHaveLength(5)
  })

  it('SkeletonTable renders custom row count', () => {
    const { container } = render(<SkeletonTable rows={2} />)
    expect(container.querySelectorAll('.skeleton-table-row')).toHaveLength(2)
  })
})
