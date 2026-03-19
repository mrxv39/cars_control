import { useState, useMemo } from "react";
import { PurchaseRecord, StockVehicle } from "../types";

interface Props {
  records: PurchaseRecord[];
  stock: StockVehicle[];
  onReload: () => void;
  onAddRecord: (
    expenseType: string,
    vehicleFolderPath: string,
    vehicleName: string,
    plate: string,
    supplierName: string,
    purchaseDate: string,
    purchasePrice: number,
    invoiceNumber: string,
    paymentMethod: string,
    notes: string,
    sourceFile: string,
  ) => Promise<void>;
  onDeleteRecord: (id: number) => void;
  submitting: boolean;
}

const EXPENSE_TYPES = [
  { value: "COMPRA_VEHICULO", label: "Compra vehiculo" },
  { value: "TALLER", label: "Taller" },
  { value: "GESTION_AUTO1", label: "Gestion AUTO1" },
  { value: "TRANSPORTE", label: "Transporte" },
  { value: "LIMPIEZA", label: "Limpieza" },
  { value: "COMBUSTIBLE", label: "Combustible" },
  { value: "PUBLICIDAD", label: "Publicidad" },
  { value: "RECAMBIOS", label: "Recambios" },
  { value: "NEUMATICOS", label: "Neumaticos" },
  { value: "AUTONOMO", label: "Autonomo" },
  { value: "SOFTWARE", label: "Software" },
  { value: "BANCO", label: "Banco" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "OTRO", label: "Otro" },
];

function typeBadgeClass(type: string) {
  switch (type) {
    case "COMPRA_VEHICULO": return "badge badge-success";
    case "TALLER": return "badge badge-warning";
    case "GESTION_AUTO1": return "badge badge-info";
    case "TRANSPORTE": return "badge badge-info";
    default: return "badge";
  }
}

function typeLabel(type: string) {
  return EXPENSE_TYPES.find((t) => t.value === type)?.label || type;
}

