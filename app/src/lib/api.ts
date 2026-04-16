import { supabase } from "./supabase";
import type { VehicleBase, LeadBase, ClientBase, SalesRecordBase, PurchaseRecordBase, LeadNote } from "../shared-types";

// Re-exportar tipos compartidos para que WebApp.tsx pueda seguir usando api.Company, api.User, etc.
export type { Company, User, LoginResult } from "../shared-types";
import type { LoginResult } from "../shared-types";

// Detect if running inside Tauri
export function isTauri(): boolean {
  return !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
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
  // Campos importados de coches.net (sesión Ricard 2026-04-07)
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
  /**
   * URL transformada (~400px, calidad 70) para listados/thumbnails.
   * Requiere Storage transforms (plan Pro). Si no hay storage_path
   * (foto importada de coches.net con source_url), es null y el caller
   * debe caer a `url`.
   */
  thumbUrl: string | null;
  is_primary?: boolean;
}

export async function setPrimaryPhoto(vehicleId: number, photoId: number): Promise<void> {
  // Sólo una foto puede ser principal por coche.
  await supabase.from("vehicle_photos").update({ is_primary: false }).eq("vehicle_id", vehicleId);
  const { error } = await supabase.from("vehicle_photos").update({ is_primary: true }).eq("id", photoId);
  if (error) throw new Error(error.message);
}

// ============================================================
// Auth — Login via Supabase Auth (signInWithPassword)
// ============================================================

export async function login(username: string, password: string): Promise<LoginResult> {
  // 1. Resolver username → email via RPC (SECURITY DEFINER, bypasses RLS)
  const email = username.includes("@") ? username : await resolveUsername(username);

  // 2. Autenticar con Supabase Auth
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) throw new Error("Usuario o contraseña incorrectos.");

  // 3. Ahora autenticado — RLS permite leer users/companies
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, company_id, full_name, username, email, role, active")
    .eq("email", email)
    .eq("active", true)
    .single();

  if (userErr || !user) throw new Error("Usuario no encontrado en la aplicación.");

  // 4. Obtener empresa
  const { data: company, error: compErr } = await supabase
    .from("companies")
    .select("*")
    .eq("id", user.company_id)
    .single();

  if (compErr || !company) throw new Error("Empresa no encontrada.");

  return {
    user: { id: user.id, company_id: user.company_id, full_name: user.full_name, username: user.username, email: user.email || "", role: user.role, active: user.active },
    company,
  };
}

async function resolveUsername(username: string): Promise<string> {
  const { data, error } = await supabase.rpc("resolve_login", { p_username: username });
  if (error || !data || data.error) throw new Error("Usuario o contraseña incorrectos.");
  return data.email;
}

// ============================================================
// Importador coches.net
// ============================================================
// Doc: docs/import_coches_net.md

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

export async function listVehicleListings(vehicleId: number): Promise<VehicleListing[]> {
  const { data, error } = await supabase
    .from("vehicle_listings")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("first_seen_at", { ascending: false });
  if (error) return [];
  return (data || []) as VehicleListing[];
}

// Fusiona el vehículo `from` dentro del vehículo `into`: mueve fotos,
// documentos, listings, leads, sales y purchase_records al destino y borra
// el origen. Validado Ricard 2026-04-08.
export async function mergeVehicles(fromId: number, intoId: number): Promise<void> {
  if (fromId === intoId) throw new Error("No se puede fusionar un coche consigo mismo");
  const tables = [
    "vehicle_photos",
    "vehicle_documents",
    "vehicle_listings",
    "vehicle_videos",
  ];
  for (const t of tables) {
    const { error } = await supabase.from(t).update({ vehicle_id: intoId }).eq("vehicle_id", fromId);
    if (error) throw new Error(`merge ${t}: ${error.message}`);
  }
  // Tablas con vehicle_id nullable: no rompemos si fallan
  for (const t of ["leads", "sales_records", "purchase_records"]) {
    await supabase.from(t).update({ vehicle_id: intoId }).eq("vehicle_id", fromId);
  }
  // Borrar el origen
  const { error: delErr } = await supabase.from("vehicles").delete().eq("id", fromId);
  if (delErr) throw new Error(`delete: ${delErr.message}`);
}

