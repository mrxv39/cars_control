import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    listVehiclePhotos: vi.fn(),
    listVehicleDocuments: vi.fn(),
    listVehicleListings: vi.fn(),
    deleteVehicle: vi.fn(),
    updateVehicle: vi.fn(),
    addSalesRecord: vi.fn(),
    uploadVehiclePhoto: vi.fn(),
    deleteVehiclePhoto: vi.fn(),
    setPrimaryPhoto: vi.fn(),
    uploadVehicleDocument: vi.fn(),
    deleteVehicleDocument: vi.fn(),
  };
});
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

import { translateError, VehicleDetail } from '../components/web/VehicleDetailPanel'
import * as api from '../lib/api'
import type { Lead } from '../lib/api'

const mockedApi = api as unknown as {
  listVehiclePhotos: ReturnType<typeof vi.fn>;
  listVehicleDocuments: ReturnType<typeof vi.fn>;
  listVehicleListings: ReturnType<typeof vi.fn>;
}

const mockVehicle = {
  id: 1, company_id: 1, name: 'SEAT Ibiza 1.0', plate: '1234 ABC',
  precio_compra: 8000, precio_venta: 10000, km: 50000, anio: 2019,
  estado: 'disponible', ad_url: '', ad_status: '', fuel: 'Gasolina',
  cv: '90', transmission: 'Manual', color: 'Blanco', notes: '',
  supplier_id: null, created_at: '2026-01-01',
} as any;

const defaultProps = {
  vehicle: mockVehicle,
  suppliers: [],
  leads: [],
  purchaseRecords: [],
  companyId: 1,
  clients: [],
  onBack: vi.fn(),
  onReload: vi.fn(),
  onOpenLead: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.listVehiclePhotos.mockResolvedValue([]);
  mockedApi.listVehicleDocuments.mockResolvedValue([]);
  mockedApi.listVehicleListings.mockResolvedValue([]);
});

// ── translateError ──────────────────────────────────────────────────────────

describe('translateError', () => {
  it('returns network error message for "Failed to fetch"', () => {
    expect(translateError(new Error('Failed to fetch'))).toBe(
      'Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.'
    );
  });

  it('returns network error message for "NetworkError"', () => {
    expect(translateError(new Error('NetworkError occurred'))).toBe(
      'Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.'
    );
  });

  it('returns session expired message for "JWT expired"', () => {
    expect(translateError(new Error('JWT expired'))).toBe(
      'Tu sesión ha caducado. Vuelve a iniciar sesión.'
    );
  });

  it('returns session expired message for "invalid claim"', () => {
    expect(translateError(new Error('invalid claim: iss'))).toBe(
      'Tu sesión ha caducado. Vuelve a iniciar sesión.'
    );
  });

  it('returns permission error message for "row-level security"', () => {
    expect(translateError(new Error('row-level security policy'))).toBe(
      'No tienes permiso para esta acción.'
    );
  });

  it('returns permission error message for "policy"', () => {
    expect(translateError(new Error('violates policy'))).toBe(
      'No tienes permiso para esta acción.'
    );
  });

  it('returns duplicate record message for "duplicate key"', () => {
    expect(translateError(new Error('duplicate key value'))).toBe(
      'Este registro ya existe.'
    );
  });

  it('returns duplicate record message for "unique constraint"', () => {
    expect(translateError(new Error('unique constraint violated'))).toBe(
      'Este registro ya existe.'
    );
  });

  it('returns foreign key message for error code 23503', () => {
    expect(translateError(new Error('error 23503: foreign key violation'))).toBe(
      'No se puede eliminar: hay datos vinculados.'
    );
  });

  it('returns foreign key message for "foreign key"', () => {
    expect(translateError(new Error('foreign key constraint fails'))).toBe(
      'No se puede eliminar: hay datos vinculados.'
    );
  });

  it('returns server error message for PGRST codes', () => {
    expect(translateError(new Error('PGRST116: row not found'))).toBe(
      'Error del servidor. Inténtalo de nuevo en unos minutos.'
    );
  });

  it('returns generic error message for unknown errors', () => {
    expect(translateError(new Error('something completely unknown happened'))).toBe(
      'Ha ocurrido un error inesperado. Inténtalo de nuevo.'
    );
  });

  it('handles non-Error values by converting to string', () => {
    expect(translateError('Failed to fetch data')).toBe(
      'Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.'
    );
  });

  it('handles plain string unknown errors', () => {
    expect(translateError('some random string')).toBe(
      'Ha ocurrido un error inesperado. Inténtalo de nuevo.'
    );
  });
});

// ── VehicleDetail component ─────────────────────────────────────────────────

describe('VehicleDetail', () => {
  it('renders the vehicle name', async () => {
    render(<VehicleDetail {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('SEAT Ibiza 1.0')).toBeInTheDocument();
    });
  });

  it('shows "Volver" button that calls onBack', async () => {
    const onBack = vi.fn();
    render(<VehicleDetail {...defaultProps} onBack={onBack} />);
    const backButton = await screen.findByText('← Volver');
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows margin warning when precio_venta is less than precio_compra', async () => {
    const vehicle = { ...mockVehicle, precio_compra: 10000, precio_venta: 8000 };
    render(<VehicleDetail {...defaultProps} vehicle={vehicle} />);
    await waitFor(() => {
      expect(screen.getByText(/Margen negativo/)).toBeInTheDocument();
    });
  });

  it('does not show margin warning when precio_venta is greater than precio_compra', async () => {
    render(<VehicleDetail {...defaultProps} />);
    await waitFor(() => {
      expect(screen.queryByText(/Margen negativo/)).not.toBeInTheDocument();
    });
  });

  it('shows "Sin leads" when no leads match the vehicle', async () => {
    render(<VehicleDetail {...defaultProps} leads={[]} />);
    await waitFor(() => {
      expect(screen.getByText('Sin leads')).toBeInTheDocument();
    });
  });

  it('shows lead names when leads match the vehicle', async () => {
    const leads: Lead[] = [
      {
        id: 10, name: 'Ana Martínez', phone: '612000000', email: 'ana@example.com',
        notes: '', vehicle_interest: '', converted_client_id: null,
        estado: 'nuevo', fecha_contacto: '2026-01-10', canal: 'web',
        company_id: 1, vehicle_id: mockVehicle.id,
      },
      {
        id: 11, name: 'Carlos Ruiz', phone: '622000000', email: 'carlos@example.com',
        notes: '', vehicle_interest: '', converted_client_id: null,
        estado: 'contactado', fecha_contacto: '2026-01-11', canal: 'llamada',
        company_id: 1, vehicle_id: mockVehicle.id,
      },
    ];
    render(<VehicleDetail {...defaultProps} leads={leads} />);
    await waitFor(() => {
      expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
      expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
    });
  });

  it('does not show leads from other vehicles', async () => {
    const leads: Lead[] = [
      {
        id: 20, name: 'Lead Otro Vehículo', phone: '', email: '',
        notes: '', vehicle_interest: '', converted_client_id: null,
        estado: 'nuevo', fecha_contacto: '', canal: 'web',
        company_id: 1, vehicle_id: 999,
      },
    ];
    render(<VehicleDetail {...defaultProps} leads={leads} />);
    await waitFor(() => {
      expect(screen.queryByText('Lead Otro Vehículo')).not.toBeInTheDocument();
      expect(screen.getByText('Sin leads')).toBeInTheDocument();
    });
  });
});
