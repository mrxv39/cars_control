import { useState, useMemo } from "react";
import * as api from "../lib/api";
import { showToast } from "../lib/toast";
import { translateError } from "../lib/translateError";
import { categoryLabel } from "./bank-utils";

interface Props {
  tx: api.BankTransaction;
  category: string;
  companyId: number;
  onClose: () => void;
  onCreated: () => void;
}

const STOP_WORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "en", "por", "para", "a", "al",
  "com", "sl", "sa", "slu", "cb", "sas", "s.l.", "s.a.",
  "transferencia", "recibo", "bizum", "traspaso", "pago",
]);

function suggestPattern(tx: api.BankTransaction): string {
  const counterparty = (tx.counterparty_name || "").trim();
  if (counterparty.length >= 3) return counterparty;

  const desc = (tx.description || "").toLowerCase();
  const words = desc
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return words[0] || counterparty || "";
}

export function CreateRuleModal({ tx, category, companyId, onClose, onCreated }: Props) {
  const initialPattern = useMemo(() => suggestPattern(tx), [tx]);
  const [pattern, setPattern] = useState(initialPattern);
  const [priority, setPriority] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern.trim()) {
      showToast("Indica un patrón para la regla", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.createBankCategoryRule(companyId, pattern, category, null, priority);
      showToast(`Regla creada: movimientos con "${pattern.trim()}" serán "${categoryLabel(category)}"`, "success");
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
      aria-labelledby="create-rule-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 1001,
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
          maxWidth: 520,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Crear regla de categorización</p>
            <h3 id="create-rule-title" style={{ margin: "0.25rem 0 0", fontSize: "1.1rem" }}>
              → {categoryLabel(category)}
            </h3>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
              Futuros movimientos que coincidan con el patrón se categorizarán automáticamente.
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
            <span style={{ fontWeight: 600 }}>Patrón (texto que aparezca en descripción o contraparte)</span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              disabled={submitting}
              placeholder="ej: AUTO1, AGENCIA TRIBUTARIA, ..."
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #cbd5e1" }}
              autoFocus
            />
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              La búsqueda es insensible a mayúsculas.
            </span>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem" }}>
            <span style={{ fontWeight: 600 }}>Prioridad</span>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 100)}
              disabled={submitting}
              min={1}
              max={999}
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #cbd5e1", maxWidth: 120 }}
            />
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Menor número = mayor prioridad (por defecto 100).
            </span>
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
            Movimiento actual:<br />
            <b>{tx.counterparty_name || tx.description}</b>
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
            disabled={submitting || !pattern.trim()}
            className="button primary"
          >
            {submitting ? "Creando…" : "Crear regla"}
          </button>
        </div>
      </form>
    </div>
  );
}
