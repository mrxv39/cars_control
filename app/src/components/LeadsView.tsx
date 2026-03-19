import { Lead, StockVehicle, Client } from "../types";

interface Props {
  leads: Lead[];
  filteredLeads: Lead[];
  leadSearch: string;
  setLeadSearch: (value: string) => void;
  stock: StockVehicle[];
  clients: Client[];
  onCreateLead: () => void;
  onEditLead: (lead: Lead) => void;
  onConvertLead: (lead: Lead) => void;
  onDeleteLead: (id: number, name: string) => void;
  onReload: () => void;
}

export function LeadsView({
  leads,
  filteredLeads,
  leadSearch,
  setLeadSearch,
  stock,
  clients,
  onCreateLead,
  onEditLead,
  onConvertLead,
  onDeleteLead,
  onReload,
}: Props) {
  const leadClientMap = new Map(clients.map((client) => [client.id, client]));
  const vehicleMap = new Map(stock.map((vehicle) => [vehicle.folder_path, vehicle]));

  const leadsCountLabel =
    filteredLeads.length === leads.length
      ? `${leads.length} lead${leads.length === 1 ? "" : "s"} registrados`
      : `${filteredLeads.length} de ${leads.length} lead${leads.length === 1 ? "" : "s"} visibles`;

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Leads</p>
          <h2>Contactos previos a compra</h2>
          <p className="muted">{leadsCountLabel}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={onCreateLead}>
            Añadir lead
          </button>
          <button type="button" className="button primary" onClick={onReload}>
            Recargar
          </button>
        </div>
      </header>
      {leads.length ? (
        <>
          <section className="panel filter-panel">
            <label className="field-label" htmlFor="lead-search">
              Buscar lead
            </label>
            <input
              id="lead-search"
              value={leadSearch}
              onChange={(event) => setLeadSearch(event.currentTarget.value)}
              placeholder="Nombre, teléfono, interés o vehículo vinculado"
            />
          </section>
          {filteredLeads.length ? (
            <section className="record-grid">
              {filteredLeads.map((lead) => {
                const convertedClient = lead.converted_client_id ? leadClientMap.get(lead.converted_client_id) : null;
                const linkedVehicle = lead.vehicle_folder_path ? vehicleMap.get(lead.vehicle_folder_path) : null;
                return (
                  <article key={lead.id} className="record-card panel">
                    <div className="record-header">
                      <div>
                        <p className="record-title">{lead.name}</p>
                        <p className="muted">{lead.phone || "Sin teléfono"}</p>
                      </div>
                      <span className={convertedClient ? "badge badge-success" : "badge"}>{convertedClient ? "Convertido" : lead.estado || "Nuevo"}</span>
                    </div>
                    {lead.email ? <p className="record-line">{lead.email}</p> : null}
                    {lead.canal ? <p className="record-line">Canal: {lead.canal}</p> : null}
                    {lead.fecha_contacto ? <p className="record-line">Primer contacto: {lead.fecha_contacto}</p> : null}
                    {linkedVehicle ? <p className="record-line">Vehículo vinculado: {linkedVehicle.name}</p> : null}
                    {lead.vehicle_interest ? <p className="record-line">Interés libre: {lead.vehicle_interest}</p> : null}
                    {lead.notes ? <p className="record-notes">{lead.notes}</p> : null}
                    {convertedClient ? <p className="record-line">Client vinculado: {convertedClient.name}</p> : null}
                    <div className="vehicle-actions">
                      <button type="button" className="button primary" onClick={() => onEditLead(lead)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => onConvertLead(lead)}
                        disabled={Boolean(convertedClient)}
                      >
                        {convertedClient ? "Ya es client" : "Convertir en client"}
                      </button>
                      <button type="button" className="button danger" onClick={() => onDeleteLead(lead.id, lead.name)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="panel setup-panel">
              <p className="eyebrow">Sin coincidencias</p>
              <h2>No hay leads que coincidan</h2>
              <p className="muted">Prueba con otro nombre, teléfono o vehículo vinculado.</p>
            </section>
          )}
        </>
      ) : (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin leads</p>
          <h2>No hay contactos registrados</h2>
          <p className="muted">Añade aquí los contactos que llegan desde anuncios. Más adelante podrán relacionarse con ventas históricas.</p>
          <div className="actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="button primary" onClick={onCreateLead}>
              Añadir lead
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
