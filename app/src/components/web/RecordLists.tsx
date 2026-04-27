import React, { useState, useMemo, FormEvent } from "react";
import * as api from "../../lib/api";
import { usePagination } from "../../hooks/usePagination";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { exportToCSV } from "../../lib/csv-export";
import { generateInvoicePDF } from "../../utils/invoiceGenerator";
import { showToast } from "../../lib/toast";
import { translateError } from "../../lib/translateError";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import { PaginationControls } from "./PaginationControls";

export function ClientsList({ clients, companyId: _companyId, onReload }: { clients: api.Client[]; companyId: number; onReload: () => void }) {
  const dialog = useConfirmDialog();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", dni: "", notes: "" });
  const [clientSearch, setClientSearch] = useState("");
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter((c) => [c.name, c.phone, c.email, c.dni].some((v) => v?.toLowerCase().includes(q)));
  }, [clients, clientSearch]);
  const { paged: pagedClients, page: clientsPage, totalPages: clientsTotalPages, setPage: setClientsPage } = usePagination(filteredClients);

  const clientPhoneDup = useMemo(() => {
    if (!editForm.phone || !editForm.phone.trim()) return null;
    const normalized = editForm.phone.replace(/\s/g, "");
    const dup = clients.find((c) => c.id !== editingId && c.phone.replace(/\s/g, "") === normalized);
    return dup ? `Ya existe un cliente con este teléfono: ${dup.name}` : null;
  }, [editForm.phone, editingId, clients]);

  const clientOriginal = React.useRef<typeof editForm | null>(null);
  function startEdit(c: api.Client) {
    setEditingId(c.id);
    const form = { name: c.name, phone: c.phone, email: c.email, dni: c.dni, notes: c.notes };
    setEditForm(form);
    clientOriginal.current = { ...form };
  }
  function cancelClientEdit() {
    if (clientOriginal.current && JSON.stringify(editForm) !== JSON.stringify(clientOriginal.current)) {
      dialog.requestConfirm("Cambios sin guardar", "Tienes cambios sin guardar. ¿Salir sin guardar?", () => setEditingId(null));
      return;
    }
    setEditingId(null);
  }

  async function saveEdit() {
    if (editingId == null) return;
    try {
      await api.updateClient(editingId, editForm as Partial<api.Client>);
      setEditingId(null);
      onReload();
      showToast("Cliente guardado");
    } catch (err) { showToast(translateError(err), "error"); }
  }

  function handleDeleteClient(id: number, name: string) {
    dialog.requestConfirm("Eliminar cliente", `¿Eliminar cliente "${name}"? Esta acción no se puede deshacer.`, async () => {
      try {
        await api.deleteClient(id);
        onReload();
        showToast("Cliente eliminado");
      } catch (err) { showToast(translateError(err), "error"); }
    });
  }

  return (
    <>
      <ConfirmDialog {...dialog.confirmProps} />
      <header className="hero">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Clientes registrados</h2>
          <p className="muted">{clients.length} cliente{clients.length !== 1 ? "s" : ""}</p>
        </div>
        {clients.length > 0 && (
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={() => exportToCSV(clients.map(c => ({ Nombre: c.name, Teléfono: c.phone, Email: c.email, DNI: c.dni, Notas: c.notes })), "clientes")}>
              Exportar CSV
            </button>
          </div>
        )}
      </header>
      {clients.length > 0 && (
        <section className="panel" style={{ padding: "0.75rem 1rem", marginBottom: "0.75rem" }}>
          <input value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setClientsPage(0); }} placeholder="Buscar cliente por nombre, teléfono, email o DNI..." style={{ width: "100%", border: "none", background: "transparent", outline: "none", fontSize: "0.9rem" }} aria-label="Buscar clientes" />
        </section>
      )}
      {clients.length === 0 && (
        <EmptyState icon="👤" title="Sin clientes registrados" description="Los clientes se crean al convertir un lead en cliente desde la vista de Interesados." />
      )}
      {filteredClients.length === 0 && clients.length > 0 && (
        <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
          <p className="muted">No hay clientes que coincidan con la búsqueda.</p>
          <button type="button" className="button secondary" style={{ marginTop: "0.5rem" }} onClick={() => setClientSearch("")}>Limpiar búsqueda</button>
        </div>
      )}
      <PaginationControls page={clientsPage} totalPages={clientsTotalPages} setPage={setClientsPage} />
      <section className="record-grid" aria-live="polite">
        {pagedClients.map((c) => (
          <article key={c.id} className="record-card panel">
            {editingId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nombre" className={!editForm.name.trim() && editingId ? "input-error" : ""} />
                {!editForm.name.trim() && editingId && <p className="input-error-message" role="alert">El nombre es obligatorio</p>}
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Teléfono" />
                {clientPhoneDup && <p style={{ color: "var(--color-warning)", fontSize: "var(--text-xs)", margin: "calc(-1 * var(--space-xs)) 0 0" }}><span aria-hidden="true">⚠ </span>{clientPhoneDup}</p>}
                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" />
                <input value={editForm.dni} onChange={(e) => setEditForm({ ...editForm, dni: e.target.value })} placeholder="DNI" />
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notas" rows={2} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="button primary" style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={() => void saveEdit()}>Guardar</button>
                  <button type="button" className="button secondary" style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={cancelClientEdit}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="record-header">
                  <div>
                    <p className="record-title">{c.name}</p>
                    <p className="muted">{c.phone || "Sin teléfono"}</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                    <span className="badge badge-success">Cliente</span>
                    <button type="button" className="button secondary xs" onClick={() => startEdit(c)}>Editar</button>
                    <button type="button" className="button danger xs" onClick={() => void handleDeleteClient(c.id, c.name)}>Eliminar</button>
                  </div>
                </div>
                {c.dni && <p className="record-line">DNI: {c.dni}</p>}
                {c.email && <p className="record-line">{c.email}</p>}
              </>
            )}
          </article>
        ))}
      </section>
      <PaginationControls page={clientsPage} totalPages={clientsTotalPages} setPage={setClientsPage} />
    </>
  );
}

