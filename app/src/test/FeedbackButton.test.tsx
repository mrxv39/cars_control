import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeedbackButton } from '../components/FeedbackButton'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

const defaultProps = {
  userName: 'Ricard',
  currentView: 'stock',
  stock: [] as any[],
  leads: [] as any[],
  clients: [] as any[],
  selectedVehicle: null,
};

describe('FeedbackButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders floating action button with title', () => {
    render(<FeedbackButton {...defaultProps} />);
    expect(screen.getByTitle('Sugerencias y optimizaciones')).toBeInTheDocument();
  });

  it('opens panel on FAB click', () => {
    render(<FeedbackButton {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Sugerencias y optimizaciones'));
    expect(screen.getByText(/Sugerencias/)).toBeInTheDocument();
  });

  it('shows message tab', () => {
    render(<FeedbackButton {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Sugerencias y optimizaciones'));
    fireEvent.click(screen.getByText('Enviar mensaje'));
    expect(screen.getByPlaceholderText(/Me gustaria poder/i)).toBeInTheDocument();
  });

  it('marks FAB as seen on click', () => {
    render(<FeedbackButton {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Sugerencias y optimizaciones'));
    expect(localStorage.getItem('cc_fab_seen')).toBeTruthy();
  });
});
