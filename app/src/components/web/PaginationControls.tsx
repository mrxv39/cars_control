export function PaginationControls({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", alignItems: "center", padding: "1rem 0" }}>
      <button type="button" className="button secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} disabled={page === 0} onClick={() => setPage(page - 1)}>
        Anterior
      </button>
      <span className="muted" style={{ fontSize: "0.85rem" }}>
        Pagina {page + 1} de {totalPages}
      </span>
      <button type="button" className="button secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }} disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
        Siguiente
      </button>
    </div>
  );
}
