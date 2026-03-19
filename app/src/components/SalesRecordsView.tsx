import { useState, useMemo } from "react";
import { SalesRecord, StockVehicle, Client } from "../types";
import { generateSalesReportPDF } from "../utils/reportGenerator";

interface Props {
  records: SalesRecord[];
  stock: StockVehicle[];
  clients: Client[];
  onReload: () => void;
  onAddRecord: (vehicleFolderPath: string, clientId: number | null, priceFinal: number, notes: string) => Promise<void>;
  onDeleteRecord: (id: number) => void;
  submitting: boolean;
}

export function SalesRecordsView({ records, stock, clients, onReload, onAddRecord, onDeleteRecord, submitting }: Props) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "vehicle">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showForm, setShowForm] = useState(false);
  const [formVehicle, setFormVehicle] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const vehicleMap = new Map(stock.map((v) => [v.folder_path, v]));

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = records;
    if (q) {
      list = records.filter((r) => {
        const vehicle = vehicleMap.get(r.vehicle_folder_path);
        const name = (vehicle?.name || "").toLowerCase();
        const notes = (r.notes || "").toLowerCase();
        const date = r.date.toLowerCase();
        return name.includes(q) || notes.includes(q) || date.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = a.date.localeCompare(b.date);
      else if (sortBy === "price") cmp = a.price_final - b.price_final;
      else {
        const na = vehicleMap.get(a.vehicle_folder_path)?.name || "";
        const nb = vehicleMap.get(b.vehicle_folder_path)?.name || "";
        cmp = na.localeCompare(nb);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [records, search, sortBy, sortDir, vehicleMap]);

  const totalBeneficio = records.reduce((sum, r) => sum + r.price_final, 0);
  const promedioBeneficio = records.length > 0 ? totalBeneficio / records.length : 0;
  const mejorVenta = records.length > 0 ? Math.max(...records.map((r) => r.price_final)) : 0;

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  function sortIcon(col: typeof sortBy) {
    if (sortBy !== col) return "";
    return sortDir === "desc" ? " \u25BC" : " \u25B2";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!formVehicle) { setFormError("Selecciona un vehiculo"); return; }
    const price = parseFloat(formPrice);
    if (isNaN(price) || price <= 0) { setFormError("Introduce un precio valido"); return; }
    setSaving(true);
    try {
      await onAddRecord(formVehicle, formClient ? parseInt(formClient) : null, price, formNotes);
      setFormVehicle("");
      setFormClient("");
      setFormPrice("");
      setFormNotes("");
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
          <p className="eyebrow">Registro de Ventas</p>
          <h2>Historial de operaciones</h2>
          <p className="muted">
            {records.length} venta{records.length !== 1 ? "s" : ""} registrada{records.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="hero-actions">
          {records.length > 0 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => generateSalesReportPDF(records, stock, "Reporte de Ventas")}
            >
              Descargar PDF
            </button>
          )}
          <button type="button" className="button primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "Nueva Venta"}
          </button>
        </div>
      </header>

      {/* New Sale Form */}
      {showForm && (
        <section className="panel sales-form-panel">
          <p className="eyebrow">Nueva venta</p>
          <form onSubmit={(e) => void handleSubmit(e)} className="sales-form">
            <div className="sales-form-grid">
              <div className="sales-form-field">
                <label className="field-label">Vehiculo *</label>
                <select value={formVehicle} onChange={(e) => setFormVehicle(e.target.value)}>
                  <option value="">Seleccionar vehiculo...</option>
                  {stock.map((v) => (
                    <option key={v.folder_path} value={v.folder_path}>
                      {v.name} {v.precio_venta ? `(${v.precio_venta.toLocaleString("es-ES")} EUR)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sales-form-field">
                <label className="field-label">Cliente (opcional)</label>
                <select value={formClient} onChange={(e) => setFormClient(e.target.value)}>
                  <option value="">Sin cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.dni ? `(${c.dni})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sales-form-field">
                <label className="field-label">Precio final (EUR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="12500.00"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                />
              </div>
              <div className="sales-form-field">
                <label className="field-label">Notas</label>
                <input
                  type="text"
                  placeholder="Notas opcionales..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className="error-banner">{formError}</p>}
            <div className="sales-form-actions">
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? "Guardando..." : "Registrar venta"}
              </button>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Stats */}
      {records.length > 0 && (
        <section className="sales-stats-grid">
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Total facturado</span>
            <span className="sales-stat-value sales-stat-primary">
              {totalBeneficio.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Promedio por venta</span>
            <span className="sales-stat-value">
              {promedioBeneficio.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Mejor venta</span>
            <span className="sales-stat-value sales-stat-success">
              {mejorVenta.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Total operaciones</span>
            <span className="sales-stat-value">{records.length}</span>
          </div>
        </section>
      )}

      {/* Table */}
      {records.length > 0 ? (
        <section className="panel sales-records-panel">
          <div className="sales-toolbar">
            <input
              type="text"
              className="sales-search"
              placeholder="Buscar por vehiculo, notas o fecha..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="muted" style={{ whiteSpace: "nowrap" }}>
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th className="sales-th sortable" onClick={() => toggleSort("vehicle")}>
                    Vehiculo{sortIcon("vehicle")}
                  </th>
                  <th className="sales-th sortable" onClick={() => toggleSort("date")}>
                    Fecha{sortIcon("date")}
                  </th>
                  <th className="sales-th sales-th-right sortable" onClick={() => toggleSort("price")}>
                    Precio final{sortIcon("price")}
                  </th>
                  <th className="sales-th">Notas</th>
                  <th className="sales-th sales-th-center">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => {
                  const vehicle = vehicleMap.get(record.vehicle_folder_path);
                  return (
                    <tr key={record.id} className="sales-row">
                      <td className="sales-td">
                        <span className="sales-vehicle-name">{vehicle?.name || "Desconocido"}</span>
                        <span className="sales-vehicle-path">{record.vehicle_folder_path.split(/[/\\]/).pop()}</span>
                      </td>
                      <td className="sales-td">
                        <span className="sales-date">
                          {new Date(record.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </td>
                      <td className="sales-td sales-td-right">
                        <span className="sales-price">
                          {record.price_final.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="sales-td">
                        <span className="sales-notes">{record.notes || "-"}</span>
                      </td>
                      <td className="sales-td sales-td-center">
                        <button
                          type="button"
                          className="button danger sales-delete-btn"
                          onClick={() => onDeleteRecord(record.id)}
                          disabled={submitting}
                          title="Eliminar registro"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td className="sales-td sales-empty-row" colSpan={5}>
                      Sin resultados para "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : !showForm ? (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin registros</p>
          <h2>No hay ventas registradas</h2>
          <p className="muted">
            Pulsa "Nueva Venta" para registrar tu primera operacion.
          </p>
          <div className="actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="button primary" onClick={() => setShowForm(true)}>
              Nueva Venta
            </button>
            <button type="button" className="button secondary" onClick={onReload}>
              Recargar
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
