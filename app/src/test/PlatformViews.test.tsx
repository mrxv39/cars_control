import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlatformLayout } from '../components/platform/PlatformLayout'
import { RegistrationPage } from '../components/platform/RegistrationPage'

describe('PlatformLayout', () => {
  it('greets the current user by name', () => {
    render(<PlatformLayout userId={1} userName="Ricard" onBackToCompany={() => {}} />)
    expect(screen.getByRole('heading', { level: 1, name: /bienvenido, ricard/i })).toBeInTheDocument()
  })

  it('invokes onBackToCompany when clicking the back button', () => {
    const onBack = vi.fn()
    render(<PlatformLayout userId={42} userName="Ricard" onBackToCompany={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /volver a la empresa/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('RegistrationPage', () => {
  it('shows the registration stub heading', () => {
    render(<RegistrationPage onBackToLogin={() => {}} />)
    expect(screen.getByRole('heading', { level: 1, name: /registro de empresa/i })).toBeInTheDocument()
  })

  it('invokes onBackToLogin when clicking the back button', () => {
    const onBack = vi.fn()
    render(<RegistrationPage onBackToLogin={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /volver al login/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
