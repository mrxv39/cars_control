import { FormEvent } from "react";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { StockVehicle, LeadForm, LeadModal as LeadModalType } from "../types";

interface Props {
  modal: LeadModalType;
  leadForm: LeadForm;
  setLeadForm: (value: LeadForm) => void;
  selectedLeadVehicle: string;
  setSelectedLeadVehicle: (value: string) => void;
  stock: StockVehicle[];
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function LeadModal({
  modal,
  leadForm,
  setLeadForm,
  selectedLeadVehicle,
  setSelectedLeadVehicle,
  stock,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  useEscapeKey(!!modal, onClose);

  if (!modal) return null;

  function updateField<K extends keyof LeadForm>(field: K, value: LeadForm[K]) {
    setLeadForm({ ...leadForm, [field]: value });
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card panel" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">{modal.mode === "create" ? "Nuevo lead" : "Editar lead"}</p>
        <h3 className="modal-title">{modal.mode === "create" ? "Registrar lead" : "Actualizar lead"}</h3>
        <form className="config-box" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="lead-name">
            Nombre
          </label>
          <input
            id="lead-name"
            value={leadForm.name}
            onChange={(event) => updateField("name", event.currentTarget.value)}
            placeholder="Nombre del contacto"
            autoFocus
          />
          <label className="field-label" htmlFor="lead-phone">
            Teléfono
          </label>
          <input
            id="lead-phone"
            value={leadForm.phone}
            onChange={(event) => updateField("phone", event.currentTarget.value)}
            placeholder="600 123 123"
          />
          <label className="field-label" htmlFor="lead-email">
            Email
          </label>
          <input
            id="lead-email"
            value={leadForm.email}
            onChange={(event) => updateField("email", event.currentTarget.value)}
            placeholder="cliente@email.com"
          />
          <label className="field-label" htmlFor="lead-vehicle-select">
            Vehículo de interés
          </label>
          <select
            id="lead-vehicle-select"
            value={selectedLeadVehicle}
            onChange={(event) => setSelectedLeadVehicle(event.currentTarget.value)}
          >
            <option value="">Sin vincular</option>
            {stock.map((vehicle) => (
              <option key={vehicle.folder_path} value={vehicle.folder_path}>
                {vehicle.name}{vehicle.anio ? ` (${vehicle.anio})` : ""}{vehicle.km ? ` — ${vehicle.km.toLocaleString()} km` : ""}
              </option>
            ))}
          </select>
          <label className="field-label" htmlFor="lead-vehicle-interest">
            Texto libre interés
          </label>
          <input
            id="lead-vehicle-interest"
            value={leadForm.vehicle_interest}
            onChange={(event) => updateField("vehicle_interest", event.currentTarget.value)}
            placeholder="Seat Ibiza 4168LNZ"
          />
          <label className="field-label" htmlFor="lead-notes">
            Notas
          </label>
          <textarea
            id="lead-notes"
            value={leadForm.notes}
            onChange={(event) => updateField("notes", event.currentTarget.value)}
            placeholder="Cómo llegó, financiación, seguimiento..."
          />
          <label className="field-label" htmlFor="lead-estado">
            Estado del lead
          </label>
          <select
            id="lead-estado"
            value={leadForm.estado || "nuevo"}
            onChange={(event) => updateField("estado", event.currentTarget.value)}
          >
            <option value="nuevo">Nuevo</option>
            <option value="contactado">Contactado</option>
            <option value="negociando">Negociando</option>
            <option value="cerrado">Cerrado</option>
            <option value="perdido">Perdido</option>
          </select>
          <label className="field-label" htmlFor="lead-canal">
            Canal de contacto
          </label>
          <input
            id="lead-canal"
            value={leadForm.canal || ""}
            onChange={(event) => updateField("canal", event.currentTarget.value)}
            placeholder="Ej. Wallapop, coches.net, referido, etc."
          />
          <label className="field-label" htmlFor="lead-fecha-contacto">
            Fecha de primer contacto
          </label>
          <input
            id="lead-fecha-contacto"
            type="date"
            value={leadForm.fecha_contacto || ""}
            onChange={(event) => updateField("fecha_contacto", event.currentTarget.value)}
          />
          <div className="actions">
            <button type="submit" className="button primary" disabled={submitting}>
              {submitting ? "Guardando..." : modal.mode === "create" ? "Crear" : "Guardar"}
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
