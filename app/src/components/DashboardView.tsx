import { StockVehicle, Lead } from "../types";

interface Props {
  stock: StockVehicle[];
  leads: Lead[];
  onReload: () => void;
}

export function DashboardView({ stock, leads, onReload }: Props) {
  // Stock stats
  const stockDisponible = stock.filter((v) => v.estado !== "reservado" && v.estado !== "vendido").length;
  const stockReservado = stock.filter((v) => v.estado === "reservado").length;
  const stockVendido = stock.filter((v) => v.estado === "vendido").length;

  // Lead stats
  const leadsNuevos = leads.filter((l) => l.estado === "nuevo" || !l.estado).length;
  const leadsActivos = leads.filter((l) => ["contactado", "negociando"].includes(l.estado || "")).length;
  const leadsCerrados = leads.filter((l) => l.estado === "cerrado").length;
  const leadsPerdidos = leads.filter((l) => l.estado === "perdido").length;

  // Leads sin seguimiento reciente (sin fecha_contacto o muy antigua)
  const hoy = new Date();
  const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
  const leadsSinSeguimiento = leads.filter((l) => {
    if (!l.fecha_contacto) return false;
    const fecha = new Date(l.fecha_contacto);
    return fecha < hace7Dias && !["cerrado", "perdido"].includes(l.estado || "");
  }).length;

  // Últimos 5 leads
  const ultimosLeads = leads
    .sort((a, b) => {
      const fechaA = a.fecha_contacto ? new Date(a.fecha_contacto).getTime() : 0;
      const fechaB = b.fecha_contacto ? new Date(b.fecha_contacto).getTime() : 0;
      return fechaB - fechaA;
    })
    .slice(0, 5);

  // Beneficio potencial
  const beneficioTotal = stock.reduce((sum, vehicle) => {
    if (vehicle.precio_compra && vehicle.precio_venta) {
      return sum + (vehicle.precio_venta - vehicle.precio_compra);
    }
    return sum;
  }, 0);

  const vehiculosConPrecio = stock.filter((v) => v.precio_compra && v.precio_venta).length;

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Estado del negocio</h2>
          <p className="muted">Resumen rápido de stock, leads y beneficio</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={onReload}>
            Recargar
          </button>
        </div>
      </header>

      {/* Stock Overview */}
      <section className="dashboard-grid">
        <section className="panel dashboard-card">
          <div className="dashboard-header">
            <p className="eyebrow">Stock</p>
            <h3>Vehículos en inventario</h3>
          </div>
          <div className="dashboard-stats">
            <div className="stat-item">
              <div className="stat-number">{stockDisponible}</div>
              <p className="stat-label">Disponibles</p>
            </div>
            <div className="stat-item">
              <div className="stat-number">{stockReservado}</div>
              <p className="stat-label">Reservados</p>
            </div>
            <div className="stat-item">
              <div className="stat-number">{stockVendido}</div>
              <p className="stat-label">Vendidos</p>
            </div>
            <div className="stat-item">
              <div className="stat-number">{stock.length}</div>
              <p className="stat-label">Total</p>
            </div>
          </div>
        </section>

        {/* Leads Overview */}
        <section className="panel dashboard-card">
          <div className="dashboard-header">
            <p className="eyebrow">Leads</p>
            <h3>Estado de contactos</h3>
          </div>
          <div className="dashboard-stats">
            <div className="stat-item">
              <div className="stat-number">{leadsNuevos}</div>
              <p className="stat-label">Nuevos</p>
            </div>
            <div className="stat-item">
              <div className="stat-number">{leadsActivos}</div>
              <p className="stat-label">En negociación</p>
            </div>
            <div className="stat-item">
              <div className="stat-number">{leadsCerrados}</div>
              <p className="stat-label">Cerrados</p>
            </div>
            <div className="stat-item">
              <div className="stat-number">{leadsPerdidos}</div>
              <p className="stat-label">Perdidos</p>
            </div>
          </div>
        </section>

        {/* Beneficio Potencial */}
        <section className="panel dashboard-card beneficio-card">
          <div className="dashboard-header">
            <p className="eyebrow">Financiero</p>
            <h3>Beneficio potencial</h3>
          </div>
          <div className="beneficio-content">
            <div className="beneficio-total">
              <p className="beneficio-label">Margen total (con precio)</p>
              <p className="beneficio-value">€{beneficioTotal.toLocaleString("es-ES", { minimumFractionDigits: 0 })}</p>
              <p className="beneficio-count">{vehiculosConPrecio} vehículos con precios</p>
            </div>
            {vehiculosConPrecio > 0 && (
              <div className="beneficio-promedio">
                <p className="beneficio-label">Margen promedio por vehículo</p>
                <p className="beneficio-value">€{Math.round(beneficioTotal / vehiculosConPrecio).toLocaleString("es-ES")}</p>
              </div>
            )}
          </div>
        </section>

        {/* Leads sin seguimiento */}
        {leadsSinSeguimiento > 0 && (
          <section className="panel dashboard-card warning-card">
            <div className="dashboard-header">
              <p className="eyebrow">Alerta</p>
              <h3>Leads sin seguimiento</h3>
            </div>
            <div className="warning-content">
              <p className="warning-number">{leadsSinSeguimiento}</p>
              <p className="warning-text">lead{leadsSinSeguimiento !== 1 ? "s" : ""} sin contacto hace más de 7 días</p>
              <p className="warning-hint">Considera hacer seguimiento próximamente</p>
            </div>
          </section>
        )}
      </section>

      {/* Últimos Leads */}
      {ultimosLeads.length > 0 && (
        <section className="panel dashboard-section">
          <div className="dashboard-header">
            <p className="eyebrow">Actividad Reciente</p>
            <h3>Últimos leads registrados</h3>
          </div>
          <div className="dashboard-table">
            {ultimosLeads.map((lead) => (
              <div key={lead.id} className="dashboard-table-row">
                <div className="dashboard-table-cell-name">
                  <p className="name-bold">{lead.name}</p>
                  <p className="name-sub">{lead.phone || "Sin teléfono"}</p>
                </div>
                <div className="dashboard-table-cell-meta">
                  {lead.canal && <span className="badge">{lead.canal}</span>}
                  {lead.estado && <span className="badge">{lead.estado}</span>}
                </div>
                <div className="dashboard-table-cell-date">
                  {lead.fecha_contacto && <p className="date-text">{lead.fecha_contacto}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {stock.length === 0 && leads.length === 0 && (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin datos</p>
          <h2>Dashboard vacío</h2>
          <p className="muted">Comienza por añadir vehículos al stock y registrar los primeros leads.</p>
        </section>
      )}
    </>
  );
}
