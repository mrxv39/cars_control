import { invoke } from "@tauri-apps/api/core";
import { StockVehicle } from "../types";

interface Props {
  stock: StockVehicle[];
  stockCount: string;
  thumbnails: Record<string, string | null>;
  onCreateVehicle: () => void;
  onEditVehicle: (vehicle: StockVehicle) => void;
  onReload: () => void;
}

export function StockView({
  stock,
  stockCount,
  thumbnails,
  onCreateVehicle,
  onEditVehicle,
  onReload,
}: Props) {
  async function openStockDataFolder() {
    try {
      const path = await invoke<string>("get_stock_folder_path");
      await invoke("open_folder", { path });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Stock</p>
          <h2>Vehículos en stock</h2>
          <p className="muted">{stockCount}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={() => void openStockDataFolder()}>
            Abrir carpeta de datos
          </button>
          <button type="button" className="button secondary" onClick={onCreateVehicle}>
            Añadir vehículo
          </button>
          <button type="button" className="button primary" onClick={onReload}>
            Recargar
          </button>
        </div>
      </header>
      {stock.length ? (
        <>
          {(() => {
            const sinFoto = stock.filter((v) => !thumbnails[v.folder_path]);
            const conFoto = stock.filter((v) => !!thumbnails[v.folder_path]);
            return (
              <>
                {sinFoto.length > 0 && (
                  <>
                    <p className="muted" style={{ margin: 0 }}>{sinFoto.length} sin foto</p>
                    <section className="stock-grid">
                      {sinFoto.map((vehicle) => (
                        <article
                          key={vehicle.folder_path}
                          className="vehicle-card vehicle-card-clickable"
                          onClick={() => onEditVehicle(vehicle)}
                        >
                          <div className="vehicle-copy">
                            <h3>{vehicle.name}</h3>
                            {vehicle.anio || vehicle.km ? (
                              <p className="muted">
                                {[vehicle.anio, vehicle.km ? `${vehicle.km.toLocaleString()} km` : null].filter(Boolean).join(" · ")}
                              </p>
                            ) : null}
                            {vehicle.precio_venta ? (
                              <p className="vehicle-price">{vehicle.precio_venta.toLocaleString("es-ES")} €</p>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </section>
                  </>
                )}
                {conFoto.length > 0 && (
                  <>
                    <p className="muted" style={{ margin: 0 }}>{conFoto.length} con foto</p>
                    <section className="stock-grid">
                      {conFoto.map((vehicle) => (
                        <article
                          key={vehicle.folder_path}
                          className="vehicle-card vehicle-card-clickable"
                          onClick={() => onEditVehicle(vehicle)}
                        >
                          <div className="thumb-frame">
                            <img src={thumbnails[vehicle.folder_path] ?? ""} alt={vehicle.name} className="thumb-image" />
                          </div>
                          <div className="vehicle-copy">
                            <h3>{vehicle.name}</h3>
                            {vehicle.anio || vehicle.km ? (
                              <p className="muted">
                                {[vehicle.anio, vehicle.km ? `${vehicle.km.toLocaleString()} km` : null].filter(Boolean).join(" · ")}
                              </p>
                            ) : null}
                            {vehicle.precio_venta ? (
                              <p className="vehicle-price">{vehicle.precio_venta.toLocaleString("es-ES")} €</p>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </section>
                  </>
                )}
              </>
            );
          })()}
        </>
      ) : (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin vehículos</p>
          <h2>La lista de stock está vacía</h2>
          <p className="muted">
            Usa `Añadir vehículo` para crear una carpeta nueva o `Abrir carpeta de datos` para gestionar manualmente `data/stock`.
          </p>
          <div className="actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="button primary" onClick={() => void openStockDataFolder()}>
              Abrir carpeta de datos
            </button>
            <button type="button" className="button secondary" onClick={onCreateVehicle}>
              Añadir vehículo
            </button>
            <button type="button" className="button secondary" onClick={onReload}>
              Recargar
            </button>
          </div>
        </section>
      )}
    </>
  );
}
