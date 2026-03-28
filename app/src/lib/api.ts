import { supabase } from "./supabase";
import { verifyPassword } from "./hash";
import type { VehicleBase, LeadBase, ClientBase, SalesRecordBase, PurchaseRecordBase } from "../shared-types";

// Re-exportar tipos compartidos para que WebApp.tsx pueda seguir usando api.Company, api.User, etc.
export type { Company, User, LoginResult } from "../shared-types";
import type { LoginResult } from "../shared-types";

// Detect if running inside Tauri
export function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

// Re-exportar hashPassword para uso en platform-api.ts y otros módulos
export { hashPassword } from "./hash";

// ============================================================
// Types — extensiones Web/Supabase de los tipos base compartidos
// ============================================================

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

/** Lead Web: extiende LeadBase con company_id y vehicle_id numérico. */
export interface Lead extends LeadBase {
  company_id: number;
  vehicle_id: number | null;
  estado: string;
  fecha_contacto: string;
  canal: string;
}

/** Cliente Web: extiende ClientBase con company_id y vehicle_id numérico. */
export interface Client extends ClientBase {
  company_id: number;
  vehicle_id: number | null;
}

/** Registro de venta Web: extiende SalesRecordBase con company_id y vehicle_id. */
export interface SalesRecord extends SalesRecordBase {
  company_id: number;
  vehicle_id: number | null;
}

/** Registro de compra Web: extiende PurchaseRecordBase con company_id y vehicle_id. */
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
}

// ============================================================
// Auth — Login con migración gradual SHA-256 → PBKDF2
// ============================================================

export async function login(username: string, password: string): Promise<LoginResult> {
  // 1. Buscar usuario por username (sin comparar hash en la query)
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, company_id, full_name, username, password_hash, role, active")
    .eq("username", username)
    .eq("active", true)
    .single();

  if (userErr || !user) throw new Error("Usuario o contrasena incorrectos.");

  // 2. Verificar password (soporta PBKDF2 nuevo y SHA-256 legacy)
  const { valid, newHash } = await verifyPassword(password, user.password_hash);
  if (!valid) throw new Error("Usuario o contrasena incorrectos.");

  // 3. Si el hash era legacy SHA-256, migrar silenciosamente a PBKDF2
  if (newHash) {
    await supabase
      .from("users")
      .update({ password_hash: newHash })
      .eq("id", user.id);
    // No bloquear login si la actualización falla — el usuario ya está autenticado
  }

  // 4. Obtener empresa
  const { data: company, error: compErr } = await supabase
    .from("companies")
    .select("*")
    .eq("id", user.company_id)
    .single();

  if (compErr || !company) throw new Error("Empresa no encontrada.");

  return {
    user: { id: user.id, company_id: user.company_id, full_name: user.full_name, username: user.username, role: user.role, active: user.active },
    company,
  };
}

// ============================================================
// Vehicles
// ============================================================

export async function listVehicles(companyId: number): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("company_id", companyId)
    .neq("estado", "vendido")
    .order("name");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listAllVehicles(companyId: number): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getVehicle(id: number): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createVehicle(companyId: number, fields: Partial<Vehicle> & { name: string }): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      company_id: companyId,
      name: fields.name,
      estado: fields.estado || "disponible",
      anio: fields.anio ?? null,
      km: fields.km ?? null,
      precio_compra: fields.precio_compra ?? null,
      precio_venta: fields.precio_venta ?? null,
      fuel: fields.fuel || "",
      color: fields.color || "",
      notes: fields.notes || "",
      ad_url: fields.ad_url || "",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateVehicle(id: number, updates: Partial<Vehicle>): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteVehicle(id: number): Promise<void> {
  // Remove photos from storage first
  const { data: photos } = await supabase
    .from("vehicle_photos")
    .select("storage_path")
    .eq("vehicle_id", id);
  if (photos && photos.length > 0) {
    await supabase.storage
      .from("vehicle-photos")
      .remove(photos.map((p) => p.storage_path));
  }

  // Unlink leads and sales that reference this vehicle (don't delete them)
  await supabase.from("leads").update({ vehicle_id: null }).eq("vehicle_id", id);
  await supabase.from("sales_records").update({ vehicle_id: null }).eq("vehicle_id", id);
  await supabase.from("purchase_records").update({ vehicle_id: null }).eq("vehicle_id", id);
  await supabase.from("clients").update({ vehicle_id: null }).eq("vehicle_id", id);

  // vehicle_photos has ON DELETE CASCADE, but delete explicitly to be safe
  await supabase.from("vehicle_photos").delete().eq("vehicle_id", id);

  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Vehicle Photos
// ============================================================

export async function listVehiclePhotos(vehicleId: number): Promise<VehiclePhoto[]> {
  const { data, error } = await supabase
    .from("vehicle_photos")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("created_at");
  if (error) throw new Error(error.message);

  return (data || []).map((p) => ({
    ...p,
    url: supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path).data.publicUrl,
  }));
}

