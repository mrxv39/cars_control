import { useState, useMemo } from "react";
import { PurchaseRecord } from "../types";

interface SupplierSummary {
  name: string;
  totalSpent: number;
  invoiceCount: number;
  types: string[];
  lastDate: string;
  plates: string[];
}

interface Props {
  records: PurchaseRecord[];
  onReload: () => void;
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    COMPRA_VEHICULO: "Compra vehiculo",
    TALLER: "Taller",
    GESTION_AUTO1: "Gestion AUTO1",
    TRANSPORTE: "Transporte",
    LIMPIEZA: "Limpieza",
    COMBUSTIBLE: "Combustible",
    PUBLICIDAD: "Publicidad",
    RECAMBIOS: "Recambios",
    NEUMATICOS: "Neumaticos",
    AUTONOMO: "Autonomo",
    SOFTWARE: "Software",
    BANCO: "Banco",
    SERVICIOS: "Servicios",
    OTRO: "Otro",
  };
  return map[type] || type;
}

export function SuppliersView({ records, onReload }: Props) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "total" | "count">("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const suppliers = useMemo(() => {
    const map = new Map<string, SupplierSummary>();
    for (const r of records) {
      const key = r.supplier_name || "Desconocido";
      const existing = map.get(key);
      if (existing) {
        existing.totalSpent += r.purchase_price;
        existing.invoiceCount += 1;
        if (!existing.types.includes(r.expense_type)) existing.types.push(r.expense_type);
        if (r.purchase_date > existing.lastDate) existing.lastDate = r.purchase_date;
        if (r.plate && !existing.plates.includes(r.plate)) existing.plates.push(r.plate);
      } else {
        map.set(key, {
          name: key,
          totalSpent: r.purchase_price,
          invoiceCount: 1,
          types: [r.expense_type],
          lastDate: r.purchase_date,
          plates: r.plate ? [r.plate] : [],
        });
      }
    }
    return Array.from(map.values());
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = suppliers;
    if (q) {
      list = suppliers.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.types.some((t) => typeLabel(t).toLowerCase().includes(q)) ||
        s.plates.some((p) => p.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "total") cmp = a.totalSpent - b.totalSpent;
      else cmp = a.invoiceCount - b.invoiceCount;
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [suppliers, search, sortBy, sortDir]);

  const selectedRecords = useMemo(() => {
    if (!selectedSupplier) return [];
    return records
      .filter((r) => (r.supplier_name || "Desconocido") === selectedSupplier)
      .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
  }, [records, selectedSupplier]);

  const totalProveedores = suppliers.length;
  const totalGastado = suppliers.reduce((sum, s) => sum + s.totalSpent, 0);
  const topSupplier = suppliers.length > 0 ? [...suppliers].sort((a, b) => b.totalSpent - a.totalSpent)[0] : null;

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  function sortIcon(col: typeof sortBy) {
    if (sortBy !== col) return "";
    return sortDir === "desc" ? " \u25BC" : " \u25B2";
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Proveedores</p>
          <h2>{selectedSupplier ? selectedSupplier : "Directorio de proveedores"}</h2>
          <p className="muted">
            {selectedSupplier
              ? `${selectedRecords.length} factura${selectedRecords.length !== 1 ? "s" : ""}`
              : `${totalProveedores} proveedor${totalProveedores !== 1 ? "es" : ""} registrado${totalProveedores !== 1 ? "s" : ""}`
            }
          </p>
        </div>
        <div className="hero-actions">
          {selectedSupplier && (
            <button type="button" className="button secondary" onClick={() => setSelectedSupplier(null)}>
              Volver a proveedores
            </button>
          )}
          <button type="button" className="button primary" onClick={onReload}>
            Recargar
          </button>
        </div>
      </header>

      {!selectedSupplier && suppliers.length > 0 && (
        <section className="sales-stats-grid">
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Total proveedores</span>
            <span className="sales-stat-value sales-stat-primary">{totalProveedores}</span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Total gastado</span>
            <span className="sales-stat-value">
              {totalGastado.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Mayor proveedor</span>
            <span className="sales-stat-value sales-stat-success">{topSupplier?.name || "-"}</span>
          </div>
          <div className="panel sales-stat-card">
            <span className="sales-stat-label">Total facturas</span>
            <span className="sales-stat-value">{records.length}</span>
          </div>
        </section>
      )}

      {/* Supplier list view */}
      {!selectedSupplier && suppliers.length > 0 && (
        <section className="panel sales-records-panel">
          <div className="sales-toolbar">
            <input
              type="text" className="sales-search"
              placeholder="Buscar proveedor, tipo o matricula..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <span className="muted" style={{ whiteSpace: "nowrap" }}>
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th className="sales-th sortable" onClick={() => toggleSort("name")}>Proveedor{sortIcon("name")}</th>
                  <th className="sales-th">Tipos</th>
                  <th className="sales-th sortable sales-th-right" onClick={() => toggleSort("count")}>Facturas{sortIcon("count")}</th>
                  <th className="sales-th sortable sales-th-right" onClick={() => toggleSort("total")}>Total gastado{sortIcon("total")}</th>
                  <th className="sales-th">Ultima factura</th>
                  <th className="sales-th sales-th-center">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((supplier) => (
                  <tr key={supplier.name} className="sales-row">
                    <td className="sales-td">
                      <span className="sales-vehicle-name">{supplier.name}</span>
                      {supplier.plates.length > 0 && (
                        <span className="sales-vehicle-path">{supplier.plates.slice(0, 3).join(", ")}{supplier.plates.length > 3 ? ` +${supplier.plates.length - 3}` : ""}</span>
                      )}
                    </td>
                    <td className="sales-td">
                      {supplier.types.map((t) => (
                        <span key={t} className="badge" style={{ marginRight: 4, marginBottom: 2 }}>{typeLabel(t)}</span>
                      ))}
                    </td>
                    <td className="sales-td sales-td-right">{supplier.invoiceCount}</td>
                    <td className="sales-td sales-td-right">
                      <span className="sales-price">
                        {supplier.totalSpent.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="sales-td">
                      <span className="sales-date">
                        {(() => {
                          try { return new Date(supplier.lastDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
                          catch { return supplier.lastDate; }
                        })()}
                      </span>
                    </td>
                    <td className="sales-td sales-td-center">
                      <button
                        type="button" className="button primary sales-delete-btn"
                        onClick={() => setSelectedSupplier(supplier.name)}
                      >Ver</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="sales-td sales-empty-row" colSpan={6}>Sin resultados para "{search}"</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Detail view for selected supplier */}
      {selectedSupplier && selectedRecords.length > 0 && (
        <>
          <section className="sales-stats-grid">
            <div className="panel sales-stat-card">
              <span className="sales-stat-label">Total gastado</span>
              <span className="sales-stat-value sales-stat-primary">
                {selectedRecords.reduce((s, r) => s + r.purchase_price, 0).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="panel sales-stat-card">
              <span className="sales-stat-label">Facturas</span>
              <span className="sales-stat-value">{selectedRecords.length}</span>
            </div>
            <div className="panel sales-stat-card">
              <span className="sales-stat-label">Vehiculos</span>
              <span className="sales-stat-value">
                {new Set(selectedRecords.filter((r) => r.plate).map((r) => r.plate)).size}
              </span>
            </div>
            <div className="panel sales-stat-card">
              <span className="sales-stat-label">Tipos</span>
              <span className="sales-stat-value">
                {new Set(selectedRecords.map((r) => r.expense_type)).size}
              </span>
            </div>
          </section>

          <section className="panel sales-records-panel">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th className="sales-th">Tipo</th>
                    <th className="sales-th">Vehiculo</th>
                    <th className="sales-th">Fecha</th>
                    <th className="sales-th sales-th-right">Importe</th>
                    <th className="sales-th">Factura</th>
                    <th className="sales-th">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecords.map((r) => (
                    <tr key={r.id} className="sales-row">
                      <td className="sales-td"><span className="badge">{typeLabel(r.expense_type)}</span></td>
                      <td className="sales-td">
                        {r.vehicle_name || r.plate ? (
                          <>
                            <span className="sales-vehicle-name">{r.vehicle_name || "-"}</span>
                            {r.plate && <span className="sales-vehicle-path">{r.plate}</span>}
                          </>
                        ) : "-"}
                      </td>
                      <td className="sales-td">
                        <span className="sales-date">
                          {(() => {
                            try { return new Date(r.purchase_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); }
                            catch { return r.purchase_date; }
                          })()}
                        </span>
                      </td>
                      <td className="sales-td sales-td-right">
                        <span className="sales-price">
                          {r.purchase_price.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="sales-td"><span className="badge badge-info">{r.invoice_number || "-"}</span></td>
                      <td className="sales-td"><span className="sales-notes">{r.notes || "-"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Empty state */}
      {!selectedSupplier && suppliers.length === 0 && (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin proveedores</p>
          <h2>No hay proveedores registrados</h2>
          <p className="muted">Los proveedores se crean automaticamente a partir de las facturas de compra y gastos.</p>
          <div className="actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="button secondary" onClick={onReload}>Recargar</button>
          </div>
        </section>
      )}
    </>
  );
}
