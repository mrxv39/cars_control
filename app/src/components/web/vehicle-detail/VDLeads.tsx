import * as api from "../../../lib/api";
import EmptyState from "../EmptyState";

export function VDLeads({ vehicleLeads }: { vehicleLeads: api.Lead[] }) {
  if (vehicleLeads.length === 0) return <EmptyState title="Sin leads" description="Este vehículo no tiene leads asociados" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      {vehicleLeads.map((l) => (
        <div key={l.id} style={{ padding: "var(--space-md)", background: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-light)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontWeight: 600, fontSize: "var(--text-sm)" }}><span className={`lead-status-dot ${l.estado || "nuevo"}`} />{l.name}</span>
            <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{l.canal} · {l.estado}</span>
          </div>
          {l.phone && <p style={{ margin: "var(--space-xs) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Tel: {l.phone}</p>}
          {l.email && <p style={{ margin: "var(--space-xs) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>{l.email}</p>}
          {l.notes && <p style={{ margin: "var(--space-xs) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{l.notes}</p>}
        </div>
      ))}
    </div>
  );
}
