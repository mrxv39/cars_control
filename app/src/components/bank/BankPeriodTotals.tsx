import { formatEur } from "../bank-utils";

interface Totals {
  ingresos: number;
  gastos: number;
  neto: number;
}

export function BankPeriodTotals({ totals }: { totals: Totals }) {
  return (
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
  );
}
