import { FormEvent } from "react";
import { StockVehicleForm, StockModal as StockModalType } from "../types";

interface Props {
  modal: StockModalType;
  vehicleNameInput: string;
  setVehicleNameInput: (value: string) => void;
  stockVehicleForm: StockVehicleForm;
  setStockVehicleForm: (value: StockVehicleForm) => void;
  supplierInput: string;
  setSupplierInput: (value: string) => void;
  suppliers: string[];
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function StockModal({
  modal,
  vehicleNameInput,
  setVehicleNameInput,
  stockVehicleForm,
  setStockVehicleForm,
  supplierInput,
  setSupplierInput,
  suppliers,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  if (!modal) return null;

  const isCreate = modal.mode === "create";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card panel" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">{isCreate ? "Nuevo vehiculo" : "Editar vehiculo"}</p>
        <h3 className="modal-title">
          {isCreate ? "Añadir vehiculo al stock" : vehicleNameInput}
        </h3>
        <form className="config-box" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="vehicle-name">
            Marca y modelo *
          </label>
          <input
            id="vehicle-name"
            value={vehicleNameInput}
            onChange={(event) => setVehicleNameInput(event.currentTarget.value)}
            placeholder="Ej. SEAT Ibiza 1.0 MPI Style"
            autoFocus
          />

          {isCreate && (
            <>
              <label className="field-label" htmlFor="vehicle-supplier">
                Proveedor
              </label>
              <input
                id="vehicle-supplier"
                list="supplier-list"
                value={supplierInput}
                onChange={(event) => setSupplierInput(event.currentTarget.value)}
                placeholder="Ej. AUTO1, VW Renting, Particular..."
              />
              <datalist id="supplier-list">
                {suppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}

          {!isCreate && (
            <>
              <label className="field-label" htmlFor="vehicle-year">Año</label>
              <input
                id="vehicle-year" type="number"
                value={stockVehicleForm.anio || ""}
                onChange={(e) => setStockVehicleForm({ ...stockVehicleForm, anio: e.currentTarget.value ? parseInt(e.currentTarget.value) : null })}
                placeholder="2020" min="1900" max={new Date().getFullYear()}
              />
              <label className="field-label" htmlFor="vehicle-km">Kilometros</label>
              <input
                id="vehicle-km" type="number"
                value={stockVehicleForm.km || ""}
                onChange={(e) => setStockVehicleForm({ ...stockVehicleForm, km: e.currentTarget.value ? parseInt(e.currentTarget.value) : null })}
                placeholder="125000" min="0"
              />
              <label className="field-label" htmlFor="vehicle-precio-compra">Precio de compra</label>
              <input
                id="vehicle-precio-compra" type="number" step="100"
                value={stockVehicleForm.precio_compra || ""}
                onChange={(e) => setStockVehicleForm({ ...stockVehicleForm, precio_compra: e.currentTarget.value ? parseFloat(e.currentTarget.value) : null })}
                placeholder="8500" min="0"
              />
              <label className="field-label" htmlFor="vehicle-precio-venta">Precio de venta</label>
              <input
                id="vehicle-precio-venta" type="number" step="100"
                value={stockVehicleForm.precio_venta || ""}
                onChange={(e) => setStockVehicleForm({ ...stockVehicleForm, precio_venta: e.currentTarget.value ? parseFloat(e.currentTarget.value) : null })}
                placeholder="10500" min="0"
              />
              <label className="field-label" htmlFor="vehicle-ad-url">Enlace anuncio</label>
              <input
                id="vehicle-ad-url"
                value={stockVehicleForm.url}
                onChange={(e) => setStockVehicleForm({ ...stockVehicleForm, url: e.currentTarget.value })}
                placeholder="https://www.coches.net/..."
              />
              <label className="field-label" htmlFor="vehicle-estado">Estado</label>
              <select
                id="vehicle-estado"
                value={stockVehicleForm.estado || "disponible"}
                onChange={(e) => setStockVehicleForm({ ...stockVehicleForm, estado: e.currentTarget.value })}
              >
                <option value="disponible">Disponible</option>
                <option value="reservado">Reservado</option>
                <option value="vendido">Vendido</option>
              </select>
            </>
          )}

          <div className="actions">
            <button type="submit" className="button primary" disabled={submitting}>
              {submitting ? "Guardando..." : isCreate ? "Añadir" : "Guardar"}
            </button>
            <button type="button" className="button secondary" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
