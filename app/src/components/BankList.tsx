import { useState, useEffect, useMemo } from "react";
import * as api from "../lib/api";

// ============================================================
// BankList — vista del extracto bancario (Fase 1: solo lectura)
// ============================================================
// Validado con Ricard 2026-04-08:
//   3 cuentas (Personal, Autónomo, Póliza). La cuenta Personal está marcada
//   `is_personal=true` y NO entra en cómputos fiscales.
//
// Fase 1 (esta vista): selector de cuenta + tabla read-only de movimientos
// ya importados (vía script python scripts/import_n43.py).
// Fase 2: editor inline de categoría, vincular a compra/venta, "crear desde
// movimiento". Fase 3: conexión GoCardless + sync automático.
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

function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}

function formatEur(amount: number): string {
  return amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatDate(d: string): string {
  // Las fechas vienen como YYYY-MM-DD desde Postgres
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
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

  // Cargar cuentas al montar
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const accs = await api.listBankAccounts(companyId);
        if (cancelled) return;
        setAccounts(accs);
        // Selecciona "Autónomo" por defecto, si existe
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

  // Cargar movimientos cuando cambia la cuenta seleccionada o filtros
  useEffect(() => {
    if (selectedAccountId == null) {
      setTransactions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const txs = await api.listBankTransactions(selectedAccountId, {
          category: filterCategory || undefined,
          onlyUnlinked: onlyUnlinked || undefined,
          search: search.trim() || undefined,
        });
        if (cancelled) return;
        setTransactions(txs);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, filterCategory, onlyUnlinked, search]);

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

  const sinCategorizar = useMemo(
    () => transactions.filter((t) => t.category === "SIN_CATEGORIZAR").length,
    [transactions],
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

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
      <>
        <header className="hero">
          <div>
            <p className="eyebrow">Banco</p>
            <h2>No hay cuentas bancarias configuradas</h2>
            <p className="muted">
              Las cuentas se crean a mano en la BD durante la Fase 1. Habla con
              el equipo técnico si esto no debería estar vacío.
            </p>
          </div>
        </header>
      </>
    );
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Banco · CaixaBank</p>
          <h2>Movimientos bancarios</h2>
          <p className="muted">
            {transactions.length} movimiento{transactions.length !== 1 ? "s" : ""}
            {sinCategorizar > 0 && ` · ${sinCategorizar} sin categorizar`}
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

      {/* Resumen del periodo filtrado */}
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

      {/* Tabla de movimientos */}
      {transactions.length === 0 ? (
        <section className="panel">
          <p className="muted">
            Sin movimientos para los filtros actuales. Importa un fichero N43
            con <code>scripts/import_n43.py</code>.
          </p>
        </section>
      ) : (
        <section className="panel sales-records-panel">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th className="sales-th">Fecha</th>
                  <th className="sales-th">Descripción</th>
                  <th className="sales-th">Categoría</th>
                  <th className="sales-th sales-th-right">Importe</th>
                  <th className="sales-th">Vínculo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const v = Number(t.amount);
                  const linked = t.linked_purchase_id != null || t.linked_sale_id != null;
                  return (
                    <tr key={t.id} className="sales-row">
                      <td className="sales-td">{formatDate(t.booking_date)}</td>
                      <td
                        className="sales-td"
                        style={{ maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={t.description}
                      >
                        {t.description || <span className="muted">—</span>}
                      </td>
                      <td className="sales-td">
                        <span
                          className="badge"
                          style={{
                            background:
                              t.category === "SIN_CATEGORIZAR" ? "#fef3c7" : "#e0e7ff",
                            color:
                              t.category === "SIN_CATEGORIZAR" ? "#92400e" : "#3730a3",
                          }}
                        >
                          {categoryLabel(t.category)}
                        </span>
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
                          <span className="badge badge-success" title="Vinculado a registro">✓</span>
                        ) : (
                          <span className="muted" style={{ fontSize: "0.8rem" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
