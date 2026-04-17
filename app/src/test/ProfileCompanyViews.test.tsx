import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileView, CompanyView } from '../components/web/ProfileCompanyViews'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getUser: vi.fn().mockResolvedValue(null),
    updateUser: vi.fn().mockResolvedValue(undefined),
    updateUserPassword: vi.fn().mockResolvedValue(undefined),
    getCompany: vi.fn().mockResolvedValue(null),
    updateCompany: vi.fn().mockResolvedValue(undefined),
  };
});

import * as api from '../lib/api';

const mockSession = {
  user: { id: 1, full_name: 'Ricard Codina', username: 'ricard', email: 'ricard@test.com', role: 'admin', company_id: 1 },
  company: { id: 1, trade_name: 'CodinaCars', legal_name: 'Codina SL', cif: 'B12345678', address: 'Barcelona', phone: '612345678', email: 'info@codinacars.com', website: 'https://codinacars.com' },
} as any;

describe('ProfileView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders profile header and user role', () => {
    render(<ProfileView session={mockSession} />);
    expect(screen.getByText('Perfil de usuario')).toBeInTheDocument();
    expect(screen.getByText(/Rol: Administrador/)).toBeInTheDocument();
  });

  it('renders form fields with session data', () => {
    render(<ProfileView session={mockSession} />);
    expect(screen.getByDisplayValue('Ricard Codina')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ricard')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ricard@test.com')).toBeInTheDocument();
  });

  it('shows password validation error for short password', async () => {
    render(<ProfileView session={mockSession} />);
    const pwInputs = screen.getAllByDisplayValue('') as HTMLInputElement[];
    const pwFields = pwInputs.filter((el) => el.type === 'password');
    fireEvent.change(pwFields[0], { target: { value: '123' } });
    fireEvent.change(pwFields[1], { target: { value: '123' } });
    fireEvent.submit(pwFields[0].closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/al menos 6 caracteres/)).toBeInTheDocument();
    });
  });

  it('shows password mismatch error', async () => {
    render(<ProfileView session={mockSession} />);
    const pwInputs = screen.getAllByDisplayValue('') as HTMLInputElement[];
    const pwFields = pwInputs.filter((el) => el.type === 'password');
    fireEvent.change(pwFields[0], { target: { value: 'abcdef' } });
    fireEvent.change(pwFields[1], { target: { value: 'xxxxxx' } });
    fireEvent.submit(pwFields[0].closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/no coinciden/)).toBeInTheDocument();
    });
  });

  it('calls updateUser on profile save', async () => {
    render(<ProfileView session={mockSession} />);
    const nameInput = screen.getByDisplayValue('Ricard Codina');
    fireEvent.change(nameInput, { target: { value: 'Ricard C.' } });
    fireEvent.submit(nameInput.closest('form')!);
    await waitFor(() => {
      expect(api.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ full_name: 'Ricard C.' }));
    });
  });
});

describe('CompanyView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders company header', () => {
    render(<CompanyView session={mockSession} />);
    expect(screen.getByText('Datos de la empresa')).toBeInTheDocument();
  });

  it('renders company form fields', () => {
    render(<CompanyView session={mockSession} />);
    expect(screen.getByDisplayValue('CodinaCars')).toBeInTheDocument();
    expect(screen.getByDisplayValue('B12345678')).toBeInTheDocument();
  });

  it('calls updateCompany on save', async () => {
    render(<CompanyView session={mockSession} />);
    const tradeInput = screen.getByDisplayValue('CodinaCars');
    fireEvent.change(tradeInput, { target: { value: 'CodinaCars 2.0' } });
    fireEvent.submit(tradeInput.closest('form')!);
    await waitFor(() => {
      expect(api.updateCompany).toHaveBeenCalledWith(1, expect.objectContaining({ trade_name: 'CodinaCars 2.0' }));
    });
  });

  it('shows success message after save', async () => {
    render(<CompanyView session={mockSession} />);
    fireEvent.submit(screen.getByDisplayValue('CodinaCars').closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/empresa actualizados/)).toBeInTheDocument();
    });
  });
});
