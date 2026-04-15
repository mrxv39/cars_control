import { FormEvent, useEffect } from "react";
import { StockVehicle, ClientForm, ClientModal as ClientModalType } from "../types";

interface Props {
  modal: ClientModalType;
  clientForm: ClientForm;
  setClientForm: (value: ClientForm) => void;
  selectedClientVehicle: string;
  setSelectedClientVehicle: (value: string) => void;
  stock: StockVehicle[];
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function ClientModal({
  modal,
  clientForm,
  setClientForm,
  selectedClientVehicle,
  setSelectedClientVehicle,
  stock,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modal, onClose]);

  if (!modal) return null;

  const title =
    modal.mode === "edit" ? "Editar client" : modal.mode === "create" && "sourceLeadId" in modal ? "Conversión" : "Nuevo client";
  const formTitle = modal.mode === "edit" ? "Actualizar client" : "title" in modal ? modal.title || "Registrar client" : "Registrar client";
  const buttonLabel =
    modal.mode === "edit" ? "Guardar" : "sourceLeadId" in modal && modal.sourceLeadId ? "Convertir" : "Crear";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card panel" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">{title}</p>
        <h3 className="modal-title">{formTitle}</h3>
        <form className="config-box" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="client-name">
            Nombre
          </label>
          <input
            id="client-name"
            value={clientForm.name}
            onChange={(event) => setClientForm({ ...clientForm, name: event.currentTarget.value })}
            placeholder="Nombre del cliente"
            autoFocus
          />
          <label className="field-label" htmlFor="client-phone">
            Teléfono
          </label>
          <input
            id="client-phone"
            value={clientForm.phone}
            onChange={(event) => setClientForm({ ...clientForm, phone: event.currentTarget.value })}
            placeholder="600 123 123"
          />
          <label className="field-label" htmlFor="client-email">
            Email
          </label>
          <input
            id="client-email"
            value={clientForm.email}
            onChange={(event) => setClientForm({ ...clientForm, email: event.currentTarget.value })}
            placeholder="cliente@email.com"
          />
          <label className="field-label" htmlFor="client-dni">
            DNI / NIF
          </label>
          <input
            id="client-dni"
            value={clientForm.dni}
            onChange={(event) => setClientForm({ ...clientForm, dni: event.currentTarget.value })}
            placeholder="12345678A"
          />
          <label className="field-label" htmlFor="client-vehicle-select">
            Vehículo vinculado
          </label>
          <select
            id="client-vehicle-select"
            value={selectedClientVehicle}
            onChange={(event) => setSelectedClientVehicle(event.currentTarget.value)}
          >
            <option value="">Sin vincular</option>
            {stock.map((vehicle) => (
              <option key={vehicle.folder_path} value={vehicle.folder_path}>
                {vehicle.name}{vehicle.anio ? ` (${vehicle.anio})` : ""}{vehicle.km ? ` — ${vehicle.km.toLocaleString()} km` : ""}
              </option>
            ))}
          </select>
          <label className="field-label" htmlFor="client-notes">
            Notas
          </label>
          <textarea
            id="client-notes"
            value={clientForm.notes}
            onChange={(event) => setClientForm({ ...clientForm, notes: event.currentTarget.value })}
            placeholder="Datos de compra, financiación, observaciones..."
          />
          <div className="actions">
            <button type="submit" className="button primary" disabled={submitting}>
              {submitting ? "Guardando..." : buttonLabel}
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