export async function uploadVehiclePhoto(vehicleId: number, file: File): Promise<VehiclePhoto> {
  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `${vehicleId}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("vehicle-photos")
    .upload(storagePath, file);
  if (uploadErr) throw new Error(uploadErr.message);

  const { data, error } = await supabase
    .from("vehicle_photos")
    .insert({ vehicle_id: vehicleId, file_name: file.name, storage_path: storagePath })
    .select()
    .single();
  if (error) throw new Error(error.message);

  return {
    ...data,
    url: supabase.storage.from("vehicle-photos").getPublicUrl(storagePath).data.publicUrl,
  };
}

export async function deleteVehiclePhoto(photo: VehiclePhoto): Promise<void> {
  const { data: row } = await supabase.from("vehicle_photos").select("storage_path").eq("id", photo.id).single();
  if (row) {
    await supabase.storage.from("vehicle-photos").remove([row.storage_path]);
  }
  await supabase.from("vehicle_photos").delete().eq("id", photo.id);
}

// ============================================================
// Leads
// ============================================================

export async function listLeads(companyId: number): Promise<Lead[]> {
  const { data, error } = await supabase.from("leads").select("*").eq("company_id", companyId).order("name");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createLead(companyId: number, input: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from("leads").insert({ ...input, company_id: companyId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLead(id: number, input: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from("leads").update(input).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteLead(id: number): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Clients
// ============================================================

export async function listClients(companyId: number): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").eq("company_id", companyId).order("name");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createClient(companyId: number, input: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase.from("clients").insert({ ...input, company_id: companyId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateClient(id: number, input: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase.from("clients").update(input).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteClient(id: number): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Sales Records
// ============================================================

export async function listSalesRecords(companyId: number): Promise<SalesRecord[]> {
  const { data, error } = await supabase.from("sales_records").select("*").eq("company_id", companyId).order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addSalesRecord(companyId: number, input: Partial<SalesRecord>): Promise<SalesRecord> {
  const { data, error } = await supabase.from("sales_records").insert({ ...input, company_id: companyId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSalesRecord(id: number): Promise<void> {
  const { error } = await supabase.from("sales_records").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Purchase Records
// ============================================================

export async function listPurchaseRecords(companyId: number): Promise<PurchaseRecord[]> {
  const { data, error } = await supabase.from("purchase_records").select("*").eq("company_id", companyId).order("purchase_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addPurchaseRecord(companyId: number, input: Partial<PurchaseRecord>): Promise<PurchaseRecord> {
  const { data, error } = await supabase.from("purchase_records").insert({ ...input, company_id: companyId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePurchaseRecord(id: number): Promise<void> {
  const { error } = await supabase.from("purchase_records").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Suppliers
// ============================================================

export async function listSuppliers(companyId: number): Promise<Supplier[]> {
  const { data, error } = await supabase.from("suppliers").select("*").eq("company_id", companyId).order("name");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createSupplier(companyId: number, input: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").insert({ ...input, company_id: companyId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSupplier(id: number, input: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").update(input).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSupplier(id: number): Promise<void> {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Vehicle Documents
// ============================================================

export async function listVehicleDocuments(vehicleId: number): Promise<VehicleDocument[]> {
  const { data, error } = await supabase.from("vehicle_documents").select("*").eq("vehicle_id", vehicleId).order("created_at");
  if (error) throw new Error(error.message);
  return (data || []).map((d) => ({
    ...d,
    url: supabase.storage.from("vehicle-docs").getPublicUrl(d.storage_path).data.publicUrl,
  }));
}

export async function uploadVehicleDocument(vehicleId: number, file: File, docType: string): Promise<VehicleDocument> {
  const storagePath = `${vehicleId}/${docType}/${file.name}`;
  const { error: uploadErr } = await supabase.storage.from("vehicle-docs").upload(storagePath, file, { upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data, error } = await supabase.from("vehicle_documents")
    .insert({ vehicle_id: vehicleId, file_name: file.name, storage_path: storagePath, doc_type: docType })
    .select().single();
  if (error) throw new Error(error.message);
  return { ...data, url: supabase.storage.from("vehicle-docs").getPublicUrl(storagePath).data.publicUrl };
}

export async function deleteVehicleDocument(doc: VehicleDocument): Promise<void> {
  const { data: row } = await supabase.from("vehicle_documents").select("storage_path").eq("id", doc.id).single();
  if (row) {
    await supabase.storage.from("vehicle-docs").remove([row.storage_path]);
  }
  await supabase.from("vehicle_documents").delete().eq("id", doc.id);
}

// ============================================================
// Vehicle Inspections
// ============================================================

export interface VehicleInspection {
  id: number;
  vehicle_id: number;
  company_id: number;
  inspector_name: string | null;
  items: Record<string, { status: string | null; notes: string }>;
  resultado_general: string | null;
  created_at: string;
}

export async function listVehicleInspections(vehicleId: number): Promise<VehicleInspection[]> {
  const { data, error } = await supabase
    .from("vehicle_inspections")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function deleteVehicleInspection(id: number): Promise<void> {
  const { error } = await supabase.from("vehicle_inspections").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
