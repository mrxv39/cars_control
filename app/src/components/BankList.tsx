import { useState, useEffect, useMemo, useCallback } from "react";
import * as api from "../lib/api";

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

const CATEGORY_LABELS: Record<string, string> = {
  SIN_CATEGORIZAR: "Sin categorizar",
  COMPRA_VEHICULO: "Compra vehículo",
  VENTA_VEHICULO: "Venta vehículo",
  COBRO_FINANCIERA: "Cobro financiera",
  REPARACION: "Reparación",
  GESTORIA: "Gestoría",
  IMPUESTO_303: "Modelo 303 (IVA)",
  IMPUESTO_130: "Modelo 130 (IRPF)",
  IMPUESTO_OTRO: "Otro impuesto",
  AUTONOMO_CUOTA: "Cuota autónomo",
  SEGURO: "Seguro",
  ITV: "ITV",
  COMBUSTIBLE: "Combustible",
  TRANSPORTE: "Transporte",
  RECAMBIOS: "Recambios",
  NEUMATICOS: "Neumáticos",
  PUBLICIDAD: "Publicidad",
  SOFTWARE: "Software",
  COMISION_BANCO: "Comisión banco",
  TRASPASO_INTERNO: "Traspaso interno",
  RETIRO_PERSONAL: "Retiro personal",
  OTRO: "Otro",
};

const CATEGORY_COLOR: Record<string, string> = {
  COMPRA_VEHICULO: "#1d4ed8",
  VENTA_VEHICULO: "#16a34a",
  COBRO_FINANCIERA: "#0891b2",
  GESTORIA: "#7c3aed",
  REPARACION: "#ea580c",
  IMPUESTO_303: "#dc2626",
  IMPUESTO_130: "#b91c1c",
  IMPUESTO_OTRO: "#991b1b",
  AUTONOMO_CUOTA: "#9333ea",
  SEGURO: "#0d9488",
  ITV: "#65a30d",
  COMBUSTIBLE: "#f59e0b",
  RECAMBIOS: "#ca8a04",
  NEUMATICOS: "#a16207",
  TRANSPORTE: "#0369a1",
  PUBLICIDAD: "#db2777",
  COMISION_BANCO: "#475569",
  TRASPASO_INTERNO: "#64748b",
  SIN_CATEGORIZAR: "#fbbf24",
  OTRO: "#94a3b8",
};

function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}

function categoryColor(c: string): string {
  return CATEGORY_COLOR[c] ?? "#94a3b8";
}

