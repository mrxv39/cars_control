import { Client, StockVehicle, Lead } from "../types";

interface Props {
  clients: Client[];
  filteredClients: Client[];
  clientSearch: string;
  setClientSearch: (value: string) => void;
  stock: StockVehicle[];
  leads: Lead[];
  onCreateClient: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: number, name: string) => void;
  onReload: () => void;
}

export function ClientsView({
  clients,
  filteredClients,
  clientSearch,
  setClientSearch,
  stock,
  leads,
  onCreateClient,
  onEditClient,
  onDeleteClient,
  onReload,
}: Props) {
  const leadSourceMap = new Map(leads.map((lead) => [lead.id, lead]));
  const vehicleMap = new Map(stock.map((vehicle) => [vehicle.folder_path, vehicle]));

  const clientsCountLabel =
    filteredClients.length === clients.length
      ? `${clients.length} cliente${clients.length === 1 ? "" : "s"} registrado${clients.length === 1 ? "" : "s"}`
      : `${filteredClients.length} de ${clients.length} cliente${clients.length === 1 ? "" : "s"} visible${filteredClients.length === 1 ? "" : "s"}`;

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Clientes tras compra</h2>
          <p className="muted">{clientsCountLabel}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={onCreateClient}>
            Añadir client
          </button>
          <button type="button" className="button primary" onClick={onReload}>
            Recargar
          </button>
        </div>
      </header>
      {clients.length ? (
        <>
          <section className="panel filter-panel">
            <label className="field-label" htmlFor="client-search">
              Buscar client
            </label>
            <input
              id="client-search"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.currentTarget.value)}
              placeholder="Nombre, teléfono o vehículo vinculado"
            />
          </section>
          {filteredClients.length ? (
            <section className="record-grid">
              {filteredClients.map((client) => {
                const sourceLead = client.source_lead_id ? leadSourceMap.get(client.source_lead_id) : null;
                const linkedVehicle = client.vehicle_folder_path ? vehicleMap.get(client.vehicle_folder_path) : null;
                return (
                  <article key={client.id} className="record-card panel">
                    <div className="record-header">
                      <div>
                        <p className="record-title">{client.name}</p>
                        <p className="muted">{client.phone || "Sin teléfono"}</p>
                      </div>
                      <span className="badge badge-success">Client</span>
                    </div>
                    {client.email ? <p className="record-line">{client.email}</p> : null}
                    {client.dni ? <p className="record-line">DNI/NIF: {client.dni}</p> : null}
                    {linkedVehicle ? <p className="record-line">Vehículo vinculado: {linkedVehicle.name}</p> : null}
                    {client.notes ? <p className="record-notes">{client.notes}</p> : null}
                    {sourceLead ? <p className="record-line">Lead origen: {sourceLead.name}</p> : null}
                    <div className="vehicle-actions">
                      <button type="button" className="button primary" onClick={() => onEditClient(client)}>
                        Editar
                      </button>
                      <button type="button" className="button danger" onClick={() => onDeleteClient(client.id, client.name)}>
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
              <h2>No hay clients que coincidan</h2>
              <p className="muted">Prueba con otro nombre, teléfono o vehículo vinculado.</p>
            </section>
          )}
        </>
      ) : (
        <section className="panel setup-panel">
          <p className="eyebrow">Sin clients</p>
          <h2>No hay clientes registrados</h2>
          <p className="muted">Los leads pueden convertirse en client cuando se cierra una compra. También puedes crear un client manualmente.</p>
          <div className="actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="button primary" onClick={onCreateClient}>
              Añadir client
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
