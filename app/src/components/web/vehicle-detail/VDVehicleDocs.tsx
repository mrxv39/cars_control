import React from "react";
import * as api from "../../../lib/api";

export function VDVehicleDocs({ docs, vehicleId, onReload }: { docs: api.VehicleDocument[]; vehicleId: number; onReload: () => void }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadType, setUploadType] = React.useState<string | null>(null);

  const DOC_TYPES = [
    { key: "ficha_tecnica", label: "Ficha técnica" },
    { key: "permiso_circulacion", label: "Permiso de circulación" },
    { key: "seguro", label: "Seguro del vehículo" },
  ] as const;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadType) return;
    setUploading(true);
    try {
      await api.uploadVehicleDocument(vehicleId, file, uploadType);
      onReload();
    } finally {
      setUploading(false);
      setUploadType(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function triggerUpload(docType: string) {
    setUploadType(docType);
    setTimeout(() => fileRef.current?.click(), 50);
  }

  return (
    <section className="panel vd-sidebar-panel">
      <div className="vd-section-header"><p className="eyebrow">Documentación vehículo</p></div>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => void handleUpload(e)} />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {DOC_TYPES.map(({ key, label }) => {
          const doc = docs.find((d) => d.doc_type === key);
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-sm) var(--space-md)", background: "var(--color-bg-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-light)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "var(--text-sm)" }}>
                <span
                  role="img"
                  aria-label={doc ? "Documento adjuntado" : "Pendiente"}
                  style={{ width: 8, height: 8, borderRadius: "50%", background: doc ? "var(--color-success)" : "var(--color-text-faint)", flexShrink: 0 }}
                />
                <span style={{ fontWeight: 600 }}>{label}</span>
              </div>
              {doc ? (
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="button secondary xs">Ver</a>
              ) : (
                <button type="button" className="button secondary xs" disabled={uploading} onClick={() => triggerUpload(key)}>
                  {uploading && uploadType === key ? "..." : "Adjuntar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
