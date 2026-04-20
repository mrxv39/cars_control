import { supabase } from "./supabase";
import type { Vehicle, VehiclePhoto, VehicleDocument, VehicleListing, VehicleInspection, ImportPreview } from "./api-types";

function throwIfError(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

// ── Vehicle CRUD ──

const PUBLIC_VEHICLE_COLUMNS = "id,company_id,name,precio_venta,km,anio,estado,ad_url,ad_status,fuel,cv,transmission,color,version,doors,seats,body_type,displacement,emissions_co2,environmental_label,description,equipment,warranty,city,province" as const;

export async function listPublicVehicles(companyId: number): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles").select(PUBLIC_VEHICLE_COLUMNS).eq("company_id", companyId).neq("estado", "vendido").order("name");
  throwIfError(error);
  return (data || []) as Vehicle[];
}

export async function listVehicles(companyId: number): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("company_id", companyId).neq("estado", "vendido").order("name");
  throwIfError(error);
  return data || [];
}

export async function listAllVehicles(companyId: number): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("company_id", companyId).order("name");
  throwIfError(error);
  return data || [];
}

export async function getVehicle(id: number): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).single();
  throwIfError(error);
  return data;
}

export async function createVehicle(companyId: number, fields: Partial<Vehicle> & { name: string }): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      company_id: companyId, name: fields.name, estado: fields.estado || "disponible",
      anio: fields.anio ?? null, km: fields.km ?? null, precio_compra: fields.precio_compra ?? null,
      precio_venta: fields.precio_venta ?? null, fuel: fields.fuel || "", color: fields.color || "",
      notes: fields.notes || "", ad_url: fields.ad_url || "",
    })
    .select().single();
  throwIfError(error);
  return data;
}

export async function updateVehicle(id: number, updates: Partial<Vehicle>): Promise<Vehicle> {
  const { data, error } = await supabase.from("vehicles").update(updates).eq("id", id).select().single();
  throwIfError(error);
  return data;
}

export async function deleteVehicle(id: number): Promise<void> {
  const { data: photos } = await supabase.from("vehicle_photos").select("storage_path").eq("vehicle_id", id);
  if (photos && photos.length > 0) {
    await supabase.storage.from("vehicle-photos").remove(photos.map((p) => p.storage_path));
  }
  await supabase.from("leads").update({ vehicle_id: null }).eq("vehicle_id", id);
  await supabase.from("sales_records").update({ vehicle_id: null }).eq("vehicle_id", id);
  await supabase.from("purchase_records").update({ vehicle_id: null }).eq("vehicle_id", id);
  await supabase.from("clients").update({ vehicle_id: null }).eq("vehicle_id", id);
  await supabase.from("vehicle_photos").delete().eq("vehicle_id", id);
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  throwIfError(error);
}

// ── Vehicle Photos ──

export async function setPrimaryPhoto(vehicleId: number, photoId: number): Promise<void> {
  await supabase.from("vehicle_photos").update({ is_primary: false }).eq("vehicle_id", vehicleId);
  const { error } = await supabase.from("vehicle_photos").update({ is_primary: true }).eq("id", photoId);
  throwIfError(error);
}

export async function listPrimaryPhotos(vehicleIds: number[]): Promise<Map<number, VehiclePhoto>> {
  if (vehicleIds.length === 0) return new Map();
  const { data, error } = await supabase.from("vehicle_photos").select("*").in("vehicle_id", vehicleIds)
    .order("is_primary", { ascending: false }).order("created_at").order("id");
  throwIfError(error);
  const map = new Map<number, VehiclePhoto>();
  for (const p of data || []) {
    if (map.has(p.vehicle_id)) continue;
    map.set(p.vehicle_id, {
      ...p,
      url: p.storage_path ? supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path).data.publicUrl : (p.source_url || ""),
      thumbUrl: p.storage_path ? supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path).data.publicUrl : null,
    });
  }
  return map;
}

export async function listVehiclePhotos(vehicleId: number): Promise<VehiclePhoto[]> {
  const { data, error } = await supabase.from("vehicle_photos").select("*").eq("vehicle_id", vehicleId)
    .order("is_primary", { ascending: false }).order("created_at").order("id");
  throwIfError(error);
  return (data || []).map((p) => ({
    ...p,
    url: p.storage_path ? supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path).data.publicUrl : (p.source_url || ""),
    thumbUrl: p.storage_path
      ? supabase.storage.from("vehicle-photos").getPublicUrl(p.storage_path).data.publicUrl
      : null,
  }));
}

