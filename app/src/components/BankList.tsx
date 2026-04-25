import { useState, useEffect, useMemo, useCallback } from "react";
import * as api from "../lib/api";
import { showToast } from "../lib/toast";
import { translateError } from "../lib/translateError";
import { LinkPurchaseModal } from "./LinkPurchaseModal";
import { LinkSaleModal } from "./LinkSaleModal";
import { CreatePurchaseModal } from "./CreatePurchaseModal";
import { CreateRuleModal } from "./CreateRuleModal";
import { CATEGORY_LABELS, CATEGORY_GROUPS, categoryLabel, formatEur, formatDate, monthOf, monthLabel, suggestPatternFromTx, periodRange } from "./bank-utils";
import { BankPeriodTotals } from "./bank/BankPeriodTotals";
import { BankCategoryBars } from "./bank/BankCategoryBars";

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
  const [refreshing, setRefreshing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [onlyUnlinked, setOnlyUnlinked] = useState(false);
  const [search, setSearch] = useState("");
  // Período temporal — audit M4. "all" mantiene el comportamiento anterior
  // (500 últimas). Presets pensados para la cadencia fiscal de Ricard (303/130).
  const [period, setPeriod] = useState<"all" | "this_month" | "this_quarter" | "this_year">("all");
  const [error, setError] = useState<string | null>(null);
  const [linkingTx, setLinkingTx] = useState<api.BankTransaction | null>(null);
  const [linkingSaleTx, setLinkingSaleTx] = useState<api.BankTransaction | null>(null);
  const [creatingPurchaseTx, setCreatingPurchaseTx] = useState<api.BankTransaction | null>(null);
  const [ruleCandidate, setRuleCandidate] = useState<{ tx: api.BankTransaction; category: string } | null>(null);
  // IDs categorizados manualmente en esta sesión — mantiene el CTA "+ regla"
  // visible en cada fila tocada hasta recargar, en vez de sólo en la última
  // (audit 2026-04-22: Ricard prefiere revisar en bloque y crear reglas al final).
  const [recentlyChangedIds, setRecentlyChangedIds] = useState<Set<number>>(new Set());

  // Audit 2026-04-20b M7: al categorizar manualmente un SIN_CATEGORIZAR, si hay
  // otros movimientos parecidos, ofrecemos aplicar el mismo cambio en bloque
  // sin tener que abrir el modal "+ regla" explícitamente. El modal sigue ahí
  // para quienes quieran además crear la regla persistente.
  const [propagateHint, setPropagateHint] = useState<{
    pattern: string;
    category: string;
    count: number;
    applying: boolean;
  } | null>(null);

  useEffect(() => {
    if (!propagateHint || propagateHint.applying) return;
    const t = setTimeout(() => setPropagateHint(null), 15000);
    return () => clearTimeout(t);
  }, [propagateHint]);

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
      const range = periodRange(period);
      const txs = await api.listBankTransactions(selectedAccountId, {
        category: filterCategory || undefined,
        onlyUnlinked: onlyUnlinked || undefined,
        search: search.trim() || undefined,
        fromDate: range?.from,
        toDate: range?.to,
      });
      setTransactions(txs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selectedAccountId, filterCategory, onlyUnlinked, search, period]);

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

  // Excluye SIN_CATEGORIZAR del denominador — si no, como suele sumar 10× lo de
  // cualquier otra categoría, aplastaba el resto a barras invisibles (audit M5).
  // La barra de SIN_CATEGORIZAR queda capada al 100% al renderizar.
  const maxCatTotal = useMemo(
    () => Math.max(1, ...byCategory.filter((c) => c.category !== "SIN_CATEGORIZAR").map((c) => c.total)),
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
    const wasUncategorized = tx.category === "SIN_CATEGORIZAR";
    try {
      await api.updateBankTransactionCategory(txId, category, true);
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, category, reviewed_by_user: true } : t)),
      );
      setRecentlyChangedIds((prev) => {
        const next = new Set(prev);
        if (category === "SIN_CATEGORIZAR") next.delete(txId);
        else next.add(txId);
        return next;
      });
      // Al sacar un movimiento de SIN_CATEGORIZAR, proponer aplicar el mismo
      // cambio a otros parecidos (sin abrir el modal "+ regla"). Fire-and-forget:
      // si el count falla o es 0, simplemente no aparece el banner.
      if (wasUncategorized && category !== "SIN_CATEGORIZAR" && category !== "IGNORAR") {
        const pattern = suggestPatternFromTx(tx.counterparty_name, tx.description);
        if (pattern.length >= 3) {
          void (async () => {
            try {
              const count = await api.countUncategorizedMatching(companyId, pattern);
              if (count > 0) setPropagateHint({ pattern, category, count, applying: false });
            } catch {
              /* silencioso — si falla, solo nos quedamos sin el atajo */
            }
          })();
        }
      }
    } catch (e) {
      console.error("Error al cambiar categoría:", e);
      showToast(translateError(e), "error");
    }
  }

  async function applyPropagateHint() {
    if (!propagateHint || propagateHint.applying) return;
    setPropagateHint({ ...propagateHint, applying: true });
    try {
      const n = await api.applyCategoryToUncategorizedMatching(companyId, propagateHint.pattern, propagateHint.category);
      showToast(`${n} movimiento${n !== 1 ? "s" : ""} categorizado${n !== 1 ? "s" : ""} como "${categoryLabel(propagateHint.category)}"`, "success");
      setPropagateHint(null);
      await reloadTransactions();
    } catch (e) {
      showToast(translateError(e), "error");
      setPropagateHint(propagateHint ? { ...propagateHint, applying: false } : null);
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
          onCreatePurchase={() => {
            const tx = linkingTx;
            setLinkingTx(null);
            setCreatingPurchaseTx(tx);
          }}
        />
      )}
      {linkingSaleTx && (
        <LinkSaleModal
          tx={linkingSaleTx}
          companyId={companyId}
          onClose={() => setLinkingSaleTx(null)}
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
          onCreated={() => {
            const txId = ruleCandidate.tx.id;
            setRecentlyChangedIds((prev) => {
              const next = new Set(prev);
              next.delete(txId);
              return next;
            });
            void reloadTransactions();
          }}
        />
      )}

      <header className="hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-md)", flexWrap: "wrap" }}>
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
        <button
          type="button"
          className="button secondary"
          onClick={async () => {
            setRefreshing(true);
            try { await reloadTransactions(); } finally { setRefreshing(false); }
          }}
          disabled={refreshing || selectedAccountId == null}
          aria-label="Recargar movimientos desde el servidor"
          title="Refresca los movimientos con los últimos datos de Supabase"
        >
          {refreshing ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
      </header>

      {/* Selector de cuenta */}
      <section className="panel" style={{ marginBottom: "1rem" }}>
        <div className="bank-account-picker">
          {accounts.map((acc) => {
            const isActive = acc.id === selectedAccountId;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedAccountId(acc.id)}
                aria-pressed={isActive}
                aria-label={`Cuenta ${acc.alias}, ${acc.account_type === "credit_line" ? "póliza de crédito" : "cuenta corriente"}${acc.is_personal ? ", personal" : ""}`}
                className="bank-account-chip"
                style={{
                  border: isActive ? "2px solid var(--color-primary)" : "2px solid var(--color-border-medium)",
                  background: isActive ? "var(--color-primary)" : "var(--color-bg)",
                  color: isActive ? "var(--color-bg)" : "var(--color-text-secondary)",
                }}
              >
                <span className="bank-account-chip-alias">{acc.alias}</span>
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
        {selectedAccount?.account_type === "credit_line" && (
          <p
            className="muted"
            style={{ marginTop: "var(--space-md)", color: "var(--color-warning)", fontSize: "var(--text-sm)" }}
          >
            <span aria-hidden="true">ℹ️ </span>Esta es una <b>póliza de crédito</b>. Los movimientos aquí
            (disposiciones, devoluciones, intereses) no son ingresos o gastos
            del negocio en sí — son flujos de la línea de crédito. El gasto
            fiscal real son los <b>intereses</b> cobrados por el banco, no el
            principal dispuesto.
          </p>
        )}
      </section>

      <BankPeriodTotals totals={totals} />

      <BankCategoryBars
        rows={byCategory}
        maxTotal={maxCatTotal}
        activeCategory={filterCategory}
        onToggle={(cat) => setFilterCategory(filterCategory === cat ? "" : cat)}
      />


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
            aria-label="Período"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
            style={{ padding: "var(--space-sm)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-medium)" }}
          >
            <option value="all">Todos los períodos</option>
            <option value="this_month">Este mes</option>
            <option value="this_quarter">Este trimestre</option>
            <option value="this_year">Este año</option>
          </select>
          <select
            aria-label="Filtrar por categoría"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: "var(--space-sm)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border-medium)" }}
          >
            <option value="">Todas las categorías</option>
            {CATEGORY_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.keys.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
                ))}
              </optgroup>
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

      {/* Propuesta de propagación tras categorizar (audit M7) */}
      {propagateHint && (
        <section
          className="panel"
          role="status"
          aria-live="polite"
          style={{
            marginBottom: "1rem",
            borderLeft: "4px solid var(--color-primary)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-sm)",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              Hay {propagateHint.count} movimiento{propagateHint.count !== 1 ? "s" : ""} sin categorizar con <b>"{propagateHint.pattern}"</b>
            </p>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "var(--text-xs)" }}>
              ¿Los marcamos también como <b>{categoryLabel(propagateHint.category)}</b>?
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button primary"
              onClick={() => void applyPropagateHint()}
              disabled={propagateHint.applying}
            >
              {propagateHint.applying ? "Aplicando…" : "Aplicar a todos"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setPropagateHint(null)}
              disabled={propagateHint.applying}
            >
              Solo este
            </button>
          </div>
        </section>
      )}

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
              <div className="bank-month-header">
                <h3 id={`bank-month-${yyyymm}`} style={{ margin: 0, fontSize: "1.05rem", textTransform: "capitalize", color: "var(--color-text)" }}>
                  {monthLabel(yyyymm)}
                </h3>
                <div className="bank-month-totals">
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
                <table className="sales-table" aria-labelledby={`bank-month-${yyyymm}`}>
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
                                {CATEGORY_GROUPS.map((g) => (
                                  <optgroup key={g.label} label={g.label}>
                                    {g.keys.map((c) => (
                                      <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              {recentlyChangedIds.has(t.id) && t.category !== "SIN_CATEGORIZAR" && (
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
                                  aria-label={`Asociar movimiento ${formatEur(v)} a una compra ya registrada`}
                                  title="Asociar este movimiento a una compra que ya tienes creada"
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
                                  }}
                                >
                                  Asociar a compra
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
                                  }}
                                >
                                  + Compra
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setLinkingSaleTx(t)}
                                aria-label={`Asociar ingreso ${formatEur(v)} a una venta ya registrada`}
                                title="Asociar este ingreso a una venta que ya tienes creada"
                                className="bank-link-button"
                                style={{
                                  padding: "0.2rem 0.5rem",
                                  fontSize: "var(--text-xs)",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--color-success)",
                                  background: "var(--color-bg)",
                                  color: "var(--color-success)",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Asociar a venta
                              </button>
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
