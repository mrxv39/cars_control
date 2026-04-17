import * as api from "../../lib/api";

export function WebDashboard({ vehicles, allVehicles, leads, salesRecords, purchaseRecords, onReload, onNavigate }: {
  vehicles: api.Vehicle[];
  allVehicles: api.Vehicle[];
  leads: api.Lead[];
  salesRecords: api.SalesRecord[];
  purchaseRecords: api.PurchaseRecord[];
  onReload: () => void;
  onNavigate: (view: string) => void;
}) {
  const stockDisponible = vehicles.filter((v) => v.estado !== "reservado" && v.estado !== "vendido").length;
  const stockReservado = vehicles.filter((v) => v.estado === "reservado").length;
  const stockVendido = allVehicles.filter((v) => v.estado === "vendido").length;

  const leadsNuevos = leads.filter((l) => l.estado === "nuevo" || !l.estado).length;
  const leadsContactados = leads.filter((l) => l.estado === "contactado").length;
  const leadsNegociando = leads.filter((l) => l.estado === "negociando").length;
  const leadsCerrados = leads.filter((l) => l.estado === "cerrado").length;
  const leadsPerdidos = leads.filter((l) => l.estado === "perdido").length;

  const beneficioTotal = vehicles.reduce((sum, v) => {
    if (v.precio_compra && v.precio_venta) return sum + (v.precio_venta - v.precio_compra);
    return sum;
  }, 0);

  const now = new Date();
  const mesActual = now.getMonth();
  const anioActual = now.getFullYear();
  const ventasMes = salesRecords.filter((s) => {
    const d = new Date(s.date);
    return d.getMonth() === mesActual && d.getFullYear() === anioActual;
  });
  const totalFacturadoMes = ventasMes.reduce((sum, s) => sum + (s.price_final || 0), 0);

  const hace7Dias = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const estadosFinales = ["cerrado", "perdido", "vendido", "descartado"];
  const leadsSinSeguimiento = leads.filter((l) => {
    if (estadosFinales.includes(l.estado || "")) return false;
    if (!l.fecha_contacto) return true;
    return new Date(l.fecha_contacto) < hace7Dias;
  });

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Resumen</p>
          <h2>Estado del negocio</h2>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={onReload}>Recargar</button>
        </div>
      </header>

      <div className="sales-stats-grid">
        <section className="panel sales-stat-card clickable" onClick={() => onNavigate("stock")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          <p className="sales-stat-label">Stock disponible</p>
          <p className="sales-stat-value sales-stat-primary">{stockDisponible}</p>
        </section>
        <section className="panel sales-stat-card clickable" onClick={() => onNavigate("stock")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          <p className="sales-stat-label">Reservados</p>
          <p className="sales-stat-value">{stockReservado}</p>
        </section>
        <section className="panel sales-stat-card clickable" onClick={() => onNavigate("stock")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          <p className="sales-stat-label">Vendidos</p>
          <p className="sales-stat-value sales-stat-success">{stockVendido}</p>
        </section>
        <section className="panel sales-stat-card">
          <p className="sales-stat-label">Margen potencial</p>
          <p className="sales-stat-value sales-stat-success">{beneficioTotal.toLocaleString("es-ES")} &euro;</p>
        </section>
      </div>

      <div className="sales-stats-grid">
        <section className="panel sales-stat-card clickable" onClick={() => onNavigate("leads")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          <p className="sales-stat-label">Leads nuevos</p>
          <p className="sales-stat-value">{leadsNuevos}</p>
        </section>
        <section className="panel sales-stat-card clickable" onClick={() => onNavigate("leads")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          <p className="sales-stat-label">Contactados</p>
          <p className="sales-stat-value">{leadsContactados}</p>
        </section>
        <section className="panel sales-stat-card clickable" onClick={() => onNavigate("leads")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          <p className="sales-stat-label">Negociando</p>
          <p className="sales-stat-value">{leadsNegociando}</p>
        </section>
        <section className="panel sales-stat-card clickable" onClick={() => onNavigate("leads")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          <p className="sales-stat-label">Cerrados / Perdidos</p>
          <p className="sales-stat-value">{leadsCerrados} / {leadsPerdidos}</p>
        </section>
      </div>

      <div className="sales-stats-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <section className="panel sales-stat-card clickable" onClick={() => onNavigate("sales")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
          <p className="sales-stat-label">Ventas este mes</p>
          <p className="sales-stat-value sales-stat-primary">{ventasMes.length}</p>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Total facturado: {totalFacturadoMes.toLocaleString("es-ES")} &euro;
          </p>
        </section>
        <section className="panel sales-stat-card" style={leadsSinSeguimiento.length > 0 ? { borderLeft: "3px solid var(--color-danger, #dc2626)" } : undefined}>
          <p className="sales-stat-label">Leads sin contactar +7 días</p>
          <p className="sales-stat-value" style={leadsSinSeguimiento.length > 0 ? { color: "var(--color-danger, #dc2626)" } : undefined}>
            {leadsSinSeguimiento.length}
          </p>
          {leadsSinSeguimiento.length > 0 && (
            <button type="button" className="button danger" style={{ marginTop: "0.5rem", fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={() => onNavigate("leads")}>
              Ver leads pendientes
            </button>
          )}
        </section>
      </div>

      {/* Margin Report - Sold vehicles */}
      {(() => {
        const soldVehicles = allVehicles.filter((v) => v.estado === "vendido" && v.precio_compra && v.precio_venta);
        if (soldVehicles.length === 0) return null;

        const purchasesByVehicle = new Map<number, number>();
        for (const p of purchaseRecords) {
          if (p.vehicle_id) {
            purchasesByVehicle.set(p.vehicle_id, (purchasesByVehicle.get(p.vehicle_id) || 0) + p.purchase_price);
          }
        }

        const margins = soldVehicles.map((v) => {
          const gastos = purchasesByVehicle.get(v.id) || 0;
          const margen = (v.precio_venta || 0) - (v.precio_compra || 0) - gastos;
          return { vehicle: v, margen, gastos };
        }).sort((a, b) => b.margen - a.margen);

        const margenTotal = margins.reduce((s, m) => s + m.margen, 0);
        const margenMedio = margins.length > 0 ? Math.round(margenTotal / margins.length) : 0;

        return (
          <section className="panel" style={{ padding: "1.25rem" }}>
            <p className="eyebrow">Informe de margen</p>
            <h3 style={{ margin: "0.3rem 0 0.75rem" }}>Margen por vehículo vendido</h3>
            <div className="sales-stats-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: "1rem" }}>
              <div className="panel sales-stat-card">
                <p className="sales-stat-label">Margen total</p>
                <p className="sales-stat-value sales-stat-success">{margenTotal.toLocaleString("es-ES")} &euro;</p>
              </div>
              <div className="panel sales-stat-card">
                <p className="sales-stat-label">Margen medio</p>
                <p className="sales-stat-value">{margenMedio.toLocaleString("es-ES")} &euro;</p>
              </div>
            </div>
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead><tr>
                  <th className="sales-th">Vehículo</th>
                  <th className="sales-th sales-th-right">P. Compra</th>
                  <th className="sales-th sales-th-right">P. Venta</th>
                  <th className="sales-th sales-th-right">Gastos</th>
                  <th className="sales-th sales-th-right">Margen</th>
                </tr></thead>
                <tbody>
                  {margins.slice(0, 10).map((m) => (
                    <tr key={m.vehicle.id} className="sales-row">
                      <td className="sales-td"><span className="sales-vehicle-name">{m.vehicle.name}</span></td>
                      <td className="sales-td sales-td-right">{(m.vehicle.precio_compra || 0).toLocaleString("es-ES")} &euro;</td>
                      <td className="sales-td sales-td-right">{(m.vehicle.precio_venta || 0).toLocaleString("es-ES")} &euro;</td>
                      <td className="sales-td sales-td-right">{m.gastos.toLocaleString("es-ES")} &euro;</td>
                      <td className="sales-td sales-td-right" style={{ fontWeight: 700, color: m.margen >= 0 ? "var(--color-success-dark, #166534)" : "var(--color-danger-dark, #991b1b)" }}>
                        {m.margen >= 0 ? "+" : ""}{m.margen.toLocaleString("es-ES")} &euro;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {margins.length > 10 && (
              <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", textAlign: "center" }}>
                Mostrando 10 de {margins.length} vehículos vendidos
              </p>
            )}
          </section>
        );
      })()}

      {/* Monthly Sales vs Expenses Report */}
      {(() => {
        const months: { key: string; label: string; ventas: number; gastos: number; nVentas: number }[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(anioActual, mesActual - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
          const ventasMes = salesRecords.filter((s) => s.date.startsWith(key));
          const gastosMes = purchaseRecords.filter((p) => p.purchase_date.startsWith(key));
          months.push({
            key,
            label,
            ventas: ventasMes.reduce((s, r) => s + r.price_final, 0),
            gastos: gastosMes.reduce((s, r) => s + r.purchase_price, 0),
            nVentas: ventasMes.length,
          });
        }

        const maxValue = Math.max(...months.map((m) => Math.max(m.ventas, m.gastos)), 1);
        const hasData = months.some((m) => m.ventas > 0 || m.gastos > 0);
        if (!hasData) return null;

        return (
          <section className="panel" style={{ padding: "1.25rem" }}>
            <p className="eyebrow">Evolución mensual</p>
            <h3 style={{ margin: "0.3rem 0 0.75rem" }}>Ventas vs Gastos (12 meses)</h3>
            <div style={{ display: "flex", gap: "0.25rem", alignItems: "flex-end", height: 180, marginBottom: "0.5rem" }}>
              {months.map((m) => (
                <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem", height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ display: "flex", gap: 1, alignItems: "flex-end", width: "100%", justifyContent: "center", flex: 1 }}>
                    <div style={{ width: "40%", background: "var(--color-success, #16a34a)", borderRadius: "3px 3px 0 0", height: `${Math.max((m.ventas / maxValue) * 100, m.ventas > 0 ? 4 : 0)}%`, minHeight: m.ventas > 0 ? 3 : 0 }} title={`Ventas: ${m.ventas.toLocaleString("es-ES")} €`} />
                    <div style={{ width: "40%", background: "repeating-linear-gradient(135deg, var(--color-danger, #dc2626), var(--color-danger, #dc2626) 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 5px)", borderRadius: "3px 3px 0 0", height: `${Math.max((m.gastos / maxValue) * 100, m.gastos > 0 ? 4 : 0)}%`, minHeight: m.gastos > 0 ? 3 : 0 }} title={`Gastos: ${m.gastos.toLocaleString("es-ES")} €`} />
                  </div>
                  <span style={{ fontSize: "0.6rem", color: "var(--color-text-muted, #64748b)", whiteSpace: "nowrap" }}>{m.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.78rem" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "var(--color-success, #16a34a)", marginRight: 4 }}></span>Ventas</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "repeating-linear-gradient(135deg, var(--color-danger, #dc2626), var(--color-danger, #dc2626) 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px)", marginRight: 4 }}></span>Gastos</span>
            </div>
            <div className="sales-table-scroll" style={{ marginTop: "1rem" }}>
              <table className="sales-table">
                <thead><tr>
                  <th className="sales-th">Mes</th>
                  <th className="sales-th sales-th-right">N. Ventas</th>
                  <th className="sales-th sales-th-right">Ingresos</th>
                  <th className="sales-th sales-th-right">Gastos</th>
                  <th className="sales-th sales-th-right">Balance</th>
                </tr></thead>
                <tbody>
                  {[...months].reverse().filter((m) => m.ventas > 0 || m.gastos > 0).map((m) => (
                    <tr key={m.key} className="sales-row">
                      <td className="sales-td"><span className="sales-vehicle-name">{m.label}</span></td>
                      <td className="sales-td sales-td-right">{m.nVentas}</td>
                      <td className="sales-td sales-td-right sales-price">{m.ventas.toLocaleString("es-ES")} &euro;</td>
                      <td className="sales-td sales-td-right">{m.gastos.toLocaleString("es-ES")} &euro;</td>
                      <td className="sales-td sales-td-right" style={{ fontWeight: 700, color: m.ventas - m.gastos >= 0 ? "var(--color-success-dark, #166534)" : "var(--color-danger-dark, #991b1b)" }}>
                        {(m.ventas - m.gastos).toLocaleString("es-ES")} &euro;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {allVehicles.length === 0 && leads.length === 0 && (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin datos</p>
          <h2>Dashboard vacío</h2>
          <p className="muted">Comienza por añadir vehículos al stock y registrar los primeros leads.</p>
        </section>
      )}
    </>
  );
}
