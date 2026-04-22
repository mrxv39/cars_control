import { categoryColor, categoryLabel, formatEur } from "../bank-utils";

interface CategoryRow {
  category: string;
  count: number;
  total: number;
}

interface Props {
  rows: CategoryRow[];
  maxTotal: number;
  activeCategory: string;
  onToggle: (category: string) => void;
}

export function BankCategoryBars({ rows, maxTotal, activeCategory, onToggle }: Props) {
  if (rows.length === 0) return null;
  return (
    <section className="panel" style={{ marginBottom: "1rem" }}>
      <p className="eyebrow" style={{ margin: 0, marginBottom: "0.75rem" }}>
        Distribución por categoría
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {rows.map((c) => {
          const pct = Math.min(100, (c.total / maxTotal) * 100);
          const isActive = activeCategory === c.category;
          return (
            <button
              key={c.category}
              type="button"
              aria-pressed={isActive}
              aria-label={`Filtrar por ${categoryLabel(c.category)}: ${c.count} movimientos, total ${formatEur(c.total)}`}
              onClick={() => onToggle(c.category)}
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
      {activeCategory && (
        <p style={{ marginTop: "var(--space-sm)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
          Filtro activo · click otra vez en la categoría para quitar
        </p>
      )}
    </section>
  );
}
