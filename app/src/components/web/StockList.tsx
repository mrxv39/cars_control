import React, { useState, useMemo, FormEvent } from "react";
import * as api from "../../lib/api";
import { exportToCSV } from "../../lib/csv-export";
import { usePagination } from "../../hooks/usePagination";
import { PaginationControls } from "./PaginationControls";

// Mínimo de fotos validado con Ricard (sesión 2026-04-04): un coche está
// "listo" para ser publicado/vendido cuando tiene al menos 40 fotos.
const MIN_PHOTOS = 40;
// Tipos de documento que cuentan para el checklist de "coche completo"
// (validado en docs/flujos_sesion_2026-04-04.md §2)
const REQUIRED_DOC_TYPES = ["ficha_tecnica", "permiso_circulacion", "itv", "factura_compra"];

type StockSortKey = "dias" | "leads_pendientes" | "margen" | "recientes";
type StockFilterKey = "todos" | "pendientes" | "leads_pendientes" | "listos" | "sin_precio";

function StockRow({ vehicle, days, leadsPendientes, photoCount, thumbUrl, docTypes, onSelect }: {
  vehicle: api.Vehicle;
  days: number | null;
  leadsPendientes: number;
  photoCount: number | null;
  thumbUrl: string | null;
  docTypes: Set<string> | null;
  onSelect: () => void;
}) {

  const photosOk = (photoCount ?? 0) >= MIN_PHOTOS;
  const photosClass = photoCount === null ? "stock-chip muted" : photosOk ? "stock-chip ok" : (photoCount === 0 ? "stock-chip error" : "stock-chip warn");
  const docsHave = docTypes ? REQUIRED_DOC_TYPES.filter((t) => docTypes.has(t)).length : 0;
  const docsOk = docsHave === REQUIRED_DOC_TYPES.length;
  const docsClass = docTypes === null ? "stock-chip muted" : docsOk ? "stock-chip ok" : (docsHave === 0 ? "stock-chip error" : "stock-chip warn");

  // Mapa de calor global de la fila
  const heat: "ok" | "warn" | "error" =
    photoCount === 0 || docsHave === 0 ? "error" :
    !photosOk || !docsOk ? "warn" : "ok";

  return (
    <article className={`stock-row stock-row-${heat}`} onClick={onSelect}>
      <div className="stock-row-title">
        <h3>{vehicle.name}</h3>
        {vehicle.estado && vehicle.estado !== "disponible" && (
          <span className={`badge-estado badge-${vehicle.estado}`}>{vehicle.estado}</span>
        )}
      </div>
      <div className="stock-row-thumb">
        {thumbUrl ? (
          <img src={thumbUrl} alt={vehicle.name} loading="lazy" />
        ) : (
          <div className="stock-row-thumb-empty">📷</div>
        )}
      </div>
      <div className="stock-row-main">
        {(vehicle.anio || vehicle.km) && (
          <p className="muted" style={{ margin: "0", fontSize: "0.78rem" }}>
            {[vehicle.anio, vehicle.km ? `${vehicle.km.toLocaleString()} km` : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="stock-chips">
          <span className={photosClass} title={`${photoCount ?? "?"} fotos (mínimo ${MIN_PHOTOS})`}>
            📷 {photoCount ?? "…"}/{MIN_PHOTOS}
          </span>
          <span className={docsClass} title="Ficha técnica, permiso de circulación, ITV, factura de compra">
            📄 {docsHave}/{REQUIRED_DOC_TYPES.length}
          </span>
          <span className="stock-chip neutral" title="Días desde la fecha de compra">
            ⏱ {days === null ? "—" : `${days}d`}
          </span>
          {leadsPendientes > 0 && (
            <span className="stock-chip info" title="Leads sin contestar">
              💬 {leadsPendientes}
            </span>
          )}
        </div>
      </div>
      <div className="stock-row-price">
        {vehicle.precio_venta ? (
          <span className="vehicle-price">{vehicle.precio_venta.toLocaleString("es-ES")} €</span>
        ) : (
          <span className="muted" style={{ fontSize: "0.78rem" }}>Sin precio</span>
        )}
      </div>
    </article>
  );
}

export function StockList({ vehicles, allVehicles, leads, purchaseRecords, companyId, dealerWebsite, onSelect, onReload, externalSearch }: { vehicles: api.Vehicle[]; allVehicles: api.Vehicle[]; leads: api.Lead[]; purchaseRecords: api.PurchaseRecord[]; companyId: number; dealerWebsite: string; onSelect: (v: api.Vehicle) => void; onReload: () => void; externalSearch?: string }) {
  const [importPreview, setImportPreview] = useState<api.ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedToImport, setSelectedToImport] = useState<Set<string>>(new Set());

  async function handleImport() {
    if (!dealerWebsite) {
      setImportError("Define la web de la empresa primero (Empresa → Web)");
      return;
    }
    setImportError(null);
    setImporting(true);
    try {
      const known = await api.listKnownExternalIds(companyId);
      const preview = await api.fetchCochesNetPreview(dealerWebsite, known);
      setImportPreview(preview);
      // Por defecto, seleccionar todos los nuevos
      setSelectedToImport(new Set(preview.newDetails.map((d) => d.externalId || "").filter(Boolean)));
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Error consultando coches.net");
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const toCreate = importPreview.newDetails.filter((d) => d.externalId && selectedToImport.has(d.externalId));
      const { created } = await api.importCochesNetVehicles(companyId, toCreate);
      // Marcar removidos como necesitar revisión
      if (importPreview.removedExternalIds.length > 0) {
        await api.markVehiclesNeedsReview(companyId, importPreview.removedExternalIds);
      }
      setImportPreview(null);
      setSelectedToImport(new Set());
      await onReload();
      setImportError(`Importación completada: ${created} coches nuevos.`);
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Error importando");
    } finally {
      setImporting(false);
    }
  }

  const [search, setSearch] = useState(externalSearch || "");
  React.useEffect(() => { if (externalSearch) setSearch(externalSearch); }, [externalSearch]);
  const [sortBy, setSortBy] = useState<StockSortKey>("dias");
  const [filterKey, setFilterKey] = useState<StockFilterKey>("todos");
  const [fuelFilter, setFuelFilter] = useState("");
  const [priceMaxFilter, setPriceMaxFilter] = useState("");
  const [yearMinFilter, setYearMinFilter] = useState("");
  // Mapas precargados para poder filtrar/ordenar a nivel de lista por
  // contadores de fotos y documentos (no se puede esperar al fetch
  // perezoso de cada StockRow para filtrar a este nivel).
  const [photoCountMap, setPhotoCountMap] = useState<Map<number, number>>(new Map());
  const [photoFirstUrlMap, setPhotoFirstUrlMap] = useState<Map<number, string>>(new Map());
  const [docTypesMap, setDocTypesMap] = useState<Map<number, Set<string>>>(new Map());
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAnio, setNewAnio] = useState("");
  const [newKm, setNewKm] = useState("");
  const [newPrecioCompra, setNewPrecioCompra] = useState("");
  const [newPrecioVenta, setNewPrecioVenta] = useState("");
  const [newFuel, setNewFuel] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [nameBlurred, setNameBlurred] = useState(false);
  const nameError = nameBlurred && !newName.trim() ? "El nombre es obligatorio" : null;
  const stockFormDirty = !!(newName || newAnio || newKm || newPrecioCompra || newPrecioVenta || newFuel || newColor || newNotes);
  function handleCancelAdd() {
    if (stockFormDirty && !window.confirm("Tienes cambios sin guardar. ¿Salir sin guardar?")) return;
    setShowAdd(false); setNewName(""); setNewAnio(""); setNewKm(""); setNewPrecioCompra(""); setNewPrecioVenta(""); setNewFuel(""); setNewColor(""); setNewNotes(""); setNameBlurred(false);
  }

  // Precarga resúmenes de fotos+docs de todos los vehículos en DOS queries
  // batched (.in()) en lugar de 2N queries individuales. Validado 2026-04-08:
  // con 30 coches pasamos de ~60 round-trips a 2.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = vehicles.map((v) => v.id);
      const [photoSummary, docSummary] = await Promise.all([
        api.getStockPhotoSummary(ids).catch(() => new Map()),
        api.getStockDocSummary(ids).catch(() => new Map()),
      ]);
      if (cancelled) return;
      const pMap = new Map<number, number>();
      const uMap = new Map<number, string>();
      for (const [id, info] of photoSummary) {
        pMap.set(id, info.count);
        if (info.thumbUrl) uMap.set(id, info.thumbUrl);
      }
      setPhotoCountMap(pMap);
      setPhotoFirstUrlMap(uMap);
      setDocTypesMap(docSummary);
    })();
    return () => { cancelled = true; };
  }, [vehicles]);

  // Mapa vehicle_id → fecha de compra más antigua (para "días en stock")
  const purchaseDateByVehicle = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of purchaseRecords) {
      if (p.expense_type !== "COMPRA_VEHICULO" || !p.vehicle_id || !p.purchase_date) continue;
      const existing = map.get(p.vehicle_id);
      if (!existing || p.purchase_date < existing) map.set(p.vehicle_id, p.purchase_date);
    }
    return map;
  }, [purchaseRecords]);

  function daysInStock(vehicleId: number): number | null {
    const date = purchaseDateByVehicle.get(vehicleId);
    if (!date) return null;
    const ms = Date.now() - new Date(date).getTime();
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  }

  const leadCounts = useMemo(() => {
    const unanswered = new Map<number, number>();
    const total = new Map<number, number>();
    for (const l of leads) {
      if (!l.vehicle_id) continue;
      total.set(l.vehicle_id, (total.get(l.vehicle_id) || 0) + 1);
      if (l.estado === "nuevo" || !l.estado) {
        unanswered.set(l.vehicle_id, (unanswered.get(l.vehicle_id) || 0) + 1);
      }
    }
    return { unanswered, total };
  }, [leads]);

  // Helper: ¿está el coche "completo" (40+ fotos, 4 docs)?
  function isComplete(v: api.Vehicle): boolean {
    const photos = photoCountMap.get(v.id) ?? 0;
    const docs = docTypesMap.get(v.id);
    if (photos < MIN_PHOTOS) return false;
    if (!docs) return false;
    return REQUIRED_DOC_TYPES.every((t) => docs.has(t));
  }

  const fuelOptions = useMemo(() =>
    [...new Set(vehicles.map((v) => v.fuel).filter(Boolean))].sort(),
    [vehicles]
  );

  const filtered = useMemo(() => {
    let list = vehicles;
    if (filterKey === "pendientes") {
      list = list.filter((v) => !isComplete(v));
    } else if (filterKey === "leads_pendientes") {
      list = list.filter((v) => (leadCounts.unanswered.get(v.id) || 0) > 0);
    } else if (filterKey === "listos") {
      list = list.filter((v) => isComplete(v));
    } else if (filterKey === "sin_precio") {
      list = list.filter((v) => !v.precio_venta);
    }
    if (fuelFilter) list = list.filter((v) => v.fuel === fuelFilter);
    const maxPrice = Number(priceMaxFilter);
    if (maxPrice > 0) list = list.filter((v) => v.precio_venta && v.precio_venta <= maxPrice);
    const minYear = Number(yearMinFilter);
    if (minYear > 0) list = list.filter((v) => v.anio && v.anio >= minYear);
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((v) =>
        [v.name, v.estado, v.fuel, String(v.anio || ""), String(v.precio_venta || "")]
          .some((field) => field.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "dias") {
        const da = daysInStock(a.id);
        const db = daysInStock(b.id);
        // Sin fecha → al final
        if (da === null && db === null) return a.id - b.id;
        if (da === null) return 1;
        if (db === null) return -1;
        return db - da; // más antiguos primero
      }
      if (sortBy === "leads_pendientes") {
        const ua = leadCounts.unanswered.get(a.id) || 0;
        const ub = leadCounts.unanswered.get(b.id) || 0;
        if (ua !== ub) return ub - ua;
        const la = leadCounts.total.get(a.id) || 0;
        const lb = leadCounts.total.get(b.id) || 0;
        return lb - la;
      }
      if (sortBy === "margen") {
        const ma = (a.precio_venta || 0) - (a.precio_compra || 0);
        const mb = (b.precio_venta || 0) - (b.precio_compra || 0);
        return mb - ma;
      }
      // recientes
      return b.id - a.id;
    });
  }, [vehicles, leads, search, sortBy, filterKey, fuelFilter, priceMaxFilter, yearMinFilter, purchaseDateByVehicle, leadCounts, photoCountMap, docTypesMap]);

  const { paged: pagedStock, page: stockPage, totalPages: stockTotalPages, setPage: setStockPage } = usePagination(filtered);

  const filterCounts = useMemo(() => ({
    todos: vehicles.length,
    pendientes: vehicles.filter((v) => !isComplete(v)).length,
    leads_pendientes: vehicles.filter((v) => (leadCounts.unanswered.get(v.id) || 0) > 0).length,
    listos: vehicles.filter((v) => isComplete(v)).length,
    sin_precio: vehicles.filter((v) => !v.precio_venta).length,
  }), [vehicles, leadCounts, photoCountMap, docTypesMap]);

  const suggestions = useMemo(() => {
    const q = newName.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return allVehicles
      .filter((v) => v.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allVehicles, newName]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.createVehicle(companyId, {
        name: newName.trim(),
        anio: newAnio ? parseInt(newAnio) : null,
        km: newKm ? parseInt(newKm) : null,
        precio_compra: newPrecioCompra ? parseFloat(newPrecioCompra) : null,
        precio_venta: newPrecioVenta ? parseFloat(newPrecioVenta) : null,
        fuel: newFuel,
        color: newColor,
        notes: newNotes,
      } as api.Vehicle);
      setNewName(""); setNewAnio(""); setNewKm(""); setNewPrecioCompra(""); setNewPrecioVenta(""); setNewFuel(""); setNewColor(""); setNewNotes("");
      setShowAdd(false); setNameBlurred(false);
      await onReload();
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Stock</p>
          <h2>Vehículos en stock</h2>
          <p className="muted">{vehicles.length} vehículo{vehicles.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={() => exportToCSV(vehicles.map(v => ({ Nombre: v.name, Año: v.anio, Km: v.km, Precio_compra: v.precio_compra, Precio_venta: v.precio_venta, Estado: v.estado, Combustible: v.fuel, Color: v.color })), "stock")}>
            Exportar CSV
          </button>
          <button type="button" className="button secondary" onClick={() => void handleImport()} disabled={importing}>
            {importing ? "Importando..." : "Importar de coches.net"}
          </button>
          <button type="button" className="button primary" onClick={() => showAdd ? handleCancelAdd() : setShowAdd(true)}>
            {showAdd ? "Cancelar" : "Añadir vehículo"}
          </button>
        </div>
      </header>

      <section className="panel filter-panel">
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "nowrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="sales-search"
            style={{ flex: "0 0 33%", minWidth: 0 }}
          />
          {([
            { key: "pendientes", label: "Pendientes" },
            { key: "leads_pendientes", label: "Con leads" },
            { key: "listos", label: "Listos" },
            { key: "sin_precio", label: "Sin precio" },
          ] as { key: StockFilterKey; label: string }[]).map(({ key, label }) => {
            const active = filterKey === key;
            return (
              <button
                key={key}
                type="button"
                className={`button ${active ? "primary" : "secondary"} xs`}
                style={{ whiteSpace: "nowrap" }}
                // Click sobre filtro activo lo desactiva (vuelve a "todos")
                onClick={() => setFilterKey(active ? "todos" : key)}
              >
                {label} <span style={{ opacity: 0.7, marginLeft: "0.25rem" }}>({filterCounts[key]})</span>
              </button>
            );
          })}
          <select value={fuelFilter} onChange={(e) => setFuelFilter(e.target.value)} style={{ flex: "0 0 auto" }}>
            <option value="">Combustible</option>
            {fuelOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={priceMaxFilter} onChange={(e) => setPriceMaxFilter(e.target.value)} style={{ flex: "0 0 auto" }}>
            <option value="">Precio max</option>
            <option value="8000">8.000 €</option>
            <option value="12000">12.000 €</option>
            <option value="18000">18.000 €</option>
            <option value="25000">25.000 €</option>
            <option value="35000">35.000 €</option>
          </select>
          <select value={yearMinFilter} onChange={(e) => setYearMinFilter(e.target.value)} style={{ flex: "0 0 auto" }}>
            <option value="">Año min</option>
            <option value="2024">2024+</option>
            <option value="2022">2022+</option>
            <option value="2020">2020+</option>
            <option value="2018">2018+</option>
            <option value="2015">2015+</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as StockSortKey)} style={{ flex: "0 0 auto" }}>
            <option value="dias">↓ Días en stock</option>
            <option value="leads_pendientes">↓ Leads pendientes</option>
            <option value="margen">↓ Margen</option>
            <option value="recientes">↓ Recientes</option>
          </select>
        </div>
        {(search || filterKey !== "todos") && (
          <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.78rem" }}>
            {filtered.length} de {vehicles.length}
          </p>
        )}
      </section>

      {showAdd && (
        <section className="panel" style={{ padding: "1.5rem" }}>
          <form onSubmit={(e) => void handleAdd(e)}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "end" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <label className="field-label required">Marca y modelo</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => setNameBlurred(true)} placeholder="Escribe para buscar coincidencias..." autoFocus className={nameError ? "input-error" : ""} />
                {nameError && <p className="input-error-message" role="alert">{nameError}</p>}
              </div>
            </div>
            <div className="form-grid-2" style={{ marginTop: "0.75rem" }}>
              <div>
                <label className="field-label">Año</label>
                <input type="number" value={newAnio} onChange={(e) => setNewAnio(e.target.value)} placeholder="2024" />
              </div>
              <div>
                <label className="field-label">Kilómetros</label>
                <input type="number" value={newKm} onChange={(e) => setNewKm(e.target.value)} placeholder="50000" />
              </div>
            </div>
            <div className="form-grid-2" style={{ marginTop: "0.75rem" }}>
              <div>
                <label className="field-label">Precio compra</label>
                <input type="number" step="100" value={newPrecioCompra} onChange={(e) => setNewPrecioCompra(e.target.value)} placeholder="8000" />
              </div>
              <div>
                <label className="field-label">Precio venta</label>
                <input type="number" step="100" value={newPrecioVenta} onChange={(e) => setNewPrecioVenta(e.target.value)} placeholder="10500" />
              </div>
            </div>
            <div className="form-grid-2" style={{ marginTop: "0.75rem" }}>
              <div>
                <label className="field-label">Combustible</label>
                <select value={newFuel} onChange={(e) => setNewFuel(e.target.value)}>
                  <option value="">—</option>
                  <option value="Gasolina">Gasolina</option>
                  <option value="Diésel">Diésel</option>
                  <option value="Híbrido">Híbrido</option>
                  <option value="Eléctrico">Eléctrico</option>
                  <option value="GLP">GLP</option>
                </select>
              </div>
              <div>
                <label className="field-label">Color</label>
                <input value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="Blanco" />
              </div>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label className="field-label">Notas</label>
              <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <button type="submit" className="button primary" disabled={adding}>{adding ? "Añadiendo..." : "Añadir vehículo"}</button>
            </div>
            {suggestions.length > 0 && (
              <div className="suggestions-list">
                <p className="field-label" style={{ margin: "0.75rem 0 0.4rem", fontSize: "0.72rem" }}>Coincidencias en la base de datos:</p>
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="suggestion-item"
                    onClick={() => setNewName(s.name)}
                  >
                    <span className="suggestion-name">{s.name}</span>
                    <span className="suggestion-meta">
                      {[s.anio, s.km ? `${s.km.toLocaleString()} km` : null, s.estado].filter(Boolean).join(" · ")}
                      {s.precio_venta ? ` · ${s.precio_venta.toLocaleString("es-ES")} €` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </form>
        </section>
      )}

      <PaginationControls page={stockPage} totalPages={stockTotalPages} setPage={setStockPage} />
      <section className="stock-list" aria-live="polite">
        {pagedStock.map((v) => (
          <StockRow
            key={v.id}
            vehicle={v}
            days={daysInStock(v.id)}
            leadsPendientes={leadCounts.unanswered.get(v.id) || 0}
            photoCount={photoCountMap.get(v.id) ?? null}
            thumbUrl={photoFirstUrlMap.get(v.id) ?? null}
            docTypes={docTypesMap.get(v.id) ?? null}
            onSelect={() => onSelect(v)}
          />
        ))}
      </section>
      <PaginationControls page={stockPage} totalPages={stockTotalPages} setPage={setStockPage} />

      {importError && (
        <div className="modal-overlay" onClick={() => setImportError(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <h3 style={{ margin: 0, color: "#b91c1c" }}>Error</h3>
            <p>{importError}</p>
            <div className="form-actions">
              <button type="button" className="button primary" onClick={() => setImportError(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="modal-overlay" onClick={() => !importing && setImportPreview(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "780px", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 0.5rem" }}>Importar desde coches.net</h3>
            <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.85rem" }}>
              {importPreview.listing.length} coches en el perfil ·
              {" "}{importPreview.newDetails.length} nuevos detectados ·
              {" "}{importPreview.removedExternalIds.length} ya no aparecen
            </p>

            {importPreview.newDetails.length > 0 ? (
              <>
                <h4 style={{ margin: "0.75rem 0 0.5rem" }}>Nuevos coches</h4>
                <p className="muted" style={{ fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
                  Marca los que quieras importar (todos por defecto)
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {importPreview.newDetails.map((d) => {
                    const id = d.externalId || "";
                    const checked = selectedToImport.has(id);
                    return (
                      <label key={id} style={{ display: "flex", gap: "0.75rem", padding: "0.5rem", border: "1px solid #e5e5e5", borderRadius: "8px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selectedToImport);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            setSelectedToImport(next);
                          }}
                        />
                        {d.photoUrls[0] && (
                          <img src={d.photoUrls[0]} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 4 }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <strong>{d.name}</strong>
                          <div className="muted" style={{ fontSize: "0.78rem" }}>
                            {[d.year, d.km ? `${d.km.toLocaleString()} km` : null, d.fuelType, d.transmission, d.color].filter(Boolean).join(" · ")}
                          </div>
                          <div className="muted" style={{ fontSize: "0.78rem" }}>
                            {d.photoUrls.length} fotos · {d.equipment.length} equipamientos
                            {d.videoUrls.length > 0 && ` · ${d.videoUrls.length} vídeos`}
                          </div>
                        </div>
                        <div style={{ fontWeight: "bold" }}>{d.price?.toLocaleString("es-ES")} €</div>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="muted">No hay coches nuevos en coches.net.</p>
            )}

            {importPreview.removedExternalIds.length > 0 && (
              <>
                <h4 style={{ margin: "1rem 0 0.5rem", color: "#b45309" }}>Ya no aparecen en coches.net</h4>
                <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
                  Estos {importPreview.removedExternalIds.length} coches se marcarán para revisión.
                </p>
              </>
            )}

            <div className="form-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="button secondary" onClick={() => setImportPreview(null)} disabled={importing}>
                Cancelar
              </button>
              <button type="button" className="button primary" onClick={() => void confirmImport()} disabled={importing || selectedToImport.size === 0}>
                {importing ? "Importando..." : `Importar ${selectedToImport.size} coches`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
