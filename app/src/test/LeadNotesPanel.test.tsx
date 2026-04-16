import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LeadNotesPanel } from '../components/LeadNotesPanel'
import type { LeadNote } from '../types'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const { invoke } = await import('@tauri-apps/api/core')
const mockedInvoke = vi.mocked(invoke)

function makeNote(overrides: Partial<LeadNote> = {}): LeadNote {
  return {
    id: 1,
    lead_id: 10,
    timestamp: '2026-03-15T10:00:00Z',
    content: 'Llamar mañana',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LeadNotesPanel', () => {
  const defaultProps = {
    leadId: 10,
    notes: [] as LeadNote[],
    onNotesUpdated: vi.fn(),
    submitting: false,
  }

  it('shows empty state when no notes', () => {
    render(<LeadNotesPanel {...defaultProps} />)
    expect(screen.getByText(/Sin notas aún/)).toBeInTheDocument()
    expect(screen.getByText('0 notas registradas')).toBeInTheDocument()
  })

  it('renders notes list', () => {
    const notes = [
      makeNote({ id: 1, content: 'Primera llamada' }),
      makeNote({ id: 2, content: 'Enviar fotos', timestamp: '2026-03-16T14:00:00Z' }),
    ]
    render(<LeadNotesPanel {...defaultProps} notes={notes} />)
    expect(screen.getByText('Primera llamada')).toBeInTheDocument()
    expect(screen.getByText('Enviar fotos')).toBeInTheDocument()
    expect(screen.getByText('2 notas registradas')).toBeInTheDocument()
  })

  it('shows singular form for 1 note', () => {
    render(<LeadNotesPanel {...defaultProps} notes={[makeNote()]} />)
    expect(screen.getByText('1 nota registrada')).toBeInTheDocument()
  })

  it('disables add button when textarea is empty', () => {
    render(<LeadNotesPanel {...defaultProps} />)
    expect(screen.getByText('Añadir nota')).toBeDisabled()
  })

  it('enables add button when textarea has text', () => {
    render(<LeadNotesPanel {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText(/Añade una nota/), {
      target: { value: 'Nota nueva' },
    })
    expect(screen.getByText('Añadir nota')).not.toBeDisabled()
  })

  it('calls invoke and onNotesUpdated when adding a note', async () => {
    const updatedNotes = [makeNote({ id: 5, content: 'Nota nueva' })]
    mockedInvoke
      .mockResolvedValueOnce(undefined) // add_lead_note
      .mockResolvedValueOnce(updatedNotes) // get_lead_notes

    const onNotesUpdated = vi.fn()
    render(<LeadNotesPanel {...defaultProps} onNotesUpdated={onNotesUpdated} />)

    fireEvent.change(screen.getByPlaceholderText(/Añade una nota/), {
      target: { value: 'Nota nueva' },
    })
    fireEvent.click(screen.getByText('Añadir nota'))

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith('add_lead_note', { leadId: 10, content: 'Nota nueva' })
      expect(onNotesUpdated).toHaveBeenCalledWith(updatedNotes)
    })
  })

  it('does not add empty note', () => {
    render(<LeadNotesPanel {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText(/Añade una nota/), {
      target: { value: '   ' },
    })
    expect(screen.getByText('Añadir nota')).toBeDisabled()
  })

  it('disables inputs when submitting', () => {
    render(<LeadNotesPanel {...defaultProps} submitting={true} />)
    expect(screen.getByPlaceholderText(/Añade una nota/)).toBeDisabled()
    expect(screen.getByText('Añadir nota')).toBeDisabled()
  })

  it('shows error when invoke fails', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('Tauri error'))

    render(<LeadNotesPanel {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText(/Añade una nota/), {
      target: { value: 'test' },
    })
    fireEvent.click(screen.getByText('Añadir nota'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
