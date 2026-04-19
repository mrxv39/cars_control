import { useState, useEffect, useMemo, useCallback } from "react";
import * as api from "../lib/api";
import { showToast } from "../lib/toast";
import { translateError } from "../lib/translateError";
import { LinkPurchaseModal } from "./LinkPurchaseModal";
import { CreatePurchaseModal } from "./CreatePurchaseModal";
import { CreateRuleModal } from "./CreateRuleModal";
import { CATEGORY_LABELS, categoryLabel, categoryColor, formatEur, formatDate, monthOf, monthLabel } from "./bank-utils";

// ============================================================
// BankList — vista del extracto bancario
// ============================================================
// Validado con Ricard 2026-04-08:
//   3 cuentas (Personal, Autónomo, Póliza). La cuenta Personal está marcada
//   `is_personal=true` y NO entra en cómputos fiscales.
//
// Fase 1: tabla read-only de movimientos importados (vía scripts/import_n43.py)
// Fase 2 (esta): editor categoría inline + modal vincular ↔ compra existente
//                + crear compra desde movimiento + resumen visual por categoría
// Fase 3: GoCardless edge function + sync automático
//
// 🔴 SEGURIDAD: bank_transactions contienen datos personales sensibles.
// Esta vista NUNCA debe ofrecer "exportar todo a CSV público" ni dejar
// las descripciones en logs/analytics. Ver CLAUDE.md sección RGPD bancario.

