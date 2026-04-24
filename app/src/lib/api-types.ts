import type { VehicleBase, LeadBase, ClientBase, SalesRecordBase, PurchaseRecordBase } from "../shared-types";

/** Vehículo Web: extiende VehicleBase con id numérico y campos Supabase. */
export interface Vehicle extends VehicleBase {
  id: number;
  company_id: number;
  name: string;
  precio_compra: number | null;
  precio_venta: number | null;
  km: number | null;
  anio: number | null;
  estado: string;
  ad_url: string;
  ad_status: string;
  fuel: string;
  cv: string;
  transmission: string;
  color: string;
  notes: string;
  supplier_id: number | null;
  version?: string | null;
  doors?: number | null;
  seats?: number | null;
  body_type?: string | null;
  displacement?: number | null;
  emissions_co2?: string | null;
  environmental_label?: string | null;
  description?: string | null;
  equipment?: string[] | null;
  warranty?: string | null;
  city?: string | null;
  province?: string | null;
  needs_review?: boolean | null;
  plate?: string | null;
  vin?: string | null;
  motor_ok?: boolean | null;
  motor_ok_at?: string | null;
  motor_supplier_id?: number | null;
  motor_notes?: string | null;
  carroceria_ok?: boolean | null;
  carroceria_ok_at?: string | null;
  carroceria_supplier_id?: number | null;
  carroceria_notes?: string | null;
  neumaticos_ok?: boolean | null;
  neumaticos_ok_at?: string | null;
  neumaticos_supplier_id?: number | null;
  neumaticos_notes?: string | null;
  itv_ok?: boolean | null;
  itv_ok_at?: string | null;
  itv_supplier_id?: number | null;
  itv_notes?: string | null;
  limpieza_ok?: boolean | null;
  limpieza_ok_at?: string | null;
  limpieza_supplier_id?: number | null;
  limpieza_notes?: string | null;
}

export interface VehicleDocument {
  id: number;
  vehicle_id: number;
  doc_type: string;
  file_name: string;
  storage_path: string;
  notes: string;
  url: string;
}

export interface Lead extends LeadBase {
  company_id: number;
  vehicle_id: number | null;
  estado: string;
  fecha_contacto: string;
  canal: string;
  reply_to_email?: string | null;
}

export interface Client extends ClientBase {
  company_id: number;
  vehicle_id: number | null;
}

export interface SalesRecord extends SalesRecordBase {
  company_id: number;
  vehicle_id: number | null;
}

export interface PurchaseRecord extends PurchaseRecordBase {
  company_id: number;
  vehicle_id: number | null;
}

export interface Supplier {
  id: number;
  company_id: number;
  name: string;
  cif: string;
  address: string;
  phone: string;
  email: string;
  contact_person: string;
  notes: string;
  created_at: string;
}

export interface VehiclePhoto {
  id: number;
  vehicle_id: number;
  file_name: string;
  url: string;
  thumbUrl: string | null;
  is_primary?: boolean;
}

export interface ImportPreview {
  listing: Array<{
    externalId: string;
    url: string;
    make: string;
    model: string;
    year: number | null;
    km: number | null;
    price: number | null;
    fuelType: string | null;
    hp: number | null;
    imgUrl: string | null;
  }>;
  newDetails: Array<{
    externalId: string | null;
    url: string;
    name: string;
    make: string;
    model: string;
    version: string | null;
    year: number | null;
    km: number | null;
    price: number | null;
    fuelType: string | null;
    hp: number | null;
    color: string | null;
    transmission: string | null;
    doors: number | null;
    seats: number | null;
    bodyType: string | null;
    displacement: number | null;
    emissionsCo2: string | null;
    environmentalLabel: string | null;
    warranty: string | null;
    description: string | null;
    equipment: string[];
    photoUrls: string[];
    videoUrls: string[];
    city?: string | null;
    province?: string | null;
  }>;
  removedExternalIds: string[];
  fetchedAt: string;
}

export interface VehicleListing {
  id: number;
  vehicle_id: number;
  external_source: string;
  external_id: string;
  external_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  removed_at: string | null;
}

export interface VehicleInspection {
  id: number;
  vehicle_id: number;
  company_id: number;
  inspector_name: string | null;
  items: Record<string, { status: string | null; notes: string }>;
  resultado_general: string | null;
  created_at: string;
}

export interface LeadMessage {
  id: number;
  lead_id: number;
  sender: "lead" | "dealer";
  sender_name: string;
  content: string;
  timestamp: string;
  source: string;
}

export interface BankAccount {
  id: number;
  company_id: number;
  alias: string;
  iban: string | null;
  bank_name: string;
  account_type: "checking" | "credit_line";
  is_personal: boolean;
  provider: "gocardless" | "n43_manual";
  external_id: string | null;
  consent_expires_at: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface BankTransaction {
  id: number;
  bank_account_id: number;
  external_id: string;
  booking_date: string;
  value_date: string | null;
  amount: number;
  currency: string;
  counterparty_name: string;
  description: string;
  balance_after: number | null;
  category: string;
  linked_sale_id: number | null;
  linked_purchase_id: number | null;
  reviewed_by_user: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BankCategoryRule {
  id: number;
  company_id: number;
  pattern: string;
  category: string;
  default_expense_type: string | null;
  priority: number;
  active: boolean;
}

export interface BankTransactionFilters {
  fromDate?: string;
  toDate?: string;
  category?: string;
  onlyUnlinked?: boolean;
  onlyUnreviewed?: boolean;
  search?: string;
}
