import { invoke } from "@tauri-apps/api/core";
import { SalesFolderNode } from "../types";

interface Props {
  salesHistory: SalesFolderNode[];
  salesRoot: string | null;
  salesMessage: string | null;
  onReload: () => void;
}

export function SalesView({ salesHistory, salesRoot, salesMessage, onReload }: Props) {
  const salesCountLabel = `${salesHistory.length} carpeta${salesHistory.length === 1 ? "" : "s"} de ventas`;

  function renderSalesTree(nodes: SalesFolderNode[], level = 0) {
    return (
      <div className="sales-tree">
        {nodes.map((node) => (
          <div key={node.folder_path} className="sales-node" style={{ marginLeft: `${level * 16}px` }}>
            <div className="sales-node-row">
              <div>
                <p className="record-title">{node.name}</p>
                <p className="muted">{node.folder_path}</p>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => void invoke("open_folder", { path: node.folder_path })}
              >
                Abrir carpeta
              </button>
            </div>
            {node.children.length ? renderSalesTree(node.children, level + 1) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Ventas históricas</p>
          <h2>Lectura desde docs_legacy</h2>
          <p className="muted">{salesCountLabel}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={onReload}>
            Recargar
          </button>
        </div>
      </header>
      <section className="panel info-strip">
        <div>
          <span className="field-label">Raíz legacy</span>
          <p>{salesRoot ?? "No disponible"}</p>
        </div>
      </section>
      {salesHistory.length ? (
        <section className="panel sales-panel">{renderSalesTree(salesHistory)}</section>
      ) : (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin ventas</p>
          <h2>No hay ventas históricas disponibles</h2>
          <p className="muted">
            {salesMessage ?? "No se encontraron carpetas de ventas en docs_legacy. La vista es solo lectura y muestra la estructura real encontrada."}
          </p>
          <div className="actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="button secondary" onClick={onReload}>
              Recargar
            </button>
          </div>
        </section>
      )}
    </>
  );
}
