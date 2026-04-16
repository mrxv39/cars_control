import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../components/ErrorBoundary'

function ProblemChild(): React.ReactNode {
  throw new Error('Test error')
}

function GoodChild() {
  return <p>All good</p>
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders error UI when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Algo ha ido mal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('logs error to console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    )
    expect(spy).toHaveBeenCalled()
    const errorCall = spy.mock.calls.find(c => c[0] === 'ErrorBoundary caught:')
    expect(errorCall).toBeDefined()
    spy.mockRestore()
  })
})
