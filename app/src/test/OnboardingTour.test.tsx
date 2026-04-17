import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OnboardingTour, { resetOnboarding } from '../components/web/OnboardingTour'

const STORAGE_KEY = 'cc_onboarding_done'

describe('OnboardingTour', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('does not render when show=false', () => {
    render(<OnboardingTour show={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders first step "Navegación" when show=true', () => {
    render(<OnboardingTour show={true} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Navegación')).toBeInTheDocument()
  })

  it('advances to "Resumen" when Siguiente is clicked', () => {
    render(<OnboardingTour show={true} />)
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText('Resumen')).toBeInTheDocument()
  })

  it('goes back to previous step when Anterior is clicked', () => {
    render(<OnboardingTour show={true} />)
    fireEvent.click(screen.getByText('Siguiente'))
    expect(screen.getByText('Resumen')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Anterior'))
    expect(screen.getByText('Navegación')).toBeInTheDocument()
  })

  it('calls onClose when Saltar is clicked', () => {
    const onClose = vi.fn()
    render(<OnboardingTour show={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Saltar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows "Entendido" button on last step instead of "Siguiente"', () => {
    render(<OnboardingTour show={true} />)
    // Navigate to last step (index 4 = "Sugerencias")
    fireEvent.click(screen.getByText('Siguiente')) // → Resumen
    fireEvent.click(screen.getByText('Siguiente')) // → Stock
    fireEvent.click(screen.getByText('Siguiente')) // → Interesados
    fireEvent.click(screen.getByText('Siguiente')) // → Sugerencias
    expect(screen.getByText('Sugerencias')).toBeInTheDocument()
    expect(screen.getByText('Entendido')).toBeInTheDocument()
    expect(screen.queryByText('Siguiente')).toBeNull()
  })

  it('sets localStorage key on dismiss via Saltar', () => {
    render(<OnboardingTour show={true} />)
    fireEvent.click(screen.getByText('Saltar'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('sets localStorage key when Entendido is clicked on last step', () => {
    const onClose = vi.fn()
    render(<OnboardingTour show={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Siguiente')) // → Resumen
    fireEvent.click(screen.getByText('Siguiente')) // → Stock
    fireEvent.click(screen.getByText('Siguiente')) // → Interesados
    fireEvent.click(screen.getByText('Siguiente')) // → Sugerencias
    fireEvent.click(screen.getByText('Entendido'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resetOnboarding removes the localStorage key', () => {
    localStorage.setItem(STORAGE_KEY, '1')
    resetOnboarding()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
