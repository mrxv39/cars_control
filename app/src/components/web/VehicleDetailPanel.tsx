import React, { useState, FormEvent } from "react";
import * as api from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";

export function translateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.";
  if (msg.includes("JWT expired") || msg.includes("invalid claim")) return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  if (msg.includes("row-level security") || msg.includes("policy")) return "No tienes permiso para esta acción.";
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) return "Este registro ya existe.";
  if (msg.includes("23503") || msg.includes("foreign key")) return "No se puede eliminar: hay datos vinculados.";
  if (msg.includes("PGRST")) return "Error del servidor. Inténtalo de nuevo en unos minutos.";
  console.error("[translateError] Unhandled:", msg);
  return "Ha ocurrido un error inesperado. Inténtalo de nuevo.";
}

export type VDProps = { vehicle: api.Vehicle; suppliers: api.Supplier[]; leads: api.Lead[]; purchaseRecords: api.PurchaseRecord[]; companyId: number; clients: api.Client[]; onBack: () => void; onReload: () => void };

export function VehicleDetail(props: VDProps) {
  return <VehicleDetailA {...props} />;
}

// Shared hooks for all vehicle detail layouts.
// `onReload` (opcional): si se pasa, se invoca tras acciones que cambian el
// resumen del listado de Stock (marcar foto principal, subir/borrar foto)
// para forzar al padre a recargar `vehicles` y refrescar `photoFirstUrlMap`.
function useVehicleDetail(vehicle: api.Vehicle, onReload?: () => void) {
  const [form, setForm] = useState(vehicle);
  const [photos, setPhotos] = useState<api.VehiclePhoto[]>([]);
  const [docs, setDocs] = useState<api.VehicleDocument[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const docFileRef = React.useRef<HTMLInputElement>(null);
  const dialog = useConfirmDialog();

  React.useEffect(() => { void loadPhotos(); void loadDocs(); }, [vehicle.id]);

  async function loadPhotos() { try { setPhotos(await api.listVehiclePhotos(vehicle.id)); } finally { setLoadingPhotos(false); } }
  async function loadDocs() { setDocs(await api.listVehicleDocuments(vehicle.id)); }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("El nombre del vehículo es obligatorio."); setTimeout(() => document.querySelector<HTMLInputElement>(".input-error")?.focus(), 50); return; }
    setSaving(true); setError(null);
    try {
      await api.updateVehicle(vehicle.id, {
        name: form.name, anio: form.anio, km: form.km,
        precio_compra: form.precio_compra, precio_venta: form.precio_venta,
        ad_url: form.ad_url, estado: form.estado, fuel: form.fuel, color: form.color, notes: form.notes,
        supplier_id: form.supplier_id, plate: form.plate || null,
      });
      setSuccess(true); setTimeout(() => setSuccess(false), 4000);
    } catch (err) { setError(translateError(err)); } finally { setSaving(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files) return;
    setUploading(true); setError(null);
    try {
      const total = files.length;
      for (let i = 0; i < total; i++) {
        setUploadProgress(`${i + 1}/${total}`);
        await api.uploadVehiclePhoto(vehicle.id, files[i]);
      }
      await loadPhotos();
      onReload?.();
    } catch (err) { setError(`Error subiendo fotos: ${translateError(err)}`); }
    finally { setUploading(false); setUploadProgress(""); if (fileRef.current) fileRef.current.value = ""; }
  }

  function handleDeletePhoto(photo: api.VehiclePhoto) {
    dialog.requestConfirm("Eliminar foto", `Eliminar ${photo.file_name}?`, async () => {
      await api.deleteVehiclePhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      onReload?.();
    });
  }

  async function handleSetPrimary(photo: api.VehiclePhoto) {
    await api.setPrimaryPhoto(vehicle.id, photo.id);
    await loadPhotos();
    // Notifica al padre para que recargue `vehicles` → StockList re-fetchea
    // su `photoFirstUrlMap` y al volver al listado se ve la nueva primary.
    onReload?.();
  }

  async function handleUploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingDoc(true);
    try { await api.uploadVehicleDocument(vehicle.id, file, "factura"); await loadDocs(); }
    finally { setUploadingDoc(false); if (docFileRef.current) docFileRef.current.value = ""; }
  }

  function handleDeleteDoc(doc: api.VehicleDocument) {
    dialog.requestConfirm("Eliminar documento", `Eliminar ${doc.file_name}?`, async () => {
      await api.deleteVehicleDocument(doc);
      setDocs((prev) => prev.filter((x) => x.id !== doc.id));
    });
  }

  const mainPhoto = selectedPhoto != null ? photos.find((p) => p.id === selectedPhoto)?.url : photos[0]?.url;
  const margin = (form.precio_compra && form.precio_venta) ? form.precio_venta - form.precio_compra : null;
  const facturas = docs.filter((d) => d.doc_type === "factura");

  const marginWarning = form.precio_compra && form.precio_venta && form.precio_venta < form.precio_compra ? "Margen negativo — el precio de venta es menor que el de compra" : null;

  return { form, setForm, photos, loadingPhotos, docs, facturas, selectedPhoto, setSelectedPhoto, saving, uploading, uploadProgress, uploadingDoc, success, error, setError,
    fileRef, docFileRef, handleSave, handleUpload, handleDeletePhoto, handleSetPrimary, handleUploadDoc, handleDeleteDoc, mainPhoto, margin, marginWarning, loadPhotos, loadDocs, dialog };
}

