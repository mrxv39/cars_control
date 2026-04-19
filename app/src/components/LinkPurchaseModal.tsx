import { useState, useEffect } from "react";
import * as api from "../lib/api";
import { formatDate, formatEur } from "./bank-utils";

interface Props {
  tx: api.BankTransaction;
  companyId: number;
  onClose: () => void;
  onLinked: () => void;
}

export function LinkPurchaseModal({ tx, companyId, onClose, onLinked }: Props) {
  const [suggestions, setSuggestions] = useState<api.PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await api.suggestPurchasesForTransaction(
          companyId,
          Number(tx.amount),
          tx.booking_date,
        );
        if (!cancelled) setSuggestions(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tx.id, companyId, tx.amount, tx.booking_date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function doLink(purchaseId: number) {
    setLinking(purchaseId);
    try {
      await api.linkTransactionToPurchase(tx.id, purchaseId);
      onLinked();
      onClose();
    } catch (e) {
      console.error("Error al vincular:", e);
    } finally {
      setLinking(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-purchase-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1.5rem",
          maxWidth: 640,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Vincular a compra existente</p>
            <h3 id="link-purchase-title" style={{ margin: "0.25rem 0 0", fontSize: "1.1rem" }}>
              {formatDate(tx.booking_date)} · {formatEur(Number(tx.amount))}
            </h3>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
              {tx.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b" }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            background: "#f1f5f9",
            padding: "0.75rem",
            borderRadius: 8,
            marginBottom: "1rem",
            fontSize: "0.85rem",
            color: "#475569",
          }}
        >
          Mostrando compras del rango <b>±15 días</b> con importe ≈ <b>{formatEur(Math.abs(Number(tx.amount)))}</b>
        </div>

        {loading ? (
          <p className="muted">Buscando candidatos…</p>
        ) : suggestions.length === 0 ? (
          <div
            style={{
              background: "#fef3c7",
              padding: "1rem",
              borderRadius: 8,
              color: "#92400e",
              fontSize: "0.9rem",
            }}
          >
            No se encontraron compras existentes con importe y fecha cercanos. Puedes
            cerrar este diálogo y usar <b>Crear compra</b> en el menú de acciones del
            movimiento.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void doLink(p.id)}
                disabled={linking !== null}
                style={{
                  textAlign: "left",
                  padding: "0.85rem 1rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  background: linking === p.id ? "#e0e7ff" : "#fff",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1d4ed8")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#1e293b" }}>
                    {p.supplier_name}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                    {p.vehicle_name || "—"} · {p.purchase_date} · {p.expense_type}
                  </div>
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#dc2626", whiteSpace: "nowrap" }}>
                  {formatEur(p.purchase_price)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
