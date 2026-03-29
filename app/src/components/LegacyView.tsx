import { invoke } from "@tauri-apps/api/core";
import { LegacyEntryNode } from "../types";

interface Props {
  fiscalEntries: LegacyEntryNode[];
  fiscalRoot: string | null;
  fiscalMessage: string | null;
  gastosEntries: LegacyEntryNode[];
  gastosRoot: string | null;
  gastosMessage: string | null;
  onReload: () => void;
}

export function LegacyView({
  fiscalEntries,
  fiscalRoot,
  fiscalMessage,
  gastosEntries,
  gastosRoot,
  gastosMessage,
  onReload,
}: Props) {
  const fiscalCountLabel = `${fiscalEntries.length} elemento${fiscalEntries.length === 1 ? "" : "s"} fiscales`;
  const gastosCountLabel = `${gastosEntries.length} elemento${gastosEntries.length === 1 ? "" : "s"} de gastos`;

  function renderLegacyTree(nodes: LegacyEntryNode[], level = 0) {
    return (
      <div className="sales-tree">
        {nodes.map((node) => (
          <div key={node.entry_path} className="sales-node" style={{ marginLeft: `${level * 16}px` }}>
            <div className="sales-node-row">
              <div>
                <p className="record-title">{node.name}</p>
                <p className="muted">{node.entry_path}</p>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => void invoke("open_folder", { path: node.open_path })}
              >
                {node.is_dir ? "Abrir carpeta" : "Abrir carpeta contenedora"}
              </button>
            </div>
            {node.children.length ? renderLegacyTree(node.children, level + 1) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Fiscal / Gastos</p>
          <h2>Lectura desde docs_legacy</h2>
          <p className="muted" role="status">
            {fiscalCountLabel} · {gastosCountLabel}
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={onReload}>
            Recargar
          </button>
        </div>
      </header>

      <section className="legacy-sections">
        <section className="panel sales-panel">
          <div className="legacy-section-header">
            <div>
              <p className="eyebrow">Fiscal</p>
              <h3>Carpetas y archivos reales</h3>
              <p className="muted">{fiscalRoot ?? "No disponible"}</p>
            </div>
          </div>
          {fiscalEntries.length ? (
            renderLegacyTree(fiscalEntries)
          ) : (
            <section className="setup-panel legacy-empty">
              <h3>No hay contenido fiscal disponible</h3>
              <p className="muted">
                {fiscalMessage ?? "No se encontró contenido fiscal en docs_legacy. La vista es solo lectura y abre carpetas reales."}
              </p>
            </section>
          )}
        </section>

        <section className="panel sales-panel">
          <div className="legacy-section-header">
            <div>
              <p className="eyebrow">Gastos</p>
              <h3>Carpetas y archivos reales</h3>
              <p className="muted">{gastosRoot ?? "No disponible"}</p>
            </div>
          </div>
          {gastosEntries.length ? (
            renderLegacyTree(gastosEntries)
          ) : (
            <section className="setup-panel legacy-empty">
              <h3>No hay contenido de gastos disponible</h3>
              <p className="muted">
                {gastosMessage ?? "No se encontró contenido de gastos en docs_legacy. La vista es solo lectura y abre carpetas reales."}
              </p>
            </section>
          )}
        </section>
      </section>
    </>
  );
}
