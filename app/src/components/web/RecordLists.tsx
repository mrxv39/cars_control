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
  const { paged: pagedClients, page: clientsPage, totalPages: clientsTotalPages, setPage: setClientsPage } = usePagination(clients);

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
      if (!window.confirm("Tienes cambios sin guardar. ¿Salir sin guardar?")) return;
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
            <button type="button" className="button secondary" onClick={() => exportToCSV(clients.map(c => ({ Nombre: c.name, Telefono: c.phone, Email: c.email, DNI: c.dni, Notas: c.notes })), "clientes")}>
              Exportar CSV
            </button>
          </div>
        )}
      </header>
      {clients.length === 0 && (
        <EmptyState icon="👤" title="Sin clientes registrados" description="Los clientes se crean al convertir un lead en cliente desde la vista de Leads." />
      )}
      <PaginationControls page={clientsPage} totalPages={clientsTotalPages} setPage={setClientsPage} />
      <section className="record-grid" aria-live="polite">
        {pagedClients.map((c) => (
          <article key={c.id} className="record-card panel">
            {editingId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nombre" className={!editForm.name.trim() && editingId ? "input-error" : ""} />
                {!editForm.name.trim() && editingId && <p className="input-error-message" role="alert">El nombre es obligatorio</p>}
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Telefono" />
                {clientPhoneDup && <p style={{ color: "#b45309", fontSize: "0.78rem", margin: "-0.25rem 0 0" }}>⚠ {clientPhoneDup}</p>}
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
                    <p className="muted">{c.phone || "Sin telefono"}</p>
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
            <button type="button" className="button secondary" onClick={() => exportToCSV(records.map(r => ({ Vehiculo: r.vehicle_id ? vehicleMap.get(r.vehicle_id)?.name || "" : "", Cliente: r.client_id ? clientMap.get(r.client_id)?.name || "" : "", Fecha: r.date, Precio: r.price_final, Notas: r.notes })), "ventas")}>
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
                      <td className="sales-td" style={{ display: "flex", gap: "0.4rem" }}>
                        <button type="button" className="button secondary xs" onClick={() => {
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
                        <button type="button" className="button danger xs" onClick={() => void handleDeleteSale(r.id, vName)}>Eliminar</button>
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
  const total = useMemo(() => records.reduce((s, r) => s + r.purchase_price, 0), [records]);
  const { paged: pagedPurchases, page: purchasesPage, totalPages: purchasesTotalPages, setPage: setPurchasesPage } = usePagination(records);
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
          <p className="muted">{records.length} registro{records.length !== 1 ? "s" : ""} · {total.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
        </div>
        {records.length > 0 && (
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={() => exportToCSV(records.map(r => ({ Tipo: r.expense_type, Vehiculo: r.vehicle_name, Matricula: r.plate, Proveedor: r.supplier_name, Fecha: r.purchase_date, Importe: r.purchase_price, Factura: r.invoice_number, Pago: r.payment_method, Notas: r.notes })), "compras")}>
              Exportar CSV
            </button>
          </div>
        )}
      </header>
      {records.length === 0 && (
        <EmptyState icon="🛒" title="Sin compras registradas" description="Registra compras de vehículos y gastos asociados (reparaciones, ITV, etc.)." />
      )}
      {records.length > 0 && (
        <section className="panel sales-records-panel">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead><tr>
                <th className="sales-th">Tipo</th>
                <th className="sales-th">Proveedor</th>
                <th className="sales-th">Fecha</th>
                <th className="sales-th sales-th-right">Importe</th>
                <th className="sales-th">Factura</th>
                <th className="sales-th" style={{ width: "5.5rem" }}>Banco</th>
                <th className="sales-th" style={{ width: "4rem" }}></th>
              </tr></thead>
              <tbody>
                {pagedPurchases.map((r) => (
                  <tr key={r.id} className="sales-row">
                    <td className="sales-td"><span className="badge">{r.expense_type}</span></td>
                    <td className="sales-td">{r.supplier_name}</td>
                    <td className="sales-td">{r.purchase_date}</td>
                    <td className="sales-td sales-td-right"><span className="sales-price">{r.purchase_price.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span></td>
                    <td className="sales-td"><span className="badge badge-info">{r.invoice_number || "—"}</span></td>
                    <td className="sales-td">
                      {bankLinked.has(r.id) ? (
                        <span className="badge badge-success" title="Vinculado a movimiento bancario" style={{ fontSize: "0.7rem" }}>✓ Banco</span>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.72rem" }}>—</span>
                      )}
                    </td>
                    <td className="sales-td"><button type="button" className="button danger xs" onClick={() => void handleDeletePurchase(r.id, r.supplier_name)}>Eliminar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls page={purchasesPage} totalPages={purchasesTotalPages} setPage={setPurchasesPage} />
        </section>
      )}
    </>
  );
}

// ============================================================
// Suppliers List
// ============================================================
export function SuppliersList({ suppliers, companyId, onReload }: { suppliers: api.Supplier[]; companyId: number; onReload: () => void }) {
  const dialog = useConfirmDialog();
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
            <button type="button" className="button secondary" onClick={() => exportToCSV(suppliers.map(s => ({ Nombre: s.name, CIF: s.cif, Telefono: s.phone, Email: s.email, Contacto: s.contact_person, Notas: s.notes })), "proveedores")}>
              Exportar CSV
            </button>
          )}
          <button type="button" className="button primary" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "Cancelar" : "Nuevo proveedor"}
          </button>
        </div>
      </header>

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

      <section className="panel sales-records-panel">
        <div className="sales-table-scroll">
          <table className="sales-table">
            <thead><tr>
              <th className="sales-th">Proveedor</th>
              <th className="sales-th">CIF</th>
              <th className="sales-th">Contacto</th>
              <th className="sales-th">Teléfono</th>
              <th className="sales-th"></th>
            </tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="sales-row">
                  <td className="sales-td"><span className="sales-vehicle-name">{s.name}</span></td>
                  <td className="sales-td">{s.cif || "-"}</td>
                  <td className="sales-td">{s.contact_person || "-"}</td>
                  <td className="sales-td">{s.phone || "-"}</td>
                  <td className="sales-td">
                    <button type="button" className="button danger xs" onClick={() => void handleDelete(s.id, s.name)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td className="sales-td" colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No hay proveedores. Pulsa "Nuevo proveedor" para añadir uno.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
