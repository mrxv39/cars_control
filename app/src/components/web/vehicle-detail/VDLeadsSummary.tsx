import * as api from "../../../lib/api";
import EmptyState from "../EmptyState";

function formatDateCompact(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function VDLeadsSummary({ vehicleLeads, onOpenLead }: {
  vehicleLeads: api.Lead[];
  onOpenLead: (leadId?: number) => void;
}) {
  return (
    <section className="panel vd-sidebar-panel" id="vd-leads">
      <div className="vd-section-header">
        <p className="eyebrow">Leads ({vehicleLeads.length})</p>
      </div>

      {vehicleLeads.length === 0 ? (
        <EmptyState title="Sin leads" description="Este vehículo no tiene leads asociados" />
      ) : (
        <>
          <ul className="vd-leads-summary">
            {vehicleLeads.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  className="vd-leads-summary-item"
                  onClick={() => onOpenLead(lead.id)}
                  aria-label={`Abrir conversación con ${lead.name}`}
                >
                  <span className="vd-leads-summary-name">
                    <span className={`lead-status-dot ${lead.estado || "nuevo"}`} />
                    {lead.name}
                  </span>
                  <span className="vd-leads-summary-date">{formatDateCompact(lead.fecha_contacto)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="button secondary xs vd-leads-summary-cta"
            onClick={() => onOpenLead()}
          >
            Ver conversaciones →
          </button>
        </>
      )}
    </section>
  );
}