// Shared: Factura section
function VDFactura({ facturas, docFileRef, uploadingDoc, handleUploadDoc, handleDeleteDoc }: { facturas: api.VehicleDocument[]; docFileRef: React.RefObject<HTMLInputElement | null>; uploadingDoc: boolean; handleUploadDoc: (e: React.ChangeEvent<HTMLInputElement>) => void; handleDeleteDoc: (d: api.VehicleDocument) => void }) {
  return (
    <>
      <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Factura de compra</p>
      {facturas.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", background: "var(--color-bg-secondary, #f8fafc)", borderRadius: 8, marginBottom: "0.35rem" }}>
          <span style={{ flex: 1, fontSize: "0.85rem" }}>{d.file_name}</span>
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="button secondary xs">Ver</a>
          <button type="button" className="button danger xs" onClick={() => void handleDeleteDoc(d)}>Eliminar</button>
        </div>
      ))}
      {facturas.length === 0 && <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>No hay factura adjunta.</p>}
      <input ref={docFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => void handleUploadDoc(e)} />
      <button type="button" className="button secondary sm" onClick={() => docFileRef.current?.click()} disabled={uploadingDoc}>{uploadingDoc ? "Subiendo..." : "Adjuntar factura"}</button>
    </>
  );
}

// Shared: Leads sidebar/section
function VDLeads({ vehicleLeads }: { vehicleLeads: api.Lead[] }) {
  if (vehicleLeads.length === 0) return <EmptyState title="Sin leads" description="Este vehículo no tiene leads asociados" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {vehicleLeads.map((l) => (
        <div key={l.id} style={{ padding: "0.65rem 0.75rem", background: "var(--color-bg-secondary, #f8fafc)", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.9rem" }}><span className={`lead-status-dot ${l.estado || "nuevo"}`} />{l.name}</span>
            <span className="muted" style={{ fontSize: "0.7rem" }}>{l.canal} · {l.estado}</span>
          </div>
          {l.phone && <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>Tel: {l.phone}</p>}
          {l.email && <p style={{ margin: "0.1rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>{l.email}</p>}
          {l.notes && <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "#475569" }}>{l.notes}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Documentación del vehículo (ficha técnica, permiso, seguro) ──
function VDVehicleDocs({ docs, vehicleId, onReload }: { docs: api.VehicleDocument[]; vehicleId: number; onReload: () => void }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadType, setUploadType] = React.useState<string | null>(null);

  const DOC_TYPES = [
    { key: "ficha_tecnica", label: "Ficha técnica" },
    { key: "permiso_circulacion", label: "Permiso de circulación" },
    { key: "seguro", label: "Seguro del vehículo" },
  ] as const;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadType) return;
    setUploading(true);
    try {
      await api.uploadVehicleDocument(vehicleId, file, uploadType);
      onReload();
    } finally {
      setUploading(false);
      setUploadType(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function triggerUpload(docType: string) {
    setUploadType(docType);
    setTimeout(() => fileRef.current?.click(), 50);
  }

  return (
    <section className="panel vd-sidebar-panel">
      <div className="vd-section-header"><p className="eyebrow">Documentación vehículo</p></div>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => void handleUpload(e)} />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {DOC_TYPES.map(({ key, label }) => {
          const doc = docs.find((d) => d.doc_type === key);
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.6rem", background: "var(--color-bg-secondary, #f8fafc)", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: doc ? "#16a34a" : "#cbd5e1", flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{label}</span>
              </div>
              {doc ? (
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="button secondary xs">Ver</a>
              ) : (
                <button type="button" className="button secondary xs" disabled={uploading} onClick={() => triggerUpload(key)}>
                  {uploading && uploadType === key ? "..." : "Adjuntar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Info compra (proveedor, factura, movimiento banco) ──
function VDPurchaseInfo({ suppliers, supplierId, onSupplierChange, facturas, docFileRef, uploadingDoc, handleUploadDoc, handleDeleteDoc, purchaseRecords }: {
  suppliers: api.Supplier[];
  supplierId: number | null;
  onSupplierChange: (id: number | null) => void;
  facturas: api.VehicleDocument[];
  docFileRef: React.RefObject<HTMLInputElement | null>;
  uploadingDoc: boolean;
  handleUploadDoc: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteDoc: (d: api.VehicleDocument) => void;
  purchaseRecords: api.PurchaseRecord[];
}) {
  const purchaseRecord = purchaseRecords.find((p) => p.expense_type === "COMPRA_VEHICULO");
  // Look for linked bank transaction via purchase_record
  const [bankTx, setBankTx] = React.useState<api.BankTransaction | null>(null);
  React.useEffect(() => {
    if (!purchaseRecord) { setBankTx(null); return; }
    void (async () => {
      try {
        const { data } = await supabase
          .from("bank_transactions")
          .select("*")
          .eq("linked_purchase_id", purchaseRecord.id)
          .limit(1);
        setBankTx((data && data.length > 0) ? data[0] as api.BankTransaction : null);
      } catch { setBankTx(null); }
    })();
  }, [purchaseRecord?.id]);

  return (
    <section className="panel vd-sidebar-panel">
      <div className="vd-section-header"><p className="eyebrow">Info compra</p></div>
      <div className="form-stack">
        <div>
          <label className="field-label">Proveedor</label>
          <select value={supplierId || ""} onChange={(e) => onSupplierChange(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Factura de compra</label>
          <VDFactura facturas={facturas} docFileRef={docFileRef} uploadingDoc={uploadingDoc} handleUploadDoc={handleUploadDoc} handleDeleteDoc={handleDeleteDoc} />
        </div>
        <div>
          <label className="field-label">Movimiento del banco</label>
          {bankTx ? (
            <div style={{ padding: "0.5rem 0.6rem", background: "var(--color-bg-secondary, #f8fafc)", borderRadius: 8, border: "1px solid rgba(0,0,0,0.06)", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>{bankTx.counterparty_name || "Movimiento"}</span>
                <span style={{ fontWeight: 700, color: bankTx.amount < 0 ? "#dc2626" : "#16a34a" }}>{bankTx.amount.toLocaleString("es-ES")} €</span>
              </div>
              <p className="muted" style={{ margin: "0.15rem 0 0", fontSize: "0.78rem" }}>{bankTx.booking_date} · {bankTx.category}</p>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: "0.85rem" }}>No hay movimiento vinculado</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── PROPOSAL A: Sidebar layout (redesigned) ──
function VehicleDetailA({ vehicle, suppliers, leads, purchaseRecords, companyId, clients, onBack, onReload }: VDProps) {
  const h = useVehicleDetail(vehicle, onReload);
  const vehicleLeads = leads.filter((l) => l.vehicle_id === vehicle.id);
  const handleDeleteVehicle = () => h.dialog.requestConfirm("Eliminar vehículo", `¿Eliminar "${vehicle.name}" y todos sus datos? Esta acción no se puede deshacer.`, async () => { await api.deleteVehicle(vehicle.id); onBack(); });

  // ── Expenses ──
  const vehiclePurchases = purchaseRecords.filter((p) => p.vehicle_id === vehicle.id);
  const totalExpenses = vehiclePurchases.reduce((s, p) => s + p.purchase_price, 0);

  // ── Quick sale ──
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [salePrice, setSalePrice] = useState(h.form.precio_venta ? String(h.form.precio_venta) : "");
  const [saleClient, setSaleClient] = useState("");
  const [savingSale, setSavingSale] = useState(false);
  async function handleQuickSale() {
    if (!salePrice || parseFloat(salePrice) <= 0) return;
    setSavingSale(true);
    try {
      await api.addSalesRecord(companyId, { vehicle_id: vehicle.id, client_id: saleClient ? parseInt(saleClient) : null, date: new Date().toISOString().split("T")[0], price_final: parseFloat(salePrice), notes: "" });
      await api.updateVehicle(vehicle.id, { estado: "vendido" });
      h.setForm({ ...h.form, estado: "vendido" });
      setShowQuickSale(false);
      onReload?.();
    } finally { setSavingSale(false); }
  }

  const estadoColor = h.form.estado === "vendido" ? "#16a34a" : h.form.estado === "reservado" ? "#f59e0b" : "#3b82f6";
  const estadoLabel = h.form.estado === "vendido" ? "Vendido" : h.form.estado === "reservado" ? "Reservado" : "Disponible";

  return (
    <>
      <ConfirmDialog {...h.dialog.confirmProps} />

      {/* ── Hero compacto: foto + título + estado + acciones ── */}
      <header className="vd-hero vd-hero--compact">
        <div className="vd-hero-left">
          {h.loadingPhotos ? (
            <div className="vd-hero-photo skeleton-line" style={{ animationDuration: "1.5s" }} />
          ) : h.mainPhoto ? (
            <img src={h.mainPhoto} className="vd-hero-photo" alt={vehicle.name} />
          ) : (
            <div className="vd-hero-photo vd-hero-photo-empty">Sin foto</div>
          )}
        </div>
        <div className="vd-hero-right">
          <p className="breadcrumb"><span className="breadcrumb-link" onClick={onBack}>Stock</span> &rsaquo; Ficha</p>
          <h2 className="vd-vehicle-name">{vehicle.name}</h2>
          <div className="vd-meta-row">
            <span className="vd-estado-badge" style={{ background: estadoColor }}>{estadoLabel}</span>
          </div>
          <div className="vd-hero-actions">
            <button type="button" className="button secondary sm" onClick={onBack}>← Volver</button>
            {h.form.estado !== "vendido" && <button type="button" className="button primary sm" onClick={() => setShowQuickSale(true)}>Registrar venta</button>}
            <span style={{ flex: 1 }} />
            <button type="button" className="button danger sm" onClick={handleDeleteVehicle}>Eliminar</button>
          </div>
        </div>
      </header>

      {/* ── Contenido principal: Formulario (estrecho) + Sidebar (ancho) ── */}
      <div className="vd-content-grid vd-content-grid--narrow-form" id="vd-datos">
        {/* Columna izquierda: Formulario + Documentos */}
        <section className="panel vd-form-panel">
          <div className="vd-section-header">
            <p className="eyebrow">Datos del vehículo</p>
          </div>
          <form onSubmit={(e) => void h.handleSave(e)} className="form-stack">
            <div>
              <label className="field-label required">Marca y modelo</label>
              <input value={h.form.name} onChange={(e) => h.setForm({ ...h.form, name: e.target.value })} placeholder="Ej: SEAT Ibiza 1.0 MPI Style" className={!h.form.name.trim() ? "input-error" : ""} />
            </div>
            <div className="form-grid-2">
              <div><label className="field-label">Año</label><input type="number" value={h.form.anio || ""} onChange={(e) => h.setForm({ ...h.form, anio: e.target.value ? parseInt(e.target.value) : null })} placeholder="2020" min="1990" max="2030" /></div>
              <div><label className="field-label">Kilómetros</label><input type="number" value={h.form.km || ""} onChange={(e) => h.setForm({ ...h.form, km: e.target.value ? parseInt(e.target.value) : null })} placeholder="125000" min="0" /></div>
            </div>
            <div className="form-grid-2">
              <div><label className="field-label">Estado</label><select value={h.form.estado} onChange={(e) => h.setForm({ ...h.form, estado: e.target.value })}><option value="disponible">Disponible</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option></select></div>
              <div><label className="field-label">Matrícula</label><input value={h.form.plate || ""} onChange={(e) => h.setForm({ ...h.form, plate: e.target.value })} placeholder="1234 ABC" style={{ textTransform: "uppercase" }} /></div>
            </div>
            <div className="form-grid-2">
              <div><label className="field-label">Combustible</label><select value={h.form.fuel || ""} onChange={(e) => h.setForm({ ...h.form, fuel: e.target.value })}><option value="">—</option><option value="Gasolina">Gasolina</option><option value="Diésel">Diésel</option><option value="Híbrido">Híbrido</option><option value="Eléctrico">Eléctrico</option><option value="GLP">GLP</option></select></div>
              <div><label className="field-label">Color</label><input value={h.form.color || ""} onChange={(e) => h.setForm({ ...h.form, color: e.target.value })} placeholder="Blanco" /></div>
            </div>
            <div className="vd-divider" />
            <div className="form-grid-2">
              <div><label className="field-label">Precio compra</label><input type="number" step="100" min="0" value={h.form.precio_compra || ""} onChange={(e) => h.setForm({ ...h.form, precio_compra: e.target.value ? parseFloat(e.target.value) : null })} placeholder="8500" /></div>
              <div><label className="field-label">Precio venta</label><input type="number" step="100" min="0" value={h.form.precio_venta || ""} onChange={(e) => h.setForm({ ...h.form, precio_venta: e.target.value ? parseFloat(e.target.value) : null })} placeholder="10500" /></div>
            </div>
            {h.marginWarning && <p className="vd-margin-warning">⚠ {h.marginWarning}</p>}
            {h.error && <p className="error-banner" role="alert">{h.error} <button type="button" onClick={() => h.setError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700, marginLeft: "0.5rem" }}>✕</button></p>}
            {h.success && <p className="success-banner" role="status">✓ Guardado correctamente</p>}
            <button type="submit" className="button primary" disabled={h.saving} style={{ alignSelf: "flex-start" }}>{h.saving ? "Guardando..." : "Guardar cambios"}</button>
          </form>
        </section>

        {/* Columna central: Documentación vehículo + Info compra */}
        <div className="vd-middle-col">
          <VDVehicleDocs docs={h.docs} vehicleId={vehicle.id} onReload={() => { void h.loadDocs(); }} />
          <VDPurchaseInfo
            suppliers={suppliers}
            supplierId={h.form.supplier_id}
            onSupplierChange={(id) => { h.setForm({ ...h.form, supplier_id: id }); void api.updateVehicle(vehicle.id, { supplier_id: id }); }}
            facturas={h.facturas}
            docFileRef={h.docFileRef}
            uploadingDoc={h.uploadingDoc}
            handleUploadDoc={h.handleUploadDoc}
            handleDeleteDoc={h.handleDeleteDoc}
            purchaseRecords={vehiclePurchases}
          />
        </div>

        {/* Columna derecha: Sidebar */}
        <div className="vd-sidebar">
          <section className="panel vd-sidebar-panel" id="vd-leads">
            <div className="vd-section-header">
              <p className="eyebrow">Leads ({vehicleLeads.length})</p>
            </div>
            <VDLeads vehicleLeads={vehicleLeads} />
          </section>
        </div>
      </div>

      {/* ── Thumbnails strip (debajo del formulario) ── */}
      {h.photos.length > 0 && (
        <section className="panel" style={{ padding: "1rem 1.25rem", marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <p className="eyebrow" style={{ margin: 0 }}>Fotos ({h.photos.length})</p>
            <div>
              <input ref={h.fileRef} type="file" accept="image/*" multiple onChange={(e) => void h.handleUpload(e)} style={{ display: "none" }} />
              <button type="button" className="button primary sm" onClick={() => h.fileRef.current?.click()} disabled={h.uploading}>{h.uploading ? `Subiendo ${h.uploadProgress}...` : "Subir fotos"}</button>
            </div>
          </div>
          <div className="vd-thumbs-strip">
            {h.photos.map((p) => (
              <img key={p.id} src={p.url} loading="lazy" onClick={() => h.setSelectedPhoto(p.id)}
                className={`vd-thumb ${(h.selectedPhoto === p.id || (!h.selectedPhoto && p === h.photos[0])) ? "active" : ""} ${p.is_primary ? "primary" : ""}`}
                alt="" />
            ))}
          </div>
        </section>
      )}

      {/* ── Gastos del vehículo ── */}
      {vehiclePurchases.length > 0 && (
        <section className="panel" style={{ padding: "1.25rem", marginTop: "1rem" }} id="vd-gastos">
          <div className="vd-section-header"><p className="eyebrow">Gastos asociados ({vehiclePurchases.length})</p></div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {vehiclePurchases.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid rgba(0,0,0,0.04)", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>{p.expense_type} — {p.supplier_name || "Sin proveedor"}</span>
                <span style={{ fontWeight: 600 }}>{p.purchase_price.toLocaleString("es-ES")} €</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0 0", fontWeight: 700 }}>
              <span>Total gastos</span>
              <span>{totalExpenses.toLocaleString("es-ES")} €</span>
            </div>
            {h.margin !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0 0", fontWeight: 700, color: (h.form.precio_venta || 0) - totalExpenses >= 0 ? "#16a34a" : "#dc2626" }}>
                <span>Beneficio real (venta - gastos)</span>
                <span>{((h.form.precio_venta || 0) - totalExpenses).toLocaleString("es-ES")} €</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Anuncios externos + Documentos completos ── */}
      <VehicleListingsLink vehicle={vehicle} />
      <VehicleDocsList vehicle={vehicle} />

      {/* ── Quick sale modal ── */}
      {showQuickSale && (
        <div className="modal-overlay" onClick={() => setShowQuickSale(false)}>
          <div className="modal-card panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <p className="eyebrow">Registrar venta</p>
            <h3 style={{ margin: "0.25rem 0 1rem" }}>{vehicle.name}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label className="field-label required">Precio de venta</label>
                <input type="number" step="100" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="10500" autoFocus />
              </div>
              <div>
                <label className="field-label">Cliente</label>
                <select value={saleClient} onChange={(e) => setSaleClient(e.target.value)}>
                  <option value="">Sin cliente</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.dni ? ` (${c.dni})` : ""}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button type="button" className="button primary" disabled={savingSale || !salePrice} onClick={() => void handleQuickSale()}>{savingSale ? "Guardando..." : "Registrar venta"}</button>
                <button type="button" className="button secondary" onClick={() => setShowQuickSale(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Link al anuncio externo (coches.net) ──
// Si el vehículo tiene listings asociados, los mostramos como links.
function VehicleListingsLink({ vehicle }: { vehicle: api.Vehicle }) {
  const [listings, setListings] = useState<api.VehicleListing[]>([]);
  React.useEffect(() => {
    void api.listVehicleListings(vehicle.id).then(setListings);
  }, [vehicle.id]);
  if (listings.length === 0) return null;
  return (
    <section className="panel" style={{ padding: "1rem 1.25rem", marginTop: "1rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Anuncios externos</p>
      <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.88rem" }}>
        {listings.map((l) => (
          <li key={l.id} style={{ marginBottom: "0.3rem" }}>
            <a href={l.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8" }}>
              {l.external_source} · ID {l.external_id}
            </a>
            {l.removed_at && <span className="muted" style={{ marginLeft: "0.5rem", color: "#b45309" }}>(removido)</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Documentos del vehículo ──
function VehicleDocsList({ vehicle }: { vehicle: api.Vehicle }) {
  const [docs, setDocs] = useState<api.VehicleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  React.useEffect(() => {
    void api.listVehicleDocuments(vehicle.id)
      .then((d) => setDocs(d))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [vehicle.id]);
  const docTypeLabel: Record<string, string> = {
    factura_compra: "Factura compra",
    factura_comision: "Factura comisión",
    ficha_tecnica: "Ficha técnica",
    permiso_circulacion: "Permiso circulación",
    contrato_venta: "Contrato venta",
    dni_cliente: "DNI cliente",
    reparacion: "Reparación",
    mantenimiento: "Mantenimiento",
    financiacion: "Financiación",
    otros: "Otros",
  };
  if (loading) return null;
  if (docs.length === 0) return null;
  // Agrupar por doc_type
  const grouped: Record<string, api.VehicleDocument[]> = {};
  for (const d of docs) {
    const k = d.doc_type || "otros";
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(d);
  }
  return (
    <section className="panel" style={{ padding: "1.25rem", marginTop: "1rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Documentos ({docs.length})</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <p className="muted" style={{ margin: "0 0 0.25rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {docTypeLabel[type] || type} ({items.length})
            </p>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
              {items.map((d) => (
                <li key={d.id} style={{ marginBottom: "0.2rem" }}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8" }}>
                    {d.file_name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

