import * as api from "../../lib/api";

interface ImportCochesPanelProps {
  preview: api.ImportPreview;
  importing: boolean;
  selectedToImport: Set<string>;
  onToggleSelection: (externalId: string, checked: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportCochesPanel({
  preview,
  importing,
  selectedToImport,
  onToggleSelection,
  onCancel,
  onConfirm,
}: ImportCochesPanelProps) {
  return (
    <div className="modal-overlay" onClick={() => !importing && onCancel()}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "780px", maxHeight: "85vh", overflowY: "auto" }}
      >
        <h3 style={{ margin: "0 0 0.5rem" }}>Importar desde coches.net</h3>
        <p className="muted" style={{ margin: "0 0 var(--space-lg)", fontSize: "var(--text-sm)" }}>
          {preview.listing.length} coches en el perfil ·
          {" "}{preview.newDetails.length} nuevos detectados ·
          {" "}{preview.removedExternalIds.length} ya no aparecen
        </p>

        {preview.newDetails.length > 0 ? (
          <>
            <h4 style={{ margin: "0.75rem 0 0.5rem" }}>Nuevos coches</h4>
            <p className="muted" style={{ fontSize: "var(--text-xs)", margin: "0 0 var(--space-sm)" }}>
              Marca los que quieras importar (todos por defecto)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {preview.newDetails.map((d) => {
                const id = d.externalId || "";
                const checked = selectedToImport.has(id);
                return (
                  <label
                    key={id}
                    style={{ display: "flex", gap: "0.75rem", padding: "0.5rem", border: "1px solid #e5e5e5", borderRadius: "8px", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onToggleSelection(id, e.target.checked)}
                    />
                    {d.photoUrls[0] && (
                      <img
                        src={d.photoUrls[0]}
                        alt={d.name || "Vehículo a importar"}
                        style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 4 }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <strong>{d.name}</strong>
                      <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                        {[d.year, d.km ? `${d.km.toLocaleString()} km` : null, d.fuelType, d.transmission, d.color].filter(Boolean).join(" · ")}
                      </div>
                      <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                        {d.photoUrls.length} fotos · {d.equipment.length} equipamientos
                        {d.videoUrls.length > 0 && ` · ${d.videoUrls.length} vídeos`}
                      </div>
                    </div>
                    <div style={{ fontWeight: "bold" }}>{d.price?.toLocaleString("es-ES")} €</div>
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <p className="muted">No hay coches nuevos en coches.net.</p>
        )}

        {preview.removedExternalIds.length > 0 && (
          <>
            <h4 style={{ margin: "var(--space-lg) 0 var(--space-sm)", color: "var(--color-warning)" }}>
              Ya no aparecen en coches.net
            </h4>
            <p className="muted" style={{ fontSize: "var(--text-xs)", margin: 0 }}>
              Estos {preview.removedExternalIds.length} coches se marcarán para revisión.
            </p>
          </>
        )}

        <div className="form-actions" style={{ marginTop: "1rem" }}>
          <button type="button" className="button secondary" onClick={onCancel} disabled={importing}>
            Cancelar
          </button>
          <button
            type="button"
            className="button primary"
            onClick={onConfirm}
            disabled={importing || selectedToImport.size === 0}
          >
            {importing ? "Importando..." : `Importar ${selectedToImport.size} coches`}
          </button>
        </div>
      </div>
    </div>
  );
}
