import React from "react";
import * as api from "../../../lib/api";

export function VDFactura({ facturas, docFileRef, uploadingDoc, handleUploadDoc, handleDeleteDoc }: {
  facturas: api.VehicleDocument[];
  docFileRef: React.RefObject<HTMLInputElement | null>;
  uploadingDoc: boolean;
  handleUploadDoc: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteDoc: (d: api.VehicleDocument) => void;
}) {
  return (
    <>
      <p className="eyebrow" style={{ marginBottom: "var(--space-sm)" }}>Factura de compra</p>
      {facturas.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", padding: "var(--space-sm)", background: "var(--color-bg-secondary)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-xs)" }}>
          <span style={{ flex: 1, fontSize: "var(--text-sm)" }}>{d.file_name}</span>
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="button secondary xs">Ver</a>
          <button type="button" className="button danger xs" onClick={() => void handleDeleteDoc(d)}>Eliminar</button>
        </div>
      ))}
      {facturas.length === 0 && <p className="muted" style={{ margin: "0 0 var(--space-xs)", fontSize: "var(--text-sm)" }}>No hay factura adjunta.</p>}
      <input ref={docFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => void handleUploadDoc(e)} />
      <button type="button" className="button secondary sm" onClick={() => docFileRef.current?.click()} disabled={uploadingDoc}>{uploadingDoc ? "Subiendo..." : "Adjuntar factura"}</button>
    </>
  );
}
