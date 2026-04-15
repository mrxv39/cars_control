import { Car, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { StockVehicle, Lead } from "../types";

interface Props {
  stock: StockVehicle[];
  leads: Lead[];
  onReload: () => void;
  onNavigate?: (view: string) => void;
}

export function DashboardView({ stock, leads, onReload, onNavigate }: Props) {
  // Stock stats
  const stockDisponible = stock.filter((v) => v.estado !== "reservado" && v.estado !== "vendido").length;
  const stockReservado = stock.filter((v) => v.estado === "reservado").length;
  const stockVendido = stock.filter((v) => v.estado === "vendido").length;

  // Lead stats
  const leadsNuevos = leads.filter((l) => l.estado === "nuevo" || !l.estado).length;
  const leadsActivos = leads.filter((l) => ["contactado", "negociando"].includes(l.estado || "")).length;
  const leadsCerrados = leads.filter((l) => l.estado === "cerrado").length;
  const leadsPerdidos = leads.filter((l) => l.estado === "perdido").length;

  // Leads sin seguimiento reciente (sin fecha_contacto o > 7 dias)
  const hoy = new Date();
  const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
  const estadosFinales = ["cerrado", "perdido", "vendido", "descartado"];
  const leadsSinSeguimiento = leads.filter((l) => {
    if (estadosFinales.includes(l.estado || "")) return false;
    if (!l.fecha_contacto) return true;
    const fecha = new Date(l.fecha_contacto);
    return fecha < hace7Dias;
  }).length;

  // Últimos 5 leads
  const ultimosLeads = [...leads]
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
  const warningClickable = leadsSinSeguimiento > 0 && !!onNavigate;

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
            <p className="eyebrow"><Car size={14} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />Stock</p>
            <h3>Vehículos en inventario</h3>
          </div>
          <div className="dashboard-stats">
            <div className="stat-item">
              <div className="stat-number" role="status">{stockDisponible}</div>
              <p className="stat-label">Disponibles</p>
            </div>
            <div className="stat-item">
              <div className="stat-number" role="status">{stockReservado}</div>
              <p className="stat-label">Reservados</p>
            </div>
            <div className="stat-item">
              <div className="stat-number" role="status">{stockVendido}</div>
              <p className="stat-label">Vendidos</p>
            </div>
            <div className="stat-item">
              <div className="stat-number" role="status">{stock.length}</div>
              <p className="stat-label">Total</p>
            </div>
          </div>
        </section>

        {/* Leads Overview */}
        <section className="panel dashboard-card">
          <div className="dashboard-header">
            <p className="eyebrow"><Users size={14} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />Leads</p>
            <h3>Estado de contactos</h3>
          </div>
          <div className="dashboard-stats">
            <div className="stat-item">
              <div className="stat-number" role="status">{leadsNuevos}</div>
              <p className="stat-label">Nuevos</p>
            </div>
            <div className="stat-item">
              <div className="stat-number" role="status">{leadsActivos}</div>
              <p className="stat-label">En negociación</p>
            </div>
            <div className="stat-item">
              <div className="stat-number" role="status">{leadsCerrados}</div>
              <p className="stat-label">Cerrados</p>
            </div>
            <div className="stat-item">
              <div className="stat-number" role="status">{leadsPerdidos}</div>
              <p className="stat-label">Perdidos</p>
            </div>
          </div>
        </section>

        {/* Beneficio Potencial */}
        <section className="panel dashboard-card beneficio-card">
          <div className="dashboard-header">
            <p className="eyebrow"><TrendingUp size={14} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />Financiero</p>
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
        <section
          className={`panel dashboard-card ${leadsSinSeguimiento > 0 ? "warning-card" : ""}`}
          tabIndex={warningClickable ? 0 : undefined}
          role={warningClickable ? "button" : undefined}
          aria-label={warningClickable ? `${leadsSinSeguimiento} lead${leadsSinSeguimiento !== 1 ? "s" : ""} sin contactar — ver recordatorios` : undefined}
          onClick={warningClickable ? () => onNavigate!("reminders") : undefined}
          onKeyDown={warningClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate!("reminders"); } } : undefined}
        >
          <div className="dashboard-header">
            <p className="eyebrow">{leadsSinSeguimiento > 0 ? <><AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />Alerta</> : "Seguimiento"}</p>
            <h3>Leads sin contactar</h3>
          </div>
          <div className="warning-content">
            <p className={`warning-number${leadsSinSeguimiento > 0 ? " is-alert" : ""}`} role={leadsSinSeguimiento > 0 ? "alert" : "status"}>
              {leadsSinSeguimiento}
            </p>
            {leadsSinSeguimiento > 0 ? (
              <>
                <p className="warning-text">
                  lead{leadsSinSeguimiento !== 1 ? "s" : ""} sin contacto en mas de 7 dias
                </p>
                <button
                  type="button"
                  className="button danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.("reminders");
                  }}
                >
                  Ver recordatorios
                </button>
              </>
            ) : (
              <p className="warning-text text-success">Todos los leads estan al dia</p>
            )}
          </div>
        </section>
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