// ============================================================
// Sales List
// ============================================================
export function SalesList({ records, vehicles, clients, companyId: _companyId, company, onReload }: { records: api.SalesRecord[]; vehicles: api.Vehicle[]; clients: api.Client[]; companyId: number; company: api.Company; onReload: () => void }) {
  const dialog = useConfirmDialog();
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const total = useMemo(() => records.reduce((s, r) => s + r.price_final, 0), [records]);
  const { paged: pagedSales, page: salesPage, totalPages: salesTotalPages, setPage: setSalesPage } = usePagination(records);

  function handleDeleteSale(id: number, vehicleName: string) {
    dialog.requestConfirm("Eliminar venta", `¿Eliminar registro de venta de "${vehicleName}"? Esta acción no se puede deshacer.`, async () => {
      try {
        await api.deleteSalesRecord(id);
        onReload();
        showToast("Venta eliminada");
      } catch (err) { showToast(translateError(err), "error"); }
    });
  }

  return (
    <>
      <ConfirmDialog {...dialog.confirmProps} />
      <header className="hero">
        <div>
          <p className="eyebrow">Ventas</p>
          <h2>Registro de ventas</h2>
          <p className="muted">{records.length} venta{records.length !== 1 ? "s" : ""} · {total.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
        </div>
        {records.length > 0 && (
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={() => exportToCSV(records.map(r => ({ Vehículo: r.vehicle_id ? vehicleMap.get(r.vehicle_id)?.name || "" : "", Cliente: r.client_id ? clientMap.get(r.client_id)?.name || "" : "", Fecha: r.date, Precio: r.price_final, Notas: r.notes })), "ventas")}>
              Exportar CSV
            </button>
          </div>
        )}
      </header>
      {records.length === 0 && (
        <EmptyState icon="🧾" title="Sin ventas registradas" description="Registra una venta desde la ficha de un vehículo con el botón 'Registrar venta'." />
      )}
      {records.length > 0 && (
        <section className="panel sales-records-panel">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead><tr>
                <th className="sales-th">Vehículo</th>
                <th className="sales-th">Cliente</th>
                <th className="sales-th">Fecha</th>
                <th className="sales-th sales-th-right">Precio</th>
                <th className="sales-th" style={{ width: "10rem" }}></th>
              </tr></thead>
              <tbody>
                {pagedSales.map((r) => {
                  const vehicle = r.vehicle_id ? vehicleMap.get(r.vehicle_id) : null;
                  const vName = vehicle?.name || "Venta";
                  const client = r.client_id ? clientMap.get(r.client_id) : null;
                  return (
                    <tr key={r.id} className="sales-row">
                      <td className="sales-td">{vName !== "Venta" ? vName : "—"}</td>
                      <td className="sales-td">{client?.name || "—"}</td>
                      <td className="sales-td">{new Date(r.date).toLocaleDateString("es-ES")}</td>
                      <td className="sales-td sales-td-right"><span className="sales-price">{r.price_final.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span></td>
                      <td className="sales-td" style={{ display: "flex", gap: "var(--space-xs)" }}>
                        <button type="button" className="button secondary xs" aria-label={`Generar factura de venta para ${vName}`} onClick={() => {
                          const year = new Date(r.date).getFullYear();
                          const idx = records.filter(s => new Date(s.date).getFullYear() === year && s.id <= r.id).length;
                          generateInvoicePDF({
                            invoiceNumber: `F-${year}-${String(idx).padStart(3, "0")}`,
                            date: new Date(r.date).toLocaleDateString("es-ES"),
                            type: "REBU",
                            companyName: company.trade_name,
                            companyLegalName: company.legal_name || company.trade_name,
                            companyCif: company.cif || "",
                            companyAddress: company.address || "",
                            companyPhone: company.phone || "",
                            companyEmail: company.email || "",
                            buyerName: client?.name || "—",
                            buyerDni: client?.dni || "",
                            buyerPhone: client?.phone,
                            vehicleName: vName,
                            purchasePrice: vehicle?.precio_compra || 0,
                            salePrice: r.price_final,
                          });
                        }}>Factura</button>
                        <button type="button" className="button danger xs" aria-label={`Eliminar venta de ${vName}`} onClick={() => void handleDeleteSale(r.id, vName)}>Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls page={salesPage} totalPages={salesTotalPages} setPage={setSalesPage} />
        </section>
      )}
    </>
  );
}

// ============================================================
// Purchases List
// ============================================================
export function PurchasesList({ records, companyId, onReload }: { records: api.PurchaseRecord[]; companyId: number; onReload: () => void }) {
  const dialog = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) { if (r.supplier_name) set.add(r.supplier_name); }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [records]);
  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) { if (r.expense_type) set.add(r.expense_type); }
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (filterSupplier && r.supplier_name !== filterSupplier) return false;
      if (filterType && r.expense_type !== filterType) return false;
      if (dateFrom || dateTo) {
        if (!r.purchase_date) return false;
        const d = r.purchase_date.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      if (!q) return true;
      return [r.plate, r.vehicle_name, r.supplier_name, r.invoice_number].some((v) => v?.toLowerCase().includes(q));
    });
  }, [records, search, filterSupplier, filterType, dateFrom, dateTo]);

  const total = useMemo(() => filteredRecords.reduce((s, r) => s + r.purchase_price, 0), [filteredRecords]);
  const { paged: pagedPurchases, page: purchasesPage, totalPages: purchasesTotalPages, setPage: setPurchasesPage } = usePagination(filteredRecords);

  // Marca qué purchase_records ya tienen movimiento bancario vinculado
  // (chip "✓ Banco" → indica que la compra está conciliada con el extracto).
  const [bankLinked, setBankLinked] = useState<Set<number>>(new Set());
  React.useEffect(() => {
    let cancelled = false;
    void api.listPurchaseIdsWithBankLink(companyId).then((ids) => {
      if (!cancelled) setBankLinked(ids);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [companyId, records]);

  // Carga batch de signed URLs para facturas adjuntas a vehicle_documents
  // (doc_type='factura'). Solo se piden las de los vehicle_id presentes en el listado.
  const [invoiceMap, setInvoiceMap] = useState<Map<number, { fileName: string; url: string }>>(new Map());
  React.useEffect(() => {
    let cancelled = false;
    const vehicleIds = Array.from(new Set(records.map((r) => r.vehicle_id).filter((id): id is number => id != null)));
    if (vehicleIds.length === 0) { setInvoiceMap(new Map()); return; }
    void api.getPurchaseInvoicesByVehicleIds(vehicleIds).then((m) => {
      if (!cancelled) setInvoiceMap(m);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [records]);

  // Preview de factura a la derecha de la tabla. Click en "Ver" → setea esto.
  const [selectedInvoice, setSelectedInvoice] = useState<{ recordId: number; fileName: string; url: string; label: string } | null>(null);
  // Reset si la factura seleccionada deja de existir tras un cambio en records
  React.useEffect(() => {
    if (!selectedInvoice) return;
    const stillThere = records.some((r) => r.id === selectedInvoice.recordId);
    if (!stillThere) setSelectedInvoice(null);
  }, [records, selectedInvoice]);
  const isImage = selectedInvoice ? /\.(jpe?g|png|webp|gif|bmp)$/i.test(selectedInvoice.fileName) : false;

  // Adjuntar factura desde el listado: un único <input type=file> oculto y
  // recordamos a qué record/vehicle apunta el click activo.
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingTargetRef = React.useRef<{ recordId: number; vehicleId: number } | null>(null);
  const [uploadingForId, setUploadingForId] = useState<number | null>(null);
  function startAttach(record: api.PurchaseRecord) {
    if (record.vehicle_id == null) return;
    pendingTargetRef.current = { recordId: record.id, vehicleId: record.vehicle_id };
    fileInputRef.current?.click();
  }
  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const target = pendingTargetRef.current;
    if (e.target) e.target.value = "";
    if (!file || !target) return;
    setUploadingForId(target.recordId);
    try {
      const doc = await api.uploadVehicleDocument(target.vehicleId, file, "factura");
      setInvoiceMap((prev) => {
        const next = new Map(prev);
        next.set(target.vehicleId, { fileName: doc.file_name, url: doc.url });
        return next;
      });
      showToast("Factura adjuntada");
    } catch (err) {
      showToast(translateError(err), "error");
    } finally {
      setUploadingForId(null);
      pendingTargetRef.current = null;
    }
  }

  function clearFilters() { setSearch(""); setFilterSupplier(""); setFilterType(""); setDateFrom(""); setDateTo(""); }
  const hasActiveFilters = !!(search || filterSupplier || filterType || dateFrom || dateTo);

  function handleDeletePurchase(id: number, supplierName: string) {
    dialog.requestConfirm("Eliminar compra", `¿Eliminar registro de compra de "${supplierName}"? Esta acción no se puede deshacer.`, async () => {
      try {
        await api.deletePurchaseRecord(id);
        onReload();
        showToast("Compra eliminada");
      } catch (err) { showToast(translateError(err), "error"); }
    });
  }

  return (
    <>
      <ConfirmDialog {...dialog.confirmProps} />
      <header className="hero">
        <div>
          <p className="eyebrow">Compras y Gastos</p>
          <h2>Registro de compras</h2>
          <p className="muted">
            {hasActiveFilters
              ? `${filteredRecords.length} de ${records.length} registro${records.length !== 1 ? "s" : ""}`
              : `${records.length} registro${records.length !== 1 ? "s" : ""}`
            } · {total.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
          </p>
        </div>
        {records.length > 0 && (
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={() => exportToCSV(filteredRecords.map(r => ({ Tipo: r.expense_type, Vehículo: r.vehicle_name, Matrícula: r.plate, Proveedor: r.supplier_name, Fecha: r.purchase_date, Importe: r.purchase_price, Factura: r.invoice_number, Pago: r.payment_method, Notas: r.notes })), "compras")}>
              Exportar CSV
            </button>
          </div>
        )}
      </header>
      {records.length > 0 && (
        <section className="panel filter-panel" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.75rem 1rem", marginBottom: "0.75rem", alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPurchasesPage(0); }}
            placeholder="Buscar por matrícula, vehículo, proveedor o nº factura..."
            aria-label="Buscar compras"
            style={{ flex: "1 1 240px", minWidth: 200 }}
          />
          <select
            value={filterSupplier}
            onChange={(e) => { setFilterSupplier(e.target.value); setPurchasesPage(0); }}
            aria-label="Filtrar por proveedor"
            style={{ flex: "0 1 220px", minWidth: 180 }}
          >
            <option value="">Todos los proveedores</option>
            {supplierOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPurchasesPage(0); }}
            aria-label="Filtrar por tipo"
            style={{ flex: "0 1 180px", minWidth: 150 }}
          >
            <option value="">Todos los tipos</option>
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
            Desde
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => { setDateFrom(e.target.value); setPurchasesPage(0); }}
              aria-label="Fecha desde"
              style={{ width: 150 }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
            Hasta
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => { setDateTo(e.target.value); setPurchasesPage(0); }}
              aria-label="Fecha hasta"
              style={{ width: 150 }}
            />
          </label>
          {hasActiveFilters && (
            <button type="button" className="button secondary xs" onClick={clearFilters}>Limpiar</button>
          )}
        </section>
      )}
      {records.length === 0 && (
        <EmptyState icon="🛒" title="Sin compras registradas" description="Registra compras de vehículos y gastos asociados (reparaciones, ITV, etc.)." />
      )}
      {records.length > 0 && filteredRecords.length === 0 && (
        <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
          <p className="muted">No hay compras que coincidan con los filtros.</p>
          <button type="button" className="button secondary" style={{ marginTop: "0.5rem" }} onClick={clearFilters}>Limpiar filtros</button>
        </div>
      )}
      {filteredRecords.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: selectedInvoice ? "minmax(0, 1fr) minmax(360px, 480px)" : "1fr", gap: "var(--space-md)", alignItems: "start" }}>
          <section className="panel sales-records-panel">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead><tr>
                  <th className="sales-th">Tipo</th>
                  <th className="sales-th">Vehículo</th>
                  <th className="sales-th">Proveedor</th>
                  <th className="sales-th">Fecha</th>
                  <th className="sales-th sales-th-right">Importe</th>
                  <th className="sales-th">Factura</th>
                  <th className="sales-th" style={{ width: "5.5rem" }}>Banco</th>
                  <th className="sales-th" style={{ width: "4rem" }}></th>
                </tr></thead>
                <tbody>
                  {pagedPurchases.map((r) => {
                    const invoice = r.vehicle_id != null ? invoiceMap.get(r.vehicle_id) : undefined;
                    const isSelected = selectedInvoice?.recordId === r.id;
                    return (
                      <tr key={r.id} className="sales-row" style={isSelected ? { background: "var(--color-bg-secondary)" } : undefined}>
                        <td className="sales-td"><span className="badge">{({ vehiculo_compra: "Compra vehículo", reparacion: "Reparación", transporte: "Transporte", documentacion: "Documentación", otros: "Otros" } as Record<string, string>)[r.expense_type] || r.expense_type}</span></td>
                        <td className="sales-td">
                          {r.vehicle_name || r.plate ? (
                            <>
                              <div>{r.vehicle_name || "—"}</div>
                              {r.plate && <div className="muted" style={{ fontSize: "var(--text-xs)" }}>{r.plate}</div>}
                            </>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td className="sales-td">{r.supplier_name}</td>
                        <td className="sales-td">{r.purchase_date ? new Date(r.purchase_date).toLocaleDateString("es-ES") : "—"}</td>
                        <td className="sales-td sales-td-right"><span className="sales-price">{r.purchase_price.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span></td>
                        <td className="sales-td">
                          {invoice ? (
                            <button
                              type="button"
                              className={isSelected ? "button primary xs" : "button secondary xs"}
                              title={invoice.fileName}
                              aria-label={`Ver factura ${r.invoice_number || invoice.fileName}`}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedInvoice({
                                recordId: r.id,
                                fileName: invoice.fileName,
                                url: invoice.url,
                                label: r.invoice_number || invoice.fileName,
                              })}
                            >
                              {r.invoice_number ? `${r.invoice_number} · Ver` : "Ver factura"}
                            </button>
                          ) : r.vehicle_id != null ? (
                            <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center", flexWrap: "wrap" }}>
                              {r.invoice_number && <span className="badge badge-info">{r.invoice_number}</span>}
                              <button
                                type="button"
                                className="button secondary xs"
                                disabled={uploadingForId === r.id}
                                onClick={() => startAttach(r)}
                                aria-label={`Adjuntar factura para ${r.vehicle_name || r.supplier_name}`}
                              >
                                {uploadingForId === r.id ? "Subiendo..." : "Adjuntar"}
                              </button>
                            </div>
                          ) : (
                            <span className="badge badge-info">{r.invoice_number || "—"}</span>
                          )}
                        </td>
                        <td className="sales-td">
                          {bankLinked.has(r.id) ? (
                            <span className="badge badge-success" title="Vinculado a movimiento bancario" style={{ fontSize: "var(--text-xs)" }}>✓ Banco</span>
                          ) : (
                            <span className="muted" style={{ fontSize: "var(--text-xs)" }}>—</span>
                          )}
                        </td>
                        <td className="sales-td"><button type="button" className="button danger xs" aria-label={`Eliminar compra de ${r.supplier_name}`} onClick={() => void handleDeletePurchase(r.id, r.supplier_name)}>Eliminar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationControls page={purchasesPage} totalPages={purchasesTotalPages} setPage={setPurchasesPage} />
          </section>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            style={{ display: "none" }}
            onChange={(e) => void onFileSelected(e)}
          />
          {selectedInvoice && (
            <aside className="panel" style={{ position: "sticky", top: "var(--space-md)", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 2 * var(--space-md))", padding: 0, overflow: "hidden" }} aria-label="Vista previa de factura">
              <header style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", padding: "var(--space-sm) var(--space-md)", borderBottom: "1px solid var(--color-border-light)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="eyebrow" style={{ margin: 0 }}>Factura</p>
                  <p style={{ margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedInvoice.fileName}>{selectedInvoice.label}</p>
                </div>
                <a href={selectedInvoice.url} target="_blank" rel="noopener noreferrer" className="button secondary xs" aria-label="Abrir factura en nueva pestaña">Abrir</a>
                <button type="button" className="button secondary xs" onClick={() => setSelectedInvoice(null)} aria-label="Cerrar vista previa de factura">✕</button>
              </header>
              <div style={{ flex: 1, minHeight: 0, background: "var(--color-bg-secondary)", display: "flex", alignItems: "stretch", justifyContent: "stretch" }}>
                {isImage ? (
                  <img src={selectedInvoice.url} alt={selectedInvoice.fileName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <iframe src={selectedInvoice.url} title={selectedInvoice.fileName} style={{ width: "100%", height: "100%", border: 0, minHeight: 480 }} />
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </>
  );
}

// ============================================================
// Suppliers List
// ============================================================
export function SuppliersList({ suppliers, companyId, onReload }: { suppliers: api.Supplier[]; companyId: number; onReload: () => void }) {
  const dialog = useConfirmDialog();
  const [supplierSearch, setSupplierSearch] = useState("");
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter((s) => [s.name, s.cif, s.contact_person, s.phone].some((v) => v?.toLowerCase().includes(q)));
  }, [suppliers, supplierSearch]);
  const { paged: pagedSuppliers, page: suppliersPage, totalPages: suppliersTotalPages, setPage: setSuppliersPage } = usePagination(filteredSuppliers);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCif, setNewCif] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.createSupplier(companyId, {
        name: newName.trim(),
        cif: newCif.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        contact_person: newContactPerson.trim(),
        notes: newNotes.trim(),
      });
      setNewName(""); setNewCif(""); setNewPhone(""); setNewEmail(""); setNewContactPerson(""); setNewNotes("");
      setShowAdd(false);
      onReload();
      showToast("Proveedor creado");
    } catch (err) {
      showToast(translateError(err), "error");
    } finally {
      setAdding(false);
    }
  }

  function handleDelete(id: number, name: string) {
    dialog.requestConfirm("Eliminar proveedor", `¿Eliminar proveedor "${name}"? Esta acción no se puede deshacer.`, async () => {
      try {
        await api.deleteSupplier(id);
        onReload();
        showToast("Proveedor eliminado");
      } catch (err) { showToast(translateError(err), "error"); }
    });
  }

  return (
    <>
      <ConfirmDialog {...dialog.confirmProps} />
      <header className="hero">
        <div>
          <p className="eyebrow">Proveedores</p>
          <h2>Directorio de proveedores</h2>
          <p className="muted">{suppliers.length} proveedor{suppliers.length !== 1 ? "es" : ""}</p>
        </div>
        <div className="hero-actions">
          {suppliers.length > 0 && (
            <button type="button" className="button secondary" onClick={() => exportToCSV(suppliers.map(s => ({ Nombre: s.name, CIF: s.cif, Teléfono: s.phone, Email: s.email, Contacto: s.contact_person, Notas: s.notes })), "proveedores")}>
              Exportar CSV
            </button>
          )}
          <button type="button" className="button primary" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "Cancelar" : "Nuevo proveedor"}
          </button>
        </div>
      </header>

      {suppliers.length > 0 && (
        <section className="panel filter-panel" style={{ marginBottom: "1rem" }}>
          <input value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} placeholder="Buscar proveedor..." aria-label="Buscar proveedores" style={{ width: "100%", maxWidth: 360 }} />
        </section>
      )}

      {showAdd && (
        <section className="panel" style={{ padding: "1.5rem", maxWidth: "400px", marginBottom: "1rem" }}>
          <p className="eyebrow" style={{ marginBottom: "1rem" }}>Nuevo proveedor</p>
          <form onSubmit={(e) => void handleAdd(e)} className="form-stack">
            <div>
              <label className="field-label required">Nombre proveedor</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Taller Perez" autoFocus required />
            </div>
            <div>
              <label className="field-label">CIF / NIF</label>
              <input value={newCif} onChange={(e) => setNewCif(e.target.value)} placeholder="B12345678" />
            </div>
            <div>
              <label className="field-label">Persona de contacto</label>
              <input value={newContactPerson} onChange={(e) => setNewContactPerson(e.target.value)} placeholder="Juan Garcia" />
            </div>
            <div className="form-grid-2">
              <div>
                <label className="field-label">Teléfono</label>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="612 345 678" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="info@taller.com" />
              </div>
            </div>
            <div>
              <label className="field-label">Notas</label>
              <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
            <button type="submit" className="button primary" disabled={adding || !newName.trim()}>
              {adding ? "Guardando..." : "Guardar proveedor"}
            </button>
          </form>
        </section>
      )}

      {suppliers.length === 0 ? (
        <EmptyState icon="🏢" title="Sin proveedores" description="Pulsa «Nuevo proveedor» para añadir tu primer taller, gestoría o proveedor." />
      ) : filteredSuppliers.length === 0 ? (
        <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
          <p className="muted">No hay proveedores que coincidan con la búsqueda.</p>
          <button type="button" className="button secondary" style={{ marginTop: "0.5rem" }} onClick={() => setSupplierSearch("")}>Limpiar búsqueda</button>
        </div>
      ) : (
        <>
          <PaginationControls page={suppliersPage} totalPages={suppliersTotalPages} setPage={setSuppliersPage} />
          <section className="panel sales-records-panel">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead><tr>
                  <th className="sales-th">Proveedor</th>
                  <th className="sales-th">CIF</th>
                  <th className="sales-th">Contacto</th>
                  <th className="sales-th">Teléfono</th>
                  <th className="sales-th" aria-label="Acciones"></th>
                </tr></thead>
                <tbody>
                  {pagedSuppliers.map((s) => (
                    <tr key={s.id} className="sales-row">
                      <td className="sales-td"><span className="sales-vehicle-name">{s.name}</span></td>
                      <td className="sales-td">{s.cif || "-"}</td>
                      <td className="sales-td">{s.contact_person || "-"}</td>
                      <td className="sales-td">{s.phone || "-"}</td>
                      <td className="sales-td">
                        <button type="button" className="button danger xs" aria-label={`Eliminar proveedor ${s.name}`} onClick={() => void handleDelete(s.id, s.name)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
