import { useState, useMemo, useEffect } from "react";
import * as api from "../lib/api";
import { showToast } from "../lib/toast";
import { translateError } from "../lib/translateError";
import { categoryLabel, suggestPatternFromTx } from "./bank-utils";

interface Props {
  tx: api.BankTransaction;
  category: string;
  companyId: number;
  onClose: () => void;
  onCreated: () => void;
}

// Patrones por debajo de este umbral son demasiado genéricos y pueden recategorizar
// movimientos no relacionados (ej: "ricard" coincidiría con cualquier descripción
// que contenga el nombre del titular). Mostrar advertencia en la UI.
const GENERIC_PATTERN_MIN_LEN = 6;

export function CreateRuleModal({ tx, category, companyId, onClose, onCreated }: Props) {
  const initialPattern = useMemo(() => suggestPatternFromTx(tx.counterparty_name, tx.description), [tx]);
  const [pattern, setPattern] = useState(initialPattern);
  const [priority, setPriority] = useState(100);
  // Audit 2026-04-19 M2: el campo Prioridad expone implementación que a un
  // usuario no técnico sólo le genera dudas. Por defecto oculto; sigue visible
  // para quien quiera ajustar (reglas más específicas deben ganar a las genéricas).
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Preview retroactivo: cuántos SIN_CATEGORIZAR coinciden con el patrón actual.
  // null = aún no calculado (o patrón inválido). Debounced para no disparar queries
  // en cada tecla.
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [applyRetro, setApplyRetro] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const clean = pattern.trim();
    if (clean.length < 3) {
      setMatchCount(null);
      setCountLoading(false);
      return;
    }
    setCountLoading(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const n = await api.countUncategorizedMatching(companyId, clean);
        if (!cancelled) setMatchCount(n);
      } catch {
        if (!cancelled) setMatchCount(null);
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [pattern, companyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern.trim()) {
      showToast("Indica un patrón para la regla", "error");
      return;
    }
    setSubmitting(true);
    try {
      await api.createBankCategoryRule(companyId, pattern, category, null, priority);
      let retroCount = 0;
      if (applyRetro && matchCount && matchCount > 0) {
        retroCount = await api.applyCategoryToUncategorizedMatching(companyId, pattern, category);
      }
      const catLabel = categoryLabel(category);
      const msg = retroCount > 0
        ? `Regla creada · ${retroCount} movimiento${retroCount !== 1 ? "s" : ""} categorizado${retroCount !== 1 ? "s" : ""} como "${catLabel}"`
        : `Regla creada: movimientos con "${pattern.trim()}" serán "${catLabel}"`;
      showToast(msg, "success");
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
              style={{
                padding: "0.5rem",
                borderRadius: 6,
                border: pattern.trim().length > 0 && pattern.trim().length < GENERIC_PATTERN_MIN_LEN ? "1px solid #f59e0b" : "1px solid #cbd5e1",
              }}
              autoFocus
            />
            {pattern.trim().length > 0 && pattern.trim().length < GENERIC_PATTERN_MIN_LEN ? (
              <span role="alert" style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 600 }}>
                ⚠ Patrón muy corto ({pattern.trim().length} caracteres). Puede coincidir con muchos movimientos no relacionados.
              </span>
            ) : (
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                La búsqueda es insensible a mayúsculas.
              </span>
            )}
          </label>

          {pattern.trim().length >= 3 && (
            <div
              style={{
                background: matchCount && matchCount > 0 ? "#ecfdf5" : "#f1f5f9",
                border: matchCount && matchCount > 0 ? "1px solid #6ee7b7" : "1px solid #e2e8f0",
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                fontSize: "0.85rem",
                color: "#334155",
              }}
            >
              {countLoading || matchCount === null ? (
                <span style={{ color: "#64748b" }}>Buscando coincidencias…</span>
              ) : matchCount === 0 ? (
                <span>Ningún movimiento existente coincide con este patrón.</span>
              ) : (
                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={applyRetro}
                    onChange={(e) => setApplyRetro(e.target.checked)}
                    disabled={submitting}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    Aplicar también a <b>{matchCount} movimiento{matchCount !== 1 ? "s" : ""} sin categorizar</b>
                    {" "}que ya coinciden.
                    <br />
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Solo se tocan los "Sin categorizar". Los ya categorizados manualmente no se modifican.
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#64748b",
                fontSize: "0.8rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {showAdvanced ? "Ocultar opciones avanzadas" : "Opciones avanzadas"}
            </button>
            {showAdvanced && (
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem", marginTop: "0.5rem" }}>
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
                  Menor número = mayor prioridad (por defecto 100). Útil si tienes varias reglas que podrían coincidir con el mismo movimiento.
                </span>
              </label>
            )}
          </div>

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