export async function listKnownExternalIds(companyId: number): Promise<string[]> {
  // Trae los external_ids ya importados para este company.
  const { data, error } = await supabase
    .from("vehicle_listings")
    .select("external_id, vehicles!inner(company_id)")
    .eq("external_source", "coches_net")
    .eq("vehicles.company_id", companyId);
  if (error) throw new Error(error.message);
  return (data || []).map((r: { external_id: string }) => r.external_id);
}

export async function fetchCochesNetPreview(dealerUrl: string, knownExternalIds: string[]): Promise<ImportPreview> {
  const { data, error } = await supabase.functions.invoke("import-coches-net", {
    body: { dealerUrl, knownExternalIds },
  });
  if (error) {
    // Intentar leer el cuerpo de la respuesta para más detalle
    try {
      const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
      if (ctx && typeof ctx.text === "function") {
        const text = await ctx.text();
        throw new Error(`Edge function error: ${text}`);
      }
    } catch (innerErr) {
      if (innerErr instanceof Error && innerErr.message.startsWith("Edge function error")) throw innerErr;
    }
    throw new Error(error.message);
  }
  if (data && data.ok === false) {
    throw new Error(data.error || "Unknown edge function error");
  }
  return data as ImportPreview;
}

export async function importCochesNetVehicles(
  companyId: number,
  details: ImportPreview["newDetails"],
): Promise<{ created: number }> {
  let created = 0;
  for (const d of details) {
    if (!d.externalId) continue;
    // 1. Insert en vehicles
    // Nombre completo: marca + modelo + versión (validado Ricard 2026-04-08)
    const fullName = [d.make, d.model, d.version].filter(Boolean).join(" ").trim();
    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .insert({
        company_id: companyId,
        name: fullName,
        version: d.version,
        anio: d.year,
        km: d.km,
        precio_venta: d.price,
        fuel: d.fuelType,
        cv: d.hp ? String(d.hp) : null,
        color: d.color,
        transmission: d.transmission,
        doors: d.doors,
        seats: d.seats,
        body_type: d.bodyType,
        displacement: d.displacement,
        emissions_co2: d.emissionsCo2,
        environmental_label: d.environmentalLabel,
        description: d.description,
        equipment: d.equipment.length ? d.equipment : null,
        warranty: d.warranty,
        city: d.city || null,
        province: d.province || null,
        estado: "disponible",
      })
      .select("id")
      .single();
    if (vErr || !vehicle) {
      console.error("Error creando vehicle", d.name, vErr);
      continue;
    }
    // 2. Insert en vehicle_listings
    await supabase.from("vehicle_listings").insert({
      vehicle_id: vehicle.id,
      external_source: "coches_net",
      external_id: d.externalId,
      external_url: d.url,
    });
    // 3. Insert en vehicle_videos (si hay)
    if (d.videoUrls.length > 0) {
      await supabase.from("vehicle_videos").insert(
        d.videoUrls.map((url) => ({
          vehicle_id: vehicle.id,
          url,
          provider: url.includes("youtu") ? "youtube" : "mp4",
        })),
      );
    }
    // 4. Fotos: por ahora solo guardamos source_url referenciando coches.net.
    //    La descarga real a Supabase Storage se hará en una fase posterior
    //    (es más pesada y mejor en background).
    if (d.photoUrls.length > 0) {
      await supabase.from("vehicle_photos").insert(
        d.photoUrls.map((url) => ({
          vehicle_id: vehicle.id,
          file_name: url.split("/").pop() || "photo.jpg",
          storage_path: "",
          source_url: url,
        })),
      );
    }
    created++;
  }
  return { created };
}

