import React from "react";
import * as api from "../../../lib/api";
import { supabase } from "../../../lib/supabase";
import { VDFactura } from "./VDFactura";

export function VDPurchaseInfo({ suppliers, supplierId, onSupplierChange, facturas, docFileRef, uploadingDoc, handleUploadDoc, handleDeleteDoc, purchaseRecords }: {
  suppliers: api.Supplier[];
  supplierId: number | null;
  onSupplierChange: (id: number | null) => void;
  facturas: api.VehicleDocument[];
  docFileRef: React.RefObject<HTMLInputElement | null>;
  uploadingDoc: boolean;
  handleUploadDoc: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteDoc: (d: api.VehicleDocument) => void;
  purchaseRecords: api.PurchaseRecord[];
}) {
  const purchaseRecord = purchaseRecords.find((p) => p.expense_type === "COMPRA_VEHICULO");
  const [bankTx, setBankTx] = React.useState<api.BankTransaction | null>(null);
  React.useEffect(() => {
    if (!purchaseRecord) { setBankTx(null); return; }
    void (async () => {
      try {
        const { data } = await supabase
          .from("bank_transactions")
          .select("*")
          .eq("linked_purchase_id", purchaseRecord.id)
          .limit(1);
        setBankTx((data && data.length > 0) ? data[0] as api.BankTransaction : null);
      } catch { setBankTx(null); }
    })();
  }, [purchaseRecord?.id]);

  return (
    <section className="panel vd-sidebar-panel">
      <div className="vd-section-header"><p className="eyebrow">Info compra</p></div>
      <div className="form-stack">
        <div>
          <label className="field-label">Proveedor</label>
          <select value={supplierId || ""} onChange={(e) => onSupplierChange(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Factura de compra</label>
          <VDFactura facturas={facturas} docFileRef={docFileRef} uploadingDoc={uploadingDoc} handleUploadDoc={handleUploadDoc} handleDeleteDoc={handleDeleteDoc} />
        </div>
        <div>
          <label className="field-label">Movimiento del banco</label>
          {bankTx ? (
            <div style={{ padding: "var(--space-sm) var(--space-md)", background: "var(--color-bg-secondary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-light)", fontSize: "var(--text-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>{bankTx.counterparty_name || "Movimiento"}</span>
                <span style={{ fontWeight: 700, color: bankTx.amount < 0 ? "var(--color-danger)" : "var(--color-success)" }}>{bankTx.amount.toLocaleString("es-ES")} €</span>
              </div>
              <p className="muted" style={{ margin: "var(--space-xs) 0 0", fontSize: "var(--text-xs)" }}>{bankTx.booking_date} · {bankTx.category}</p>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>No hay movimiento vinculado</p>
          )}
        </div>
      </div>
    </section>
  );
}
