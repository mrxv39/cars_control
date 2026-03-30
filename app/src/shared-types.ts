// Shared types between Tauri (App.tsx) and Web (WebApp.tsx) entry points.
// Base interfaces are extended by each platform's api module.

export interface VehicleBase {
  name: string;
  precio_compra: number | null;
  precio_venta: number | null;
  km: number | null;
  anio: number | null;
  estado: string;
}

export interface LeadBase {
  id: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
  vehicle_interest: string;
  converted_client_id: number | null;
  estado: string;
  fecha_contacto: string | null;
  canal: string;
}

export interface ClientBase {
  id: number;
  name: string;
  phone: string;
  email: string;
  dni: string;
  notes: string;
  source_lead_id: number | null;
}

export interface SalesRecordBase {
  id: number;
  vehicle_id: number | null;
  client_id: number | null;
  date: string;
  price_final: number;
  notes: string;
}

export interface PurchaseRecordBase {
  id: number;
  expense_type: string;
  vehicle_name: string;
  plate: string;
  supplier_name: string;
  purchase_date: string;
  purchase_price: number;
  invoice_number: string;
  payment_method: string;
  notes: string;
  source_file: string;
  created_at: string;
}

export interface LeadNote {
  id: number;
  lead_id: number;
  timestamp: string;
  content: string;
}

export interface Company {
  id: number;
  trade_name: string;
  legal_name: string;
  cif: string;
  address: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface User {
  id: number;
  company_id: number;
  full_name: string;
  username: string;
  role: string;
  active: boolean;
}

export interface LoginResult {
  user: User;
  company: Company;
}

// Form types (shared across platforms)

export type LeadForm = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  vehicle_interest: string;
  estado?: string;
  fecha_contacto?: string;
  canal?: string;
};

export type ClientForm = {
  name: string;
  phone: string;
  email: string;
  dni: string;
  notes: string;
};

export type StockAdForm = {
  url: string;
  status: string;
  date: string;
};

export type StockVehicleForm = {
  url: string;
  status: string;
  date: string;
  precio_compra?: number | null;
  precio_venta?: number | null;
  km?: number | null;
  anio?: number | null;
  estado?: string;
};

export const EMPTY_LEAD_FORM: LeadForm = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  vehicle_interest: "",
  estado: "nuevo",
  fecha_contacto: "",
  canal: "",
};

export const EMPTY_CLIENT_FORM: ClientForm = {
  name: "",
  phone: "",
  email: "",
  dni: "",
  notes: "",
};

export const EMPTY_AD_FORM: StockAdForm = {
  url: "",
  status: "",
  date: "",
};

export const EMPTY_STOCK_VEHICLE_FORM: StockVehicleForm = {
  url: "",
  status: "",
  date: "",
  precio_compra: null,
  precio_venta: null,
  km: null,
  anio: null,
  estado: "disponible",
};
