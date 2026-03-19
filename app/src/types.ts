export type ViewKey = "dashboard" | "stock" | "leads" | "clients" | "sales" | "legacy" | "reminders" | "sales_records" | "purchases" | "suppliers";

export interface VehicleAdInfo {
  url: string;
  status: string;
  date: string;
}

export interface StockVehicle {
  name: string;
  folder_path: string;
  ad_info: VehicleAdInfo | null;
  precio_compra?: number | null;
  precio_venta?: number | null;
  km?: number | null;
  anio?: number | null;
  estado?: string;
}

export interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
  vehicle_interest: string;
  vehicle_folder_path: string | null;
  converted_client_id: number | null;
  estado?: string;
  fecha_contacto?: string | null;
  canal?: string | null;
}

export interface LeadNote {
  id: number;
  lead_id: number;
  timestamp: string;
  content: string;
}

export interface SalesRecord {
  id: number;
  vehicle_folder_path: string;
  client_id?: number | null;
  lead_id?: number | null;
  price_final: number;
  date: string;
  notes: string;
}

export interface PurchaseRecord {
  id: number;
  expense_type: string;
  vehicle_folder_path: string;
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
  created_at: string;
}

export interface LoginResult {
  user: User;
  company: Company;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  dni: string;
  notes: string;
  vehicle_folder_path: string | null;
  source_lead_id: number | null;
}

export interface SalesFolderNode {
  name: string;
  folder_path: string;
  children: SalesFolderNode[];
}

export interface LegacyEntryNode {
  name: string;
  entry_path: string;
  open_path: string;
  is_dir: boolean;
  children: LegacyEntryNode[];
}

export interface AppStatePayload {
  stock_folder: string;
  stock: StockVehicle[];
  leads: Lead[];
  clients: Client[];
  sales_root: string | null;
  sales_history: SalesFolderNode[];
  sales_message: string | null;
  fiscal_root: string | null;
  fiscal_entries: LegacyEntryNode[];
  fiscal_message: string | null;
  gastos_root: string | null;
  gastos_entries: LegacyEntryNode[];
  gastos_message: string | null;
}

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

export type StockModal = { mode: "create" } | { mode: "edit"; vehicle: StockVehicle } | null;

export type LeadModal = { mode: "create" } | { mode: "edit"; lead: Lead } | null;

export type ClientModal =
  | { mode: "create"; sourceLeadId?: number; title?: string }
  | { mode: "edit"; client: Client }
  | null;

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