export function PurchasesView({ records, stock, onReload, onAddRecord, onDeleteRecord, submitting }: Props) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "supplier" | "type">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("COMPRA_VEHICULO");
  const [formVehicle, setFormVehicle] = useState("");
  const [formVehicleName, setFormVehicleName] = useState("");
  const [formPlate, setFormPlate] = useState("");
  const [formSupplier, setFormSupplier] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formInvoice, setFormInvoice] = useState("");
  const [formPayment, setFormPayment] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = records;
    if (filterType) {
      list = list.filter((r) => r.expense_type === filterType);
    }
    if (q) {
      list = list.filter((r) => {
        const fields = [
          r.vehicle_name, r.plate, r.supplier_name, r.invoice_number,
          r.notes, r.purchase_date, r.expense_type,
        ];
        return fields.some((f) => (f || "").toLowerCase().includes(q));
      });
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = a.purchase_date.localeCompare(b.purchase_date);
      else if (sortBy === "price") cmp = a.purchase_price - b.purchase_price;
      else if (sortBy === "supplier") cmp = a.supplier_name.localeCompare(b.supplier_name);
      else if (sortBy === "type") cmp = a.expense_type.localeCompare(b.expense_type);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [records, search, filterType, sortBy, sortDir]);

  const totalGastado = records.reduce((sum, r) => sum + r.purchase_price, 0);
  const totalComprasVehiculos = records.filter((r) => r.expense_type === "COMPRA_VEHICULO").reduce((sum, r) => sum + r.purchase_price, 0);
  const totalOtrosGastos = totalGastado - totalComprasVehiculos;
  const numCompras = records.filter((r) => r.expense_type === "COMPRA_VEHICULO").length;

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  function sortIcon(col: typeof sortBy) {
    if (sortBy !== col) return "";
    return sortDir === "desc" ? " \u25BC" : " \u25B2";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!formSupplier.trim()) { setFormError("Introduce el nombre del proveedor"); return; }
    if (!formDate) { setFormError("Selecciona la fecha"); return; }
    const price = parseFloat(formPrice);
    if (isNaN(price) || price <= 0) { setFormError("Introduce un importe valido"); return; }
    if (!formInvoice.trim()) { setFormError("El numero de factura es obligatorio"); return; }
    setSaving(true);
    try {
      await onAddRecord(
        formType, formVehicle, formVehicleName.trim(), formPlate.trim(),
        formSupplier.trim(), formDate, price, formInvoice.trim(),
        formPayment.trim(), formNotes.trim(), "",
      );
      setFormType("COMPRA_VEHICULO");
      setFormVehicle(""); setFormVehicleName(""); setFormPlate("");
      setFormSupplier(""); setFormDate(""); setFormPrice("");
      setFormInvoice(""); setFormPayment(""); setFormNotes("");
      setShowForm(false);
    } catch (err) {
      setFormError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Compras y Gastos</p>
          <h2>Registro de compras y gastos</h2>
          <p className="muted">
            {records.length} registro{records.length !== 1 ? "s" : ""} ({numCompras} compras de vehiculos)
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "Nuevo Gasto"}
          </button>
        </div>
      </header>

      {showForm && (
        <section className="panel sales-form-panel">
          <p className="eyebrow">Nuevo gasto</p>
          <form onSubmit={(e) => void handleSubmit(e)} className="sales-form">
            <div className="sales-form-grid">
              <div className="sales-form-field">
                <label className="field-label">Tipo *</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {EXPENSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="sales-form-field">
                <label className="field-label">Proveedor *</label>
                <input type="text" placeholder="Nombre del proveedor..." value={formSupplier} onChange={(e) => setFormSupplier(e.target.value)} />
              </div>
              <div className="sales-form-field">
                <label className="field-label">Fecha *</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="sales-form-field">
                <label className="field-label">Importe (EUR) *</label>
                <input type="number" step="0.01" min="0" placeholder="8500.00" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div className="sales-form-field">
                <label className="field-label">N. Factura *</label>
                <input type="text" placeholder="FAC-2025-001" value={formInvoice} onChange={(e) => setFormInvoice(e.target.value)} />
              </div>
              <div className="sales-form-field">
                <label className="field-label">Vehiculo (stock)</label>
                <select value={formVehicle} onChange={(e) => setFormVehicle(e.target.value)}>
                  <option value="">Sin vehiculo</option>
                  {stock.map((v) => (
                    <option key={v.folder_path} value={v.folder_path}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="sales-form-field">
                <label className="field-label">Nombre vehiculo</label>
                <input type="text" placeholder="Dacia Sandero..." value={formVehicleName} onChange={(e) => setFormVehicleName(e.target.value)} />
              </div>
              <div className="sales-form-field">
                <label className="field-label">Matricula</label>
                <input type="text" placeholder="1234ABC" value={formPlate} onChange={(e) => setFormPlate(e.target.value)} />
              </div>
              <div className="sales-form-field">
                <label className="field-label">Forma de pago</label>
                <input type="text" placeholder="Transferencia..." value={formPayment} onChange={(e) => setFormPayment(e.target.value)} />
              </div>
              <div className="sales-form-field" style={{ gridColumn: "1 / -1" }}>
                <label className="field-label">Notas</label>
                <input type="text" placeholder="Notas opcionales..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
              </div>
            </div>
            {formError && <p className="error-banner">{formError}</p>}
            <div className="sales-form-actions">
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? "Guardando..." : "Registrar gasto"}
              </button>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

      {records.length > 0 && (
        <section className="sales-stats-grid">
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Total gastado</span>
            <span className="sales-stat-value sales-stat-primary">
              {totalGastado.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Compras vehiculos</span>
            <span className="sales-stat-value">
              {totalComprasVehiculos.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Otros gastos</span>
            <span className="sales-stat-value">
              {totalOtrosGastos.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Total registros</span>
            <span className="sales-stat-value">{records.length}</span>
          </div>
        </section>
      )}

      {records.length > 0 ? (
        <section className="panel sales-records-panel">
          <div className="sales-toolbar">
            <input
              type="text" className="sales-search"
              placeholder="Buscar por vehiculo, proveedor, factura..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ minWidth: "140px" }}>
              <option value="">Todos los tipos</option>
              {EXPENSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <span className="muted" style={{ whiteSpace: "nowrap" }}>
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th className="sales-th sortable" onClick={() => toggleSort("type")}>Tipo{sortIcon("type")}</th>
                  <th className="sales-th">Vehiculo</th>
                  <th className="sales-th sortable" onClick={() => toggleSort("supplier")}>Proveedor{sortIcon("supplier")}</th>
                  <th className="sales-th sortable" onClick={() => toggleSort("date")}>Fecha{sortIcon("date")}</th>
                  <th className="sales-th sales-th-right sortable" onClick={() => toggleSort("price")}>Importe{sortIcon("price")}</th>
                  <th className="sales-th">Factura</th>
                  <th className="sales-th">Notas</th>
                  <th className="sales-th sales-th-center">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="sales-row">
                    <td className="sales-td">
                      <span className={typeBadgeClass(record.expense_type)}>{typeLabel(record.expense_type)}</span>
                    </td>
                    <td className="sales-td">
                      {record.vehicle_name || record.plate ? (
                        <>
                          <span className="sales-vehicle-name">{record.vehicle_name || "-"}</span>
                          {record.plate && <span className="sales-vehicle-path">{record.plate}</span>}
                        </>
                      ) : "-"}
                    </td>
                    <td className="sales-td">{record.supplier_name || "-"}</td>
                    <td className="sales-td">
                      <span className="sales-date">
                        {(() => {
                          try { return new Date(record.purchase_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
                          catch { return record.purchase_date; }
                        })()}
                      </span>
                    </td>
                    <td className="sales-td sales-td-right">
                      <span className="sales-price">
                        {record.purchase_price.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="sales-td">
                      <span className="badge badge-info">{record.invoice_number || "-"}</span>
                    </td>
                    <td className="sales-td">
                      <span className="sales-notes">{record.notes || "-"}</span>
                    </td>
                    <td className="sales-td sales-td-center">
                      <button
                        type="button" className="button danger sales-delete-btn"
                        onClick={() => onDeleteRecord(record.id)}
                        disabled={submitting} title="Eliminar registro"
                      >Eliminar</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="sales-td sales-empty-row" colSpan={8}>Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : !showForm ? (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin registros</p>
          <h2>No hay compras o gastos registrados</h2>
          <p className="muted">Pulsa "Nuevo Gasto" para registrar tu primer gasto con su factura asociada.</p>
          <div className="actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="button primary" onClick={() => setShowForm(true)}>Nuevo Gasto</button>
            <button type="button" className="button secondary" onClick={onReload}>Recargar</button>
          </div>
        </section>
      ) : null}
    </>
  );
}