function formatEur(amount: number): string {
  return amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function monthOf(d: string): string {
  // d = YYYY-MM-DD → "YYYY-MM"
  return d.slice(0, 7);
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// ============================================================
// Modal: vincular movimiento a purchase_record existente
// ============================================================
function LinkPurchaseModal({
  tx,
  companyId,
  onClose,
  onLinked,
}: {
  tx: api.BankTransaction;
  companyId: number;
  onClose: () => void;
  onLinked: () => void;
}) {
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

  async function doLink(purchaseId: number) {
    setLinking(purchaseId);
    try {
      await api.linkTransactionToPurchase(tx.id, purchaseId);
      onLinked();
      onClose();
    } catch (e) {
      alert("Error al vincular: " + (e as Error).message);
    } finally {
      setLinking(null);
    }
  }

  return (
    <div
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
            <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.1rem" }}>
              {formatDate(tx.booking_date)} · {formatEur(Number(tx.amount))}
            </h3>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
              {tx.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
          🔍 Mostrando compras del rango <b>±15 días</b> con importe ≈ <b>{formatEur(Math.abs(Number(tx.amount)))}</b>
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

// ============================================================
// BankList principal
// ============================================================
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
    try {
      await api.updateBankTransactionCategory(txId, category, true);
      // Optimista: actualiza local y recarga
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, category, reviewed_by_user: true } : t)),
      );
    } catch (e) {
      alert("Error al cambiar categoría: " + (e as Error).message);
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
      <section className="panel" style={{ borderLeft: "4px solid #b91c1c" }}>
        <p style={{ color: "#b91c1c" }}>Error: {error}</p>
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
            Las cuentas se crean a mano en la BD durante la Fase 1.
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

      <header className="hero">
        <div>
          <p className="eyebrow">Banco · CaixaBank</p>
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
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: 8,
                  border: isActive ? "2px solid #1d4ed8" : "2px solid #cbd5e1",
                  background: isActive ? "#1d4ed8" : "#fff",
                  color: isActive ? "#fff" : "#475569",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "0.15rem",
                }}
              >
                <span>{acc.alias}</span>
                <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>
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
            style={{ marginTop: "0.75rem", color: "#b45309", fontSize: "0.85rem" }}
          >
            ⚠️ Esta cuenta está marcada como <b>personal</b>. Sus movimientos no se
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
          <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#16a34a" }}>
            {formatEur(totals.ingresos)}
          </p>
        </div>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>Gastos</p>
          <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#dc2626" }}>
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
              color: totals.neto >= 0 ? "#16a34a" : "#dc2626",
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
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() =>
                    setFilterCategory(filterCategory === c.category ? "" : c.category)
                  }
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
                        fontSize: "0.8rem",
                        fontWeight: filterCategory === c.category ? 700 : 500,
                        color: filterCategory === c.category ? "#1d4ed8" : "#475569",
                      }}
                    >
                      {categoryLabel(c.category)} · {c.count}
                    </span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b" }}>
                      {formatEur(c.total)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "#f1f5f9",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: categoryColor(c.category),
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          {filterCategory && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 240px", padding: "0.5rem", borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            <option value="">Todas las categorías</option>
            {Object.keys(CATEGORY_LABELS).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", fontSize: "0.85rem" }}>
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
            Sin movimientos para los filtros actuales. Importa un fichero N43
            con <code>scripts/import_n43.py</code>.
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
                  marginBottom: "0.75rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1.05rem", textTransform: "capitalize", color: "#1e293b" }}>
                  {monthLabel(yyyymm)}
                </h3>
                <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.85rem" }}>
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>
                    + {formatEur(monthIngresos)}
                  </span>
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>
                    {formatEur(monthGastos)}
                  </span>
                  <span
                    style={{
                      color: monthIngresos + monthGastos >= 0 ? "#16a34a" : "#dc2626",
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
                          <td className="sales-td" style={{ fontSize: "0.8rem", color: "#64748b" }}>
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
                            <select
                              value={t.category}
                              onChange={(e) => void changeCategory(t.id, e.target.value)}
                              style={{
                                padding: "0.2rem 0.4rem",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                background: t.category === "SIN_CATEGORIZAR" ? "#fef3c7" : "#fff",
                                color: t.category === "SIN_CATEGORIZAR" ? "#92400e" : "#1e293b",
                                fontSize: "0.78rem",
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
                          </td>
                          <td className="sales-td sales-td-right">
                            <span
                              className="sales-price"
                              style={{ color: v >= 0 ? "#16a34a" : "#dc2626" }}
                            >
                              {formatEur(v)}
                            </span>
                          </td>
                          <td className="sales-td">
                            {linked ? (
                              <span
                                className="badge badge-success"
                                title="Vinculado a registro"
                                style={{ fontSize: "0.75rem" }}
                              >
                                ✓ vinculado
                              </span>
                            ) : isExpense ? (
                              <button
                                type="button"
                                onClick={() => setLinkingTx(t)}
                                style={{
                                  padding: "0.2rem 0.5rem",
                                  fontSize: "0.72rem",
                                  borderRadius: 4,
                                  border: "1px solid #1d4ed8",
                                  background: "#fff",
                                  color: "#1d4ed8",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Vincular →
                              </button>
                            ) : (
                              <span className="muted" style={{ fontSize: "0.72rem" }}>—</span>
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