export async function uploadVehiclePhoto(vehicleId: number, file: File): Promise<VehiclePhoto> {
  const ext = file.name.split(".").pop() || "jpg";
  const storagePath = `${vehicleId}/${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage.from("vehicle-photos").upload(storagePath, file);
  if (uploadErr) throw new Error(uploadErr.message);
  const { data, error } = await supabase.from("vehicle_photos").insert({ vehicle_id: vehicleId, file_name: file.name, storage_path: storagePath }).select().single();
  throwIfError(error);
  return { ...data, url: supabase.storage.from("vehicle-photos").getPublicUrl(storagePath).data.publicUrl };
}

export async function deleteVehiclePhoto(photo: VehiclePhoto): Promise<void> {
  const { data: row } = await supabase.from("vehicle_photos").select("storage_path").eq("id", photo.id).single();
  if (row) await supabase.storage.from("vehicle-photos").remove([row.storage_path]);
  await supabase.from("vehicle_photos").delete().eq("id", photo.id);
}

// ── Vehicle Documents ──

export async function listVehicleDocuments(vehicleId: number): Promise<VehicleDocument[]> {
  const { data, error } = await supabase.from("vehicle_documents").select("*").eq("vehicle_id", vehicleId).order("created_at");
  throwIfError(error);
  const docs = data || [];
  if (docs.length === 0) return [];
  const paths = docs.map((d) => d.storage_path).filter(Boolean);
  const { data: signedList, error: signErr } = await supabase.storage.from("vehicle-docs").createSignedUrls(paths, 3600);
  if (signErr) console.warn("[listVehicleDocuments] createSignedUrls error:", signErr.message);
  const urlMap = new Map<string, string>();
  for (const s of signedList || []) { if (s?.path && s?.signedUrl && !s.error) urlMap.set(s.path, s.signedUrl); }
  return docs.map((d) => ({ ...d, url: urlMap.get(d.storage_path) || "" }));
}

export async function uploadVehicleDocument(vehicleId: number, file: File, docType: string): Promise<VehicleDocument> {
  const storagePath = `${vehicleId}/${docType}/${file.name}`;
  const { error: uploadErr } = await supabase.storage.from("vehicle-docs").upload(storagePath, file, { upsert: true });
  if (uploadErr) throw new Error(uploadErr.message);
  const { data, error } = await supabase.from("vehicle_documents").insert({ vehicle_id: vehicleId, file_name: file.name, storage_path: storagePath, doc_type: docType }).select().single();
  throwIfError(error);
  const { data: signed } = await supabase.storage.from("vehicle-docs").createSignedUrl(storagePath, 3600);
  return { ...data, url: signed?.signedUrl || "" };
}

export async function deleteVehicleDocument(doc: VehicleDocument): Promise<void> {
  const { data: row } = await supabase.from("vehicle_documents").select("storage_path").eq("id", doc.id).single();
  if (row) await supabase.storage.from("vehicle-docs").remove([row.storage_path]);
  await supabase.from("vehicle_documents").delete().eq("id", doc.id);
}

// ── Vehicle Inspections ──

export async function listVehicleInspections(vehicleId: number): Promise<VehicleInspection[]> {
  const { data, error } = await supabase.from("vehicle_inspections").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function deleteVehicleInspection(id: number): Promise<void> {
  const { error } = await supabase.from("vehicle_inspections").delete().eq("id", id);
  throwIfError(error);
}

// ── Stock summaries (batch) ──

export async function getStockPhotoSummary(vehicleIds: number[]): Promise<Map<number, { count: number; thumbUrl: string | null }>> {
  const result = new Map<number, { count: number; thumbUrl: string | null }>();
  if (vehicleIds.length === 0) return result;
  const { data, error } = await supabase.from("vehicle_photos")
    .select("vehicle_id, storage_path, source_url, is_primary, created_at, id")
    .in("vehicle_id", vehicleIds)
    .order("is_primary", { ascending: false }).order("created_at").order("id");
  throwIfError(error);
  for (const row of data || []) {
    const entry = result.get(row.vehicle_id) ?? { count: 0, thumbUrl: null };
    entry.count += 1;
    if (entry.thumbUrl === null) {
      if (row.storage_path) {
        entry.thumbUrl = supabase.storage.from("vehicle-photos").getPublicUrl(row.storage_path).data.publicUrl;
      } else if (row.source_url) {
        entry.thumbUrl = row.source_url;
      }
    }
    result.set(row.vehicle_id, entry);
  }
  return result;
}

export async function getStockDocSummary(vehicleIds: number[]): Promise<Map<number, Set<string>>> {
  const result = new Map<number, Set<string>>();
  if (vehicleIds.length === 0) return result;
  const { data, error } = await supabase.from("vehicle_documents").select("vehicle_id, doc_type").in("vehicle_id", vehicleIds);
  throwIfError(error);
  for (const row of data || []) {
    if (!row.doc_type) continue;
    const entry = result.get(row.vehicle_id) ?? new Set<string>();
    entry.add(row.doc_type);
    result.set(row.vehicle_id, entry);
  }
  return result;
}

// ── Listings & merge ──

export async function listVehicleListings(vehicleId: number): Promise<VehicleListing[]> {
  const { data, error } = await supabase.from("vehicle_listings").select("*").eq("vehicle_id", vehicleId).order("first_seen_at", { ascending: false });
  if (error) return [];
  return (data || []) as VehicleListing[];
}

export async function mergeVehicles(fromId: number, intoId: number): Promise<void> {
  if (fromId === intoId) throw new Error("No se puede fusionar un coche consigo mismo");
  for (const t of ["vehicle_photos", "vehicle_documents", "vehicle_listings", "vehicle_videos"]) {
    const { error } = await supabase.from(t).update({ vehicle_id: intoId }).eq("vehicle_id", fromId);
    if (error) throw new Error(`merge ${t}: ${error.message}`);
  }
  for (const t of ["leads", "sales_records", "purchase_records"]) {
    await supabase.from(t).update({ vehicle_id: intoId }).eq("vehicle_id", fromId);
  }
  const { error: delErr } = await supabase.from("vehicles").delete().eq("id", fromId);
  if (delErr) throw new Error(`delete: ${delErr.message}`);
}

// ── Import coches.net ──

export async function listKnownExternalIds(companyId: number): Promise<string[]> {
  const { data, error } = await supabase.from("vehicle_listings")
    .select("external_id, vehicles!inner(company_id)")
    .eq("external_source", "coches_net").eq("vehicles.company_id", companyId);
  throwIfError(error);
  return (data || []).map((r: { external_id: string }) => r.external_id);
}

export async function fetchCochesNetPreview(dealerUrl: string, knownExternalIds: string[]): Promise<ImportPreview> {
  const { data, error } = await supabase.functions.invoke("import-coches-net", { body: { dealerUrl, knownExternalIds } });
  if (error) {
    try {
      const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
      if (ctx && typeof ctx.text === "function") { const text = await ctx.text(); throw new Error(`Edge function error: ${text}`); }
    } catch (innerErr) { if (innerErr instanceof Error && innerErr.message.startsWith("Edge function error")) throw innerErr; }
    throw new Error(error.message);
  }
  if (data && data.ok === false) throw new Error(data.error || "Unknown edge function error");
  return data as ImportPreview;
}

export async function importCochesNetVehicles(companyId: number, details: ImportPreview["newDetails"]): Promise<{ created: number }> {
  let created = 0;
  for (const d of details) {
    if (!d.externalId) continue;
    const fullName = [d.make, d.model, d.version].filter(Boolean).join(" ").trim();
    const { data: vehicle, error: vErr } = await supabase.from("vehicles").insert({
      company_id: companyId, name: fullName, version: d.version, anio: d.year, km: d.km,
      precio_venta: d.price, fuel: d.fuelType, cv: d.hp ? String(d.hp) : null, color: d.color,
      transmission: d.transmission, doors: d.doors, seats: d.seats, body_type: d.bodyType,
      displacement: d.displacement, emissions_co2: d.emissionsCo2, environmental_label: d.environmentalLabel,
      description: d.description, equipment: d.equipment.length ? d.equipment : null, warranty: d.warranty,
      city: d.city || null, province: d.province || null, estado: "disponible",
    }).select("id").single();
    if (vErr || !vehicle) { console.error("Error creando vehicle", d.name, vErr); continue; }
    await supabase.from("vehicle_listings").insert({ vehicle_id: vehicle.id, external_source: "coches_net", external_id: d.externalId, external_url: d.url });
    if (d.videoUrls.length > 0) {
      await supabase.from("vehicle_videos").insert(d.videoUrls.map((url) => ({ vehicle_id: vehicle.id, url, provider: url.includes("youtu") ? "youtube" : "mp4" })));
    }
    if (d.photoUrls.length > 0) {
      await supabase.from("vehicle_photos").insert(d.photoUrls.map((url) => ({ vehicle_id: vehicle.id, file_name: url.split("/").pop() || "photo.jpg", storage_path: "", source_url: url })));
    }
    created++;
  }
  return { created };
}

export async function markVehiclesNeedsReview(companyId: number, externalIds: string[]): Promise<number> {
  if (externalIds.length === 0) return 0;
  const { data: listings } = await supabase.from("vehicle_listings")
    .select("vehicle_id, vehicles!inner(company_id)")
    .eq("external_source", "coches_net").in("external_id", externalIds).eq("vehicles.company_id", companyId);
  const vehicleIds = (listings || []).map((l: { vehicle_id: number }) => l.vehicle_id);
  if (vehicleIds.length === 0) return 0;
  await supabase.from("vehicles").update({ needs_review: true }).in("id", vehicleIds);
  await supabase.from("vehicle_listings").update({ removed_at: new Date().toISOString() }).eq("external_source", "coches_net").in("external_id", externalIds);
  return vehicleIds.length;
}
