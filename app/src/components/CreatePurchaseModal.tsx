import { useState, useEffect } from "react";
import * as api from "../lib/api";
import { showToast } from "../lib/toast";
import { translateError } from "../lib/translateError";
import { formatDate, formatEur } from "./bank-utils";

const EXPENSE_TYPES: { value: string; label: string }[] = [
  { value: "COMPRA_VEHICULO", label: "Compra vehículo" },
  { value: "TALLER", label: "Taller" },
  { value: "GESTION_AUTO1", label: "Gestión AUTO1" },
  { value: "TRANSPORTE", label: "Transporte" },
  { value: "LIMPIEZA", label: "Limpieza" },
  { value: "COMBUSTIBLE", label: "Combustible" },
  { value: "PUBLICIDAD", label: "Publicidad" },
  { value: "RECAMBIOS", label: "Recambios" },
  { value: "NEUMATICOS", label: "Neumáticos" },
  { value: "AUTONOMO", label: "Autónomo" },
  { value: "SOFTWARE", label: "Software" },
  { value: "BANCO", label: "Banco" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "OTRO", label: "Otro" },
];

interface Props {
  tx: api.BankTransaction;
  companyId: number;
  onClose: () => void;
  onCreated: () => void;
}

// Audit 2026-04-19: cuando counterparty_name está vacío (común en N43), extraer
// el nombre del proveedor del primer segmento de la descripción (antes de " | "
// o " / "). Evita que Ricard tenga que copiar/pegar manualmente para cada compra.
function suggestSupplier(tx: api.BankTransaction): string {
  const counterparty = (tx.counterparty_name || "").trim();
  if (counterparty) return counterparty;
  const desc = (tx.description || "").trim();
  if (!desc) return "";
  return desc.split(/\s*[|/]\s*/)[0]?.trim() || "";
}

export function CreatePurchaseModal({ tx, companyId, onClose, onCreated }: Props) {
  const [expenseType, setExpenseType] = useState(categoryToExpenseType(tx.category));
  const [supplierName, setSupplierName] = useState(suggestSupplier(tx));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierName.trim()) {
      showToast("Indica el nombre del proveedor", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.createPurchaseFromTransaction(companyId, tx.id, expenseType, supplierName.trim(), null);
      showToast("Compra creada y vinculada al movimiento", "success");
      onCreated();
      onClose();
    } catch (e) {
      showToast(translateError(e), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-purchase-title"
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
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "1.5rem",
          maxWidth: 560,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Crear compra desde movimiento</p>
            <h3 id="create-purchase-title" style={{ margin: "0.25rem 0 0", fontSize: "1.1rem" }}>
              {formatDate(tx.booking_date)} · {formatEur(Math.abs(Number(tx.amount)))}
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

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem" }}>
            <span style={{ fontWeight: 600 }}>Tipo de gasto</span>
            <select
              value={expenseType}
              onChange={(e) => setExpenseType(e.target.value)}
              disabled={submitting}
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #cbd5e1" }}
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem" }}>
            <span style={{ fontWeight: 600 }}>Proveedor</span>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              disabled={submitting}
              placeholder="Nombre del proveedor"
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #cbd5e1" }}
            />
          </label>

          <div
            style={{
              background: "#f1f5f9",
              padding: "0.75rem",
              borderRadius: 8,
              fontSize: "0.8rem",
              color: "#475569",
            }}
          >
            Se creará un registro de compra por <b>{formatEur(Math.abs(Number(tx.amount)))}</b> con fecha <b>{formatDate(tx.booking_date)}</b> y se vinculará automáticamente a este movimiento.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="button secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !supplierName.trim()}
            className="button primary"
          >
            {submitting ? "Creando…" : "Crear compra"}
          </button>
        </div>
      </form>
    </div>
  );
}

function categoryToExpenseType(category: string): string {
  switch (category) {
    case "COMPRA_VEHICULO": return "COMPRA_VEHICULO";
    case "REPARACION": return "TALLER";
    case "TRANSPORTE": return "TRANSPORTE";
    case "COMBUSTIBLE": return "COMBUSTIBLE";
    case "RECAMBIOS": return "RECAMBIOS";
    case "NEUMATICOS": return "NEUMATICOS";
    case "PUBLICIDAD": return "PUBLICIDAD";
    case "SOFTWARE": return "SOFTWARE";
    case "GESTORIA": return "SERVICIOS";
    case "AUTONOMO_CUOTA": return "AUTONOMO";
    case "COMISION_BANCO": return "BANCO";
    default: return "OTRO";
  }
}
