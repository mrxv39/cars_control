import * as api from "../../../lib/api";
import { showToast } from "../../../lib/toast";
import { translateError } from "../../../lib/translateError";

const STATUS_ITEMS = [
  { key: "motor",      label: "Motor" },
  { key: "carroceria", label: "Plancha y pintura" },
  { key: "neumaticos", label: "Neumáticos" },
  { key: "itv",        label: "ITV" },
  { key: "limpieza",   label: "Limpieza" },
] as const;

type StatusKey = typeof STATUS_ITEMS[number]["key"];

function formatOkDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function VDVehicleStatus({ vehicle, suppliers, onUpdate }: {
  vehicle: api.Vehicle;
  suppliers: api.Supplier[];
  onUpdate: (updates: Partial<api.Vehicle>) => void;
}) {
  async function persist(updates: Partial<api.Vehicle>) {
    onUpdate(updates);
    try { await api.updateVehicle(vehicle.id, updates); }
    catch (err) { showToast(translateError(err), "error"); }
  }

  async function handleToggle(key: StatusKey) {
    const nowOk = !vehicle[`${key}_ok` as keyof api.Vehicle];
    const updates: Partial<api.Vehicle> = {
      [`${key}_ok`]: nowOk,
      [`${key}_ok_at`]: nowOk ? new Date().toISOString() : null,
    };
    await persist(updates);
  }

  async function handleSupplier(key: StatusKey, supplierId: number | null) {
    await persist({ [`${key}_supplier_id`]: supplierId });
  }

  async function handleNotes(key: StatusKey, notes: string) {
    await persist({ [`${key}_notes`]: notes || null });
  }

  const doneCount = STATUS_ITEMS.filter(({ key }) => vehicle[`${key}_ok` as keyof api.Vehicle]).length;

  return (
    <section className="panel vd-sidebar-panel">
      <div className="vd-section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p className="eyebrow" style={{ margin: 0 }}>Estado vehículo</p>
        <span className="vd-doc-completion-text">{doneCount}/{STATUS_ITEMS.length}</span>
      </div>
      <div className="vd-doc-completion" style={{ paddingTop: 0 }}>
        <div className="vd-doc-completion-bar">
          <div className="vd-doc-completion-fill" style={{ width: `${(doneCount / STATUS_ITEMS.length) * 100}%` }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {STATUS_ITEMS.map(({ key, label }) => {
          const isOk       = !!vehicle[`${key}_ok` as keyof api.Vehicle];
          const okAt       = vehicle[`${key}_ok_at` as keyof api.Vehicle] as string | null | undefined;
          const supplierId = vehicle[`${key}_supplier_id` as keyof api.Vehicle] as number | null;
          const notes      = (vehicle[`${key}_notes` as keyof api.Vehicle] as string | null) ?? "";
          const supplier   = suppliers.find((s) => s.id === supplierId);

          return (
            <div key={key} className="vd-status-item">
              <label className="vd-status-label">
                <input
                  type="checkbox"
                  checked={isOk}
                  onChange={() => void handleToggle(key)}
                  className="vd-status-check"
                />
                <span className={`vd-status-name${isOk ? " ok" : ""}`}>{label}</span>
                {isOk && okAt && (
                  <span className="vd-status-ok-meta">
                    {formatOkDate(okAt)}{supplier ? ` · ${supplier.name}` : ""}
                  </span>
                )}
              </label>
              {!isOk && (
                <div className="vd-status-details">
                  <textarea
                    className="vd-status-notes"
                    placeholder="Qué falla / qué hay que hacer"
                    defaultValue={notes}
                    onBlur={(e) => {
                      if (e.target.value !== notes) void handleNotes(key, e.target.value);
                    }}
                    rows={2}
                  />
                  <select
                    className="vd-status-supplier"
                    value={supplierId ?? ""}
                    onChange={(e) => void handleSupplier(key, e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Sin proveedor</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