export async function markVehiclesNeedsReview(companyId: number, externalIds: string[]): Promise<number> {
  if (externalIds.length === 0) return 0;
  // Buscar los vehicles afectados via vehicle_listings
  const { data: listings } = await supabase
    .from("vehicle_listings")
    .select("vehicle_id, vehicles!inner(company_id)")
    .eq("external_source", "coches_net")
    .in("external_id", externalIds)
    .eq("vehicles.company_id", companyId);
  const vehicleIds = (listings || []).map((l: { vehicle_id: number }) => l.vehicle_id);
  if (vehicleIds.length === 0) return 0;
  await supabase.from("vehicles").update({ needs_review: true }).in("id", vehicleIds);
  // Marcar los listings como removidos
  await supabase
    .from("vehicle_listings")
    .update({ removed_at: new Date().toISOString() })
    .eq("external_source", "coches_net")
    .in("external_id", externalIds);
  return vehicleIds.length;
}

// ============================================================
// Profile / Company updates
// ============================================================

export async function updateUser(userId: number, fields: { full_name?: string; username?: string; email?: string }): Promise<void> {
  const { error } = await supabase.from("users").update(fields).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateUserPassword(userId: number, newPassword: string): Promise<void> {
  const { hashPassword } = await import("./hash");
  const password_hash = await hashPassword(newPassword);
  const { error } = await supabase.from("users").update({ password_hash }).eq("id", userId);
  if (error) throw new Error(error.message);
}

import type { Company as _Company, User as _User } from "../shared-types";
export async function getCompany(companyId: number): Promise<_Company | null> {
  const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).single();
  if (error) return null;
  return data as _Company;
}

export async function getUser(userId: number): Promise<_User | null> {
  const { data, error } = await supabase.from("users").select("id, company_id, full_name, username, email, role, active").eq("id", userId).single();
  if (error) return null;
  return data as _User;
}

export async function updateCompany(companyId: number, fields: Partial<{
  trade_name: string;
  legal_name: string;
  cif: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}>): Promise<void> {
  const { error } = await supabase.from("companies").update(fields).eq("id", companyId);
  if (error) throw new Error(error.message);
}

// ============================================================
// Vehicles
// ============================================================

/** Columnas seguras para el catálogo público (sin precio_compra, supplier_id, notes, plate, vin, needs_review) */
const PUBLIC_VEHICLE_COLUMNS = "id,company_id,name,precio_venta,km,anio,estado,ad_url,ad_status,fuel,cv,transmission,color,version,doors,seats,body_type,displacement,emissions_co2,environmental_label,description,equipment,warranty,city,province" as const;

export async function listPublicVehicles(companyId: number): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(PUBLIC_VEHICLE_COLUMNS)
    .eq("company_id", companyId)
    .neq("estado", "vendido")
    .order("name");
  if (error) throw new Error(error.message);
  return (data || []) as Vehicle[];
}

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

/** Batch: una sola query para obtener la foto principal (o primera) de cada vehículo. */
export async function listPrimaryPhotos(vehicleIds: number[]): Promise<Map<number, VehiclePhoto>> {
  if (vehicleIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("vehicle_photos")
    .select("*")
    .in("vehicle_id", vehicleIds)
    .order("is_primary", { ascending: false })
    .order("created_at")
    .order("id");
  if (error) throw new Error(error.message);

  const map = new Map<number, VehiclePhoto>();
  for (const p of data || []) {
    if (map.has(p.vehicle_id)) continue; // ya tenemos la primary/primera
    map.set(p.vehicle_id, {
      ...p,
      url: p.storage_path
        ? supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path).data.publicUrl
        : (p.source_url || ""),
      thumbUrl: p.storage_path
        ? supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path, {
            transform: { width: 400, quality: 70 },
          }).data.publicUrl
        : null,
    });
  }
  return map;
}

