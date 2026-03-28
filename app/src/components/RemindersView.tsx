import { Lead, StockVehicle } from "../types";

interface Props {
  leads: Lead[];
  stock: StockVehicle[];
  onEditLead: (lead: Lead) => void;
  onReload: () => void;
  daysThreshold?: number;
}

export function RemindersView({ leads, stock, onEditLead, onReload, daysThreshold = 7 }: Props) {
  const vehicleMap = new Map(stock.map((v) => [v.folder_path, v]));

  // Leads activos sin contacto reciente
  const hoy = new Date();
  const fechaLimite = new Date(hoy.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

  const leadsSinSeguimiento = leads.filter((lead) => {
    // Solo leads activos (no cerrados ni perdidos)
    if (["cerrado", "perdido"].includes(lead.estado || "")) return false;

    // Que no tengan fecha de contacto
    if (!lead.fecha_contacto) return true;

    // O que su última fecha sea anterior al umbral
    const fecha = new Date(lead.fecha_contacto);
    return fecha < fechaLimite;
  });

  const leadsNuevosSinContacto = leadsSinSeguimiento.filter((l) => !l.fecha_contacto);
  const leadsAntiguosSinSeguimiento = leadsSinSeguimiento.filter((l) => l.fecha_contacto);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Recordatorios</p>
          <h2>Leads que necesitan seguimiento</h2>
          <p className="muted" role="status">{leadsSinSeguimiento.length} lead{leadsSinSeguimiento.length !== 1 ? "s" : ""} requieren atención</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={onReload}>
            Recargar
          </button>
        </div>
      </header>

      {leadsSinSeguimiento.length === 0 ? (
        <section className="panel setup-panel">
          <p className="eyebrow">¡Bien hecho!</p>
          <h2>Todos los leads están al día</h2>
          <p className="muted">No hay leads sin seguimiento hace más de {daysThreshold} días.</p>
        </section>
      ) : (
        <>
          {/* Leads nuevos sin contacto inicial */}
          {leadsNuevosSinContacto.length > 0 && (
            <section className="panel">
              <div className="reminder-section-header">
                <h3>🆕 Leads nuevos sin primer contacto ({leadsNuevosSinContacto.length})</h3>
                <p className="muted">Estos leads acaban de llegar. Es hora de hacer el primer contacto.</p>
              </div>
              <div className="reminder-list" aria-live="polite">
                {leadsNuevosSinContacto.map((lead) => (
                  <div key={lead.id} className="reminder-item new">
                    <div className="reminder-content">
                      <p className="reminder-name">{lead.name}</p>
                      <p className="reminder-phone">{lead.phone}</p>
                      {lead.canal && <p className="reminder-canal">Desde: {lead.canal}</p>}
                    </div>
                    <button type="button" className="button primary" onClick={() => onEditLead(lead)}>
                      Contactar ahora
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Leads con seguimiento antiguo */}
          {leadsAntiguosSinSeguimiento.length > 0 && (
            <section className="panel">
              <div className="reminder-section-header">
                <h3>⏰ Leads sin contacto hace {daysThreshold}+ días ({leadsAntiguosSinSeguimiento.length})</h3>
                <p className="muted">Es momento de hacer seguimiento a estos leads.</p>
              </div>
              <div className="reminder-list" aria-live="polite">
                {leadsAntiguosSinSeguimiento.map((lead) => {
                  const diasSinContacto = Math.floor(
                    (hoy.getTime() - new Date(lead.fecha_contacto || "").getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const linkedVehicle = lead.vehicle_folder_path ? vehicleMap.get(lead.vehicle_folder_path) : null;

                  return (
                    <div key={lead.id} className="reminder-item stale">
                      <div className="reminder-content">
                        <p className="reminder-name">{lead.name}</p>
                        <p className="reminder-phone">{lead.phone}</p>
                        {linkedVehicle && <p className="reminder-vehicle">Interesado en: {linkedVehicle.name}</p>}
                        <p className="reminder-days">Sin contacto: {diasSinContacto} días</p>
                      </div>
                      <button type="button" className="button secondary" onClick={() => onEditLead(lead)}>
                        Actualizar
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <style>{`
        .reminder-section-header {
          margin-bottom: 1.5rem;
        }

        .reminder-section-header h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
        }

        .reminder-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .reminder-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-radius: 4px;
          border-left: 4px solid #666;
        }

        .reminder-item.new {
          background: #f0f8ff;
          border-left-color: #2196f3;
        }

        .reminder-item.stale {
          background: #fff8e1;
          border-left-color: #ff9800;
        }

        .reminder-content {
          flex: 1;
        }

        .reminder-name {
          font-weight: 600;
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
        }

        .reminder-phone,
        .reminder-canal,
        .reminder-vehicle,
        .reminder-days {
          margin: 0.2rem 0;
          font-size: 0.9rem;
          color: #666;
        }

        .reminder-days {
          font-weight: 500;
          color: #ff6f00;
        }
      `}</style>
    </>
  );
}