interface Props {
  companyId: number;
}
export function BankList({ companyId }: Props) {
  const [accounts, setAccounts] = useState<api.BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<api.BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkingTx, setLinkingTx] = useState<api.BankTransaction | null>(null);
  const [creatingPurchaseTx, setCreatingPurchaseTx] = useState<api.BankTransaction | null>(null);
  const [ruleCandidate, setRuleCandidate] = useState<{ tx: api.BankTransaction; category: string } | null>(null);
  // ID de la última fila categorizada manualmente — habilita CTA inline "+ regla"
  // sin abrir un modal intrusivo en cada cambio (audit 2026-04-19, top friction Banco Fase 2).
  const [lastChangedTxId, setLastChangedTxId] = useState<number | null>(null);

  // Cargar cuentas al montar
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const accs = await api.listBankAccounts(companyId);
        if (cancelled) return;
        setAccounts(accs);
        const autonomo = accs.find((a) => !a.is_personal && a.account_type === "checking");
        setSelectedAccountId(autonomo?.id ?? accs[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const reloadTransactions = useCallback(async () => {
    if (selectedAccountId == null) {
      setTransactions([]);
      return;
    }
    try {
      const txs = await api.listBankTransactions(selectedAccountId, {
        category: filterCategory || undefined,
        onlyUnlinked: onlyUnlinked || undefined,
        search: search.trim() || undefined,
      });
      setTransactions(txs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selectedAccountId, filterCategory, onlyUnlinked, search]);

  useEffect(() => {
    void reloadTransactions();
  }, [reloadTransactions]);

  // Totales globales del periodo cargado
  const totals = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    for (const t of transactions) {
      const v = Number(t.amount);
      if (v > 0) ingresos += v;
      else gastos += v;
    }
    return { ingresos, gastos, neto: ingresos + gastos };
  }, [transactions]);

  // Resumen por categoría (para barras visuales)
  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const t of transactions) {
      const cur = map.get(t.category) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Math.abs(Number(t.amount));
      map.set(t.category, cur);
    }
    return Array.from(map.entries())
      .map(([cat, info]) => ({ category: cat, ...info }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const maxCatTotal = useMemo(
    () => Math.max(1, ...byCategory.map((c) => c.total)),
    [byCategory],
  );

  // Agrupar por mes para el listado
  const months = useMemo(() => {
    const groups = new Map<string, api.BankTransaction[]>();
    for (const t of transactions) {
      const key = monthOf(t.booking_date);
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const sinCategorizar = useMemo(
    () => transactions.filter((t) => t.category === "SIN_CATEGORIZAR").length,
    [transactions],
  );

  const sinVincular = useMemo(
    () => transactions.filter((t) => t.linked_purchase_id == null && t.linked_sale_id == null).length,
    [transactions],
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  async function changeCategory(txId: number, category: string) {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || tx.category === category) return;
    try {
      await api.updateBankTransactionCategory(txId, category, true);
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, category, reviewed_by_user: true } : t)),
      );
      setLastChangedTxId(category === "SIN_CATEGORIZAR" ? null : txId);
    } catch (e) {
      console.error("Error al cambiar categoría:", e);
      showToast(translateError(e), "error");
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">Cargando cuentas bancarias…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel" style={{ borderLeft: "4px solid var(--color-danger-dark)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ color: "var(--color-danger-dark)", margin: 0 }}>{translateError(error)}</p>
        <button type="button" className="button primary" onClick={() => { setError(null); setLoading(true); void (async () => { try { const accs = await api.listBankAccounts(companyId); setAccounts(accs); setSelectedAccountId(accs.find((a) => !a.is_personal && a.account_type === "checking")?.id ?? accs[0]?.id ?? null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } })(); }}>
          Reintentar
        </button>
      </section>
    );
  }

  if (accounts.length === 0) {
    return (
      <header className="hero">
        <div>
          <p className="eyebrow">Banco</p>
          <h2>No hay cuentas bancarias configuradas</h2>
          <p className="muted">
            Contacta con el administrador para configurar las cuentas bancarias.
          </p>
        </div>
      </header>
    );
  }

  return (
    <>
      {linkingTx && (
        <LinkPurchaseModal
          tx={linkingTx}
          companyId={companyId}
          onClose={() => setLinkingTx(null)}
          onLinked={() => void reloadTransactions()}
        />
      )}
      {creatingPurchaseTx && (
        <CreatePurchaseModal
          tx={creatingPurchaseTx}
          companyId={companyId}
          onClose={() => setCreatingPurchaseTx(null)}
          onCreated={() => void reloadTransactions()}
        />
      )}
      {ruleCandidate && (
        <CreateRuleModal
          tx={ruleCandidate.tx}
          category={ruleCandidate.category}
          companyId={companyId}
          onClose={() => setRuleCandidate(null)}
          onCreated={() => { /* la regla se aplicará a futuras importaciones */ }}
        />
      )}

      <header className="hero">
        <div>
          <p className="eyebrow">Banco</p>
          <h2>Movimientos bancarios</h2>
          <p className="muted">
            {transactions.length} movimiento{transactions.length !== 1 ? "s" : ""}
            {sinCategorizar > 0 && ` · ${sinCategorizar} sin categorizar`}
            {sinVincular > 0 && ` · ${sinVincular} sin vincular`}
            {selectedAccount?.last_synced_at &&
              ` · sincronizado ${new Date(selectedAccount.last_synced_at).toLocaleDateString("es-ES")}`}
          </p>
        </div>
      </header>

      {/* Selector de cuenta */}
      <section className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {accounts.map((acc) => {
            const isActive = acc.id === selectedAccountId;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedAccountId(acc.id)}
                aria-pressed={isActive}
                aria-label={`Cuenta ${acc.alias}, ${acc.account_type === "credit_line" ? "póliza de crédito" : "cuenta corriente"}${acc.is_personal ? ", personal" : ""}`}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  border: isActive ? "2px solid var(--color-primary)" : "2px solid var(--color-border-medium)",
                  background: isActive ? "var(--color-primary)" : "var(--color-bg)",
                  color: isActive ? "var(--color-bg)" : "var(--color-text-secondary)",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "var(--space-xs)",
                  transition: "background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)",
                }}
              >
                <span>{acc.alias}</span>
                <span style={{ fontSize: "var(--text-xs)", opacity: 0.8 }}>
                  {acc.account_type === "credit_line" ? "Póliza crédito" : "Cuenta corriente"}
                  {acc.is_personal && " · personal"}
                </span>
              </button>
            );
          })}
        </div>
        {selectedAccount?.is_personal && (
          <p
            className="muted"
            style={{ marginTop: "var(--space-md)", color: "var(--color-warning)", fontSize: "var(--text-sm)" }}
          >
            <span aria-hidden="true">⚠️ </span>Esta cuenta está marcada como <b>personal</b>. Sus movimientos no se
            cuentan en los modelos fiscales (303/130) ni en el dashboard de
            beneficio. Hacienda no permite mezclar gastos personales con la
            actividad de autónomo.
          </p>
        )}
      </section>

      {/* Resumen del periodo: ingresos / gastos / neto */}
      <section
        className="panel"
        style={{ marginBottom: "1rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}
      >
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Ingresos</p>
          <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--color-success)" }}>
            {formatEur(totals.ingresos)}
          </p>
        </div>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Gastos</p>
          <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--color-danger)" }}>
            {formatEur(totals.gastos)}
          </p>
        </div>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Neto</p>
          <p
            style={{
              margin: 0,
              fontSize: "1.4rem",
              fontWeight: 700,
              color: totals.neto >= 0 ? "var(--color-success)" : "var(--color-danger)",
            }}
          >
            {formatEur(totals.neto)}
          </p>
        </div>
      </section>

      {/* Resumen por categoría con barras */}
      {byCategory.length > 0 && (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <p className="eyebrow" style={{ margin: 0, marginBottom: "0.75rem" }}>
            Distribución por categoría
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {byCategory.map((c) => {
              const pct = (c.total / maxCatTotal) * 100;
              const isActive = filterCategory === c.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`Filtrar por ${categoryLabel(c.category)}: ${c.count} movimientos, total ${formatEur(c.total)}`}
                  onClick={() =>
                    setFilterCategory(isActive ? "" : c.category)
                  }
                  className="bank-cat-button"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                      }}
                    >
                      {categoryLabel(c.category)} · {c.count}
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text)" }}>
                      {formatEur(c.total)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "var(--color-bg-secondary)",
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="bank-cat-bar"
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: categoryColor(c.category),
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          {filterCategory && (
            <p style={{ marginTop: "var(--space-sm)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              Filtro activo · click otra vez en la categoría para quitar
            </p>
          )}
        </section>
      )}

      {/* Filtros */}
      <section className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Buscar en descripción…"
            aria-label="Buscar movimientos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 240px", padding: "var(--space-sm)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-medium)" }}
          />
          <select
            aria-label="Filtrar por categoría"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: "var(--space-sm)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-medium)" }}
          >
            <option value="">Todas las categorías</option>
            {Object.keys(CATEGORY_LABELS).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <label style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center", fontSize: "var(--text-sm)" }}>
            <input
              type="checkbox"
              checked={onlyUnlinked}
              onChange={(e) => setOnlyUnlinked(e.target.checked)}
            />
            Solo sin vincular
          </label>
        </div>
      </section>

      {/* Tabla agrupada por mes */}
      {transactions.length === 0 ? (
        <section className="panel">
          <p className="muted">
            Sin movimientos para los filtros actuales. Si acabas de importar un fichero bancario y no aparece nada, prueba a quitar los filtros.
          </p>
        </section>
      ) : (
        months.map(([yyyymm, txs]) => {
          let monthIngresos = 0;
          let monthGastos = 0;
          for (const t of txs) {
            const v = Number(t.amount);
            if (v > 0) monthIngresos += v;
            else monthGastos += v;
          }
          return (
            <section key={yyyymm} className="panel sales-records-panel" style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-md)",
                  paddingBottom: "var(--space-sm)",
                  borderBottom: "1px solid var(--color-border-light)",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1.05rem", textTransform: "capitalize", color: "var(--color-text)" }}>
                  {monthLabel(yyyymm)}
                </h3>
                <div style={{ display: "flex", gap: "1.25rem", fontSize: "var(--text-sm)" }}>
                  <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                    + {formatEur(monthIngresos)}
                  </span>
                  <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>
                    {formatEur(monthGastos)}
                  </span>
                  <span
                    style={{
                      color: monthIngresos + monthGastos >= 0 ? "var(--color-success)" : "var(--color-danger)",
                      fontWeight: 700,
                    }}
                  >
                    = {formatEur(monthIngresos + monthGastos)}
                  </span>
                </div>
              </div>
              <div className="sales-table-scroll">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th className="sales-th" style={{ width: "5rem" }}>Fecha</th>
                      <th className="sales-th">Descripción</th>
                      <th className="sales-th" style={{ width: "11rem" }}>Categoría</th>
                      <th className="sales-th sales-th-right" style={{ width: "7rem" }}>Importe</th>
                      <th className="sales-th" style={{ width: "9rem" }}>Vínculo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((t) => {
                      const v = Number(t.amount);
                      const linked =
                        t.linked_purchase_id != null || t.linked_sale_id != null;
                      const isExpense = v < 0;
                      return (
                        <tr key={t.id} className="sales-row">
                          <td className="sales-td" style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                            {formatDate(t.booking_date).slice(0, 5)}
                          </td>
                          <td
                            className="sales-td"
                            style={{
                              maxWidth: 360,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={t.description}
                          >
                            {t.description || <span className="muted">—</span>}
                          </td>
                          <td className="sales-td">
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                              <select
                                value={t.category}
                                onChange={(e) => void changeCategory(t.id, e.target.value)}
                                aria-label={`Categoría para ${t.description || "movimiento"}`}
                                style={{
                                  padding: "0.2rem 0.4rem",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--color-border-light)",
                                  background: t.category === "SIN_CATEGORIZAR" ? "var(--color-bg-warning)" : "var(--color-bg)",
                                  color: t.category === "SIN_CATEGORIZAR" ? "var(--color-warning)" : "var(--color-text)",
                                  fontSize: "var(--text-xs)",
                                  cursor: "pointer",
                                  maxWidth: "10rem",
                                }}
                              >
                                {Object.keys(CATEGORY_LABELS).map((c) => (
                                  <option key={c} value={c}>
                                    {CATEGORY_LABELS[c]}
                                  </option>
                                ))}
                              </select>
                              {t.id === lastChangedTxId && t.category !== "SIN_CATEGORIZAR" && (
                                <button
                                  type="button"
                                  onClick={() => setRuleCandidate({ tx: t, category: t.category })}
                                  aria-label={`Crear regla para que movimientos similares se categoricen como ${categoryLabel(t.category)}`}
                                  className="bank-link-button"
                                  style={{
                                    padding: "0.15rem 0.45rem",
                                    fontSize: "var(--text-xs)",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--color-primary)",
                                    background: "var(--color-bg)",
                                    color: "var(--color-primary)",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  + regla
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="sales-td sales-td-right">
                            <span
                              className="sales-price"
                              style={{ color: v >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
                            >
                              {formatEur(v)}
                            </span>
                          </td>
                          <td className="sales-td">
                            {linked ? (
                              <span
                                className="badge badge-success"
                                title="Vinculado a registro"
                                style={{ fontSize: "var(--text-xs)" }}
                              >
                                <span aria-hidden="true">✓ </span>vinculado
                              </span>
                            ) : isExpense ? (
                              <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() => setLinkingTx(t)}
                                  aria-label={`Vincular movimiento ${formatEur(v)} a compra`}
                                  className="bank-link-button"
                                  style={{
                                    padding: "0.2rem 0.5rem",
                                    fontSize: "var(--text-xs)",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--color-primary)",
                                    background: "var(--color-bg)",
                                    color: "var(--color-primary)",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    transition: "background var(--transition-fast), color var(--transition-fast)",
                                  }}
                                >
                                  Vincular →
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCreatingPurchaseTx(t)}
                                  aria-label={`Crear compra desde movimiento ${formatEur(v)}`}
                                  className="bank-link-button"
                                  style={{
                                    padding: "0.2rem 0.5rem",
                                    fontSize: "var(--text-xs)",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--color-border-medium)",
                                    background: "var(--color-bg)",
                                    color: "var(--color-text-secondary)",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    transition: "background var(--transition-fast), color var(--transition-fast)",
                                  }}
                                >
                                  + Compra
                                </button>
                              </div>
                            ) : (
                              <span className="muted" style={{ fontSize: "var(--text-xs)" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