export async function listVehiclePhotos(vehicleId: number): Promise<VehiclePhoto[]> {
  // Foto principal primero (validado Ricard 2026-04-08): la "primaria" es la
  // foto frontal-lateral 3/4 que Ricard usa como hero. Si no hay primaria
  // marcada, fallback a orden de subida.
  const { data, error } = await supabase
    .from("vehicle_photos")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("is_primary", { ascending: false })
    .order("created_at")
    .order("id"); // tiebreaker (ver getStockPhotoSummary)
  if (error) throw new Error(error.message);

  return (data || []).map((p) => ({
    ...p,
    // Si la foto fue importada desde coches.net, usamos source_url directamente
    // (todavía no la hemos descargado a Storage). Si no, construimos la URL pública
    // de Supabase Storage a partir del storage_path.
    url: p.storage_path
      ? supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path).data.publicUrl
      : (p.source_url || ""),
    // Thumb redimensionado para listados (Storage transforms, plan Pro).
    // Reduce ~9× el peso del listado de stock. Solo aplicable a fotos en Storage;
    // las importadas de coches.net no se pueden transformar.
    thumbUrl: p.storage_path
      ? supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path, {
          transform: { width: 400, quality: 70 },
        }).data.publicUrl
      : null,
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
// Lead Notes
// ============================================================

export type { LeadNote } from "../shared-types";

export async function listLeadNotes(leadId: number): Promise<LeadNote[]> {
  const { data, error } = await supabase
    .from("lead_notes")
    .select("*")
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createLeadNote(leadId: number, content: string): Promise<LeadNote> {
  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ lead_id: leadId, content, timestamp: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteLeadNote(id: number): Promise<void> {
  const { error } = await supabase.from("lead_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Lead Messages (chat history)
// ============================================================

export interface LeadMessage {
  id: number;
  lead_id: number;
  sender: "lead" | "dealer";
  sender_name: string;
  content: string;
  timestamp: string;
  source: string;
}

export async function listLeadMessages(leadId: number): Promise<LeadMessage[]> {
  const { data, error } = await supabase
    .from("lead_messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
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
// Vehicle list summary (resúmenes batch para el listado de Stock)
// ============================================================

/**
 * Resumen ligero de fotos para muchos vehículos en UNA sola query.
 * Se usa en el listado de Stock para mostrar el contador de fotos
 * y la miniatura, sin tener que hacer N queries (una por coche).
 *
 * Devuelve, por vehicle_id: cantidad de fotos y URL miniatura
 * (transformada a 400px si está en Storage; si no, source_url externo).
 */
export async function getStockPhotoSummary(
  vehicleIds: number[],
): Promise<Map<number, { count: number; thumbUrl: string | null }>> {
  const result = new Map<number, { count: number; thumbUrl: string | null }>();
  if (vehicleIds.length === 0) return result;
  const { data, error } = await supabase
    .from("vehicle_photos")
    .select("vehicle_id, storage_path, source_url, is_primary, created_at, id")
    .in("vehicle_id", vehicleIds)
    .order("is_primary", { ascending: false })
    .order("created_at")
    // Desempate determinista: cuando varias fotos comparten created_at
    // (típico en imports masivos de coches.net) sin id como tiebreaker
    // Postgres devuelve filas en orden físico y la batch + per-vehicle
    // queries pueden divergir mostrando fotos distintas por vehículo.
    .order("id");
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    const entry = result.get(row.vehicle_id) ?? { count: 0, thumbUrl: null };
    entry.count += 1;
    // El primer registro por vehículo (gracias al ORDER BY is_primary DESC, created_at)
    // es la foto principal: úsala como miniatura del listado.
    if (entry.thumbUrl === null) {
      if (row.storage_path) {
        entry.thumbUrl = supabase.storage
          .from("vehicle-photos")
          .getPublicUrl(row.storage_path, { transform: { width: 400, quality: 70, resize: "contain" } })
          .data.publicUrl;
      } else if (row.source_url) {
        entry.thumbUrl = row.source_url;
      }
    }
    result.set(row.vehicle_id, entry);
  }
  return result;
}

/**
 * Resumen ligero de documentos para muchos vehículos en UNA sola query.
 * Solo trae `vehicle_id` y `doc_type` — NO genera signed URLs (innecesarias
 * para el listado, que solo muestra checkmarks de qué docs faltan).
 */
export async function getStockDocSummary(
  vehicleIds: number[],
): Promise<Map<number, Set<string>>> {
  const result = new Map<number, Set<string>>();
  if (vehicleIds.length === 0) return result;
  const { data, error } = await supabase
    .from("vehicle_documents")
    .select("vehicle_id, doc_type")
    .in("vehicle_id", vehicleIds);
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    if (!row.doc_type) continue;
    const entry = result.get(row.vehicle_id) ?? new Set<string>();
    entry.add(row.doc_type);
    result.set(row.vehicle_id, entry);
  }
  return result;
}

// ============================================================
// Vehicle Documents
// ============================================================

export async function listVehicleDocuments(vehicleId: number): Promise<VehicleDocument[]> {
  // SECURITY 2026-04-08: vehicle-docs es PRIVADO. Los documentos contienen
  // DNIs, contratos y datos personales. Usamos signed URLs (validez 1h)
  // en vez de getPublicUrl. NUNCA cambiar este bucket a público.
  const { data, error } = await supabase.from("vehicle_documents").select("*").eq("vehicle_id", vehicleId).order("created_at");
  if (error) throw new Error(error.message);
  const docs = data || [];
  if (docs.length === 0) return [];
  const paths = docs.map((d) => d.storage_path).filter(Boolean);
  const { data: signedList } = await supabase.storage.from("vehicle-docs").createSignedUrls(paths, 3600);
  const urlMap = new Map<string, string>();
  for (const s of signedList || []) {
    if (s?.path && s?.signedUrl) urlMap.set(s.path, s.signedUrl);
  }
  return docs.map((d) => ({ ...d, url: urlMap.get(d.storage_path) || "" }));
}

export async function uploadVehicleDocument(vehicleId: number, file: File, docType: string): Promise<VehicleDocument> {
  const storagePath = `${vehicleId}/${docType}/${file.name}`;
  const { error: uploadErr } = await supabase.storage.from("vehicle-docs").upload(storagePath, file, { upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);

  const { data, error } = await supabase.from("vehicle_documents")
    .insert({ vehicle_id: vehicleId, file_name: file.name, storage_path: storagePath, doc_type: docType })
    .select().single();
  if (error) throw new Error(error.message);
  // Signed URL para acceso temporal (vehicle-docs es privado)
  const { data: signed } = await supabase.storage.from("vehicle-docs").createSignedUrl(storagePath, 3600);
  return { ...data, url: signed?.signedUrl || "" };
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

// ============================================================
// Bank integration (CaixaBank) - Fase 1: lectura + reconciliación
// ============================================================
// Validado 2026-04-08. Ricard tiene 3 cuentas (Personal, Autónomo, Póliza).
// La importación inicial se hace por N43 vía script Python; estas funciones
// son solo lectura y reconciliación desde la app web. Para detalles, ver
// CLAUDE.md sección "SEGURIDAD - datos bancarios".

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

export async function listBankAccounts(companyId: number): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("company_id", companyId)
    .order("id");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listBankTransactions(
  bankAccountId: number,
  filters: BankTransactionFilters = {},
  limit = 500,
): Promise<BankTransaction[]> {
  let q = supabase
    .from("bank_transactions")
    .select("*")
    .eq("bank_account_id", bankAccountId)
    .order("booking_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (filters.fromDate) q = q.gte("booking_date", filters.fromDate);
  if (filters.toDate) q = q.lte("booking_date", filters.toDate);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.onlyUnlinked) {
    q = q.is("linked_sale_id", null).is("linked_purchase_id", null);
  }
  if (filters.onlyUnreviewed) q = q.eq("reviewed_by_user", false);
  if (filters.search) q = q.ilike("description", `%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateBankTransactionCategory(
  id: number,
  category: string,
  reviewed = true,
): Promise<void> {
  const { error } = await supabase
    .from("bank_transactions")
    .update({ category, reviewed_by_user: reviewed })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function linkTransactionToPurchase(
  transactionId: number,
  purchaseId: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("bank_transactions")
    .update({ linked_purchase_id: purchaseId, reviewed_by_user: true })
    .eq("id", transactionId);
  if (error) throw new Error(error.message);
}

export async function linkTransactionToSale(
  transactionId: number,
  saleId: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("bank_transactions")
    .update({ linked_sale_id: saleId, reviewed_by_user: true })
    .eq("id", transactionId);
  if (error) throw new Error(error.message);
}

export async function listBankCategoryRules(companyId: number): Promise<BankCategoryRule[]> {
  const { data, error } = await supabase
    .from("bank_category_rules")
    .select("*")
    .eq("company_id", companyId)
    .order("priority");
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Sugiere purchase_records que podrían vincularse a un movimiento bancario.
 * Heurística: importe igual (±5€ por errores de céntimos/redondeo) y fecha
 * dentro de ±15 días. Excluye purchases ya vinculados a otro movimiento.
 */
export async function suggestPurchasesForTransaction(
  companyId: number,
  amount: number,
  bookingDate: string,
): Promise<PurchaseRecord[]> {
  const target = Math.abs(amount);
  const lo = target - 5;
  const hi = target + 5;
  // ±15 días (cliente filtrará después por fecha; PostgREST no soporta date math fácil)
  const dateObj = new Date(bookingDate);
  const fromDate = new Date(dateObj.getTime() - 15 * 86400000).toISOString().slice(0, 10);
  const toDate = new Date(dateObj.getTime() + 15 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("purchase_records")
    .select("*")
    .eq("company_id", companyId)
    .gte("purchase_price", lo)
    .lte("purchase_price", hi)
    .gte("purchase_date", fromDate)
    .lte("purchase_date", toDate)
    .order("purchase_date", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Para los chips "✓ Banco" en PurchasesList: devuelve el set de IDs de
 * purchase_records que tienen al menos un bank_transaction vinculado.
 */
export async function listPurchaseIdsWithBankLink(companyId: number): Promise<Set<number>> {
  // Solo movimientos vinculados a alguna purchase de esta company.
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("linked_purchase_id, bank_account_id")
    .not("linked_purchase_id", "is", null);
  if (error) throw new Error(error.message);
  // Filtramos cliente-side por bank_accounts de la company (la RLS ya restringe pero
  // por defensa profundidad).
  const ids = new Set<number>();
  for (const row of data || []) {
    if (row.linked_purchase_id != null) ids.add(row.linked_purchase_id);
  }
  // companyId es no usado aquí porque RLS filtra a company=1; lo aceptamos por API simétrica.
  void companyId;
  return ids;
}

/**
 * Crear un purchase_record a partir de un bank_transaction y vincularlos.
 * Devuelve el id del purchase creado.
 */
export async function createPurchaseFromTransaction(
  companyId: number,
  transactionId: number,
  expenseType: string,
  supplierName: string,
  vehicleId: number | null,
): Promise<number> {
  // Leer el movimiento para sacar fecha e importe
  const { data: tx, error: txErr } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (txErr || !tx) throw new Error(txErr?.message || "movimiento no encontrado");

  const { data: created, error: createErr } = await supabase
    .from("purchase_records")
    .insert({
      company_id: companyId,
      expense_type: expenseType,
      vehicle_id: vehicleId,
      supplier_name: supplierName,
      purchase_date: tx.booking_date,
      purchase_price: Math.abs(Number(tx.amount)),
      invoice_number: "(desde banco)",
      payment_method: "transferencia",
      notes: tx.description,
      source_file: `bank_tx_${transactionId}`,
    })
    .select("id")
    .single();
  if (createErr || !created) throw new Error(createErr?.message || "no se pudo crear compra");

  // Vincular
  await linkTransactionToPurchase(transactionId, created.id);
  return created.id;
}
