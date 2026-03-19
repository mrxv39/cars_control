import React, { FormEvent, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ViewKey,
  StockVehicle,
  Lead,
  Client,
  LeadForm,
  ClientForm,
  StockVehicleForm,
  StockModal,
  LeadModal,
  ClientModal,
  SalesRecord,
  PurchaseRecord,
  LoginResult,
  EMPTY_LEAD_FORM,
  EMPTY_CLIENT_FORM,
  EMPTY_STOCK_VEHICLE_FORM,
} from "./types";
import { useAppState } from "./hooks/useAppState";
import { DashboardView } from "./components/DashboardView";
import { StockView } from "./components/StockView";
import { LeadsView } from "./components/LeadsView";
import { ClientsView } from "./components/ClientsView";
import { SalesView } from "./components/SalesView";
import { LegacyView } from "./components/LegacyView";
import { RemindersView } from "./components/RemindersView";
import { SalesRecordsView } from "./components/SalesRecordsView";
import { PurchasesView } from "./components/PurchasesView";
import { SuppliersView } from "./components/SuppliersView";
import { StockModal as StockModalComponent } from "./components/StockModal";
import { StockDetailView } from "./components/StockDetailView";
import { LeadModal as LeadModalComponent } from "./components/LeadModal";
import { ClientModal as ClientModalComponent } from "./components/ClientModal";
import "./App.css";

const NAV_ITEMS: Array<{ key: ViewKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "stock", label: "Stock" },
  { key: "sales_records", label: "Ventas" },
  { key: "purchases", label: "Compras" },
  { key: "suppliers", label: "Proveedores" },
  { key: "legacy", label: "Fiscal / Gastos" },
  { key: "leads", label: "Leads" },
  { key: "clients", label: "Clientes" },
  { key: "reminders", label: "Recordatorios" },
  { key: "sales", label: "Ventas Legacy" },
];

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase();
}

function App() {
  const [session, setSession] = useState<LoginResult | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const result = await invoke<LoginResult>("login", { username: loginUsername, password: loginPassword });
      setSession(result);
    } catch (err) {
      setLoginError(String(err));
    } finally {
      setLoginSubmitting(false);
    }
  }

  if (!session) {
    return (
      <main className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <section className="panel" style={{ maxWidth: 400, width: "100%", padding: "2rem" }}>
          <p className="eyebrow">Cars Control</p>
          <h1 style={{ marginBottom: "0.5rem" }}>Iniciar sesion</h1>
          <p className="muted" style={{ marginBottom: "1.5rem" }}>Introduce tus credenciales para acceder a la aplicacion.</p>
          <form onSubmit={(e) => void handleLogin(e)}>
            <div style={{ marginBottom: "1rem" }}>
              <label className="field-label" htmlFor="login-user">Usuario</label>
              <input
                id="login-user"
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Usuario"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label className="field-label" htmlFor="login-pass">Contrasena</label>
              <input
                id="login-pass"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Contrasena"
              />
            </div>
            {loginError && <p className="error-banner" style={{ marginBottom: "1rem" }}>{loginError}</p>}
            <button type="submit" className="button primary" style={{ width: "100%" }} disabled={loginSubmitting}>
              {loginSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return <AuthenticatedApp session={session} onLogout={() => setSession(null)} />;
}

function AuthenticatedApp({ session, onLogout }: { session: LoginResult; onLogout: () => void }) {
  const { appState, loading, error: appError, loadState } = useAppState();
  const [currentView, setCurrentView] = useState<ViewKey>("dashboard");
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [stockModal, setStockModal] = useState<StockModal>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<StockVehicle | null>(null);
  const [leadModal, setLeadModal] = useState<LeadModal>(null);
  const [clientModal, setClientModal] = useState<ClientModal>(null);
  const [vehicleNameInput, setVehicleNameInput] = useState("");
  const [supplierInput, setSupplierInput] = useState("");
  const [leadForm, setLeadForm] = useState<LeadForm>(EMPTY_LEAD_FORM);
  const [clientForm, setClientForm] = useState<ClientForm>(EMPTY_CLIENT_FORM);
  const [selectedLeadVehicle, setSelectedLeadVehicle] = useState("");
  const [selectedClientVehicle, setSelectedClientVehicle] = useState("");
  const [stockVehicleForm, setStockVehicleForm] = useState<StockVehicleForm>(EMPTY_STOCK_VEHICLE_FORM);
  const [leadSearch, setLeadSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);

  // Load sales records and purchase records
  React.useEffect(() => {
    void (async () => {
      try {
        const records = await invoke<SalesRecord[]>("get_sales_records");
        setSalesRecords(records);
      } catch (err) {
        console.error("Error loading sales records:", err);
      }
    })();
    void (async () => {
      try {
        const records = await invoke<PurchaseRecord[]>("get_purchase_records");
        setPurchaseRecords(records);
      } catch (err) {
        console.error("Error loading purchase records:", err);
      }
    })();
  }, []);

  // Load thumbnails when stock changes
  React.useEffect(() => {
    if (!appState?.stock.length) return;
    const missing = appState.stock.filter((vehicle) => !(vehicle.folder_path in thumbnails));
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async (vehicle) => {
        try {
          return [
            vehicle.folder_path,
            await invoke<string | null>("get_vehicle_thumbnail", { folderPath: vehicle.folder_path }),
          ] as const;
        } catch {
          return [vehicle.folder_path, null] as const;
        }
      }),
    ).then((updates) => {
      if (cancelled) return;
      setThumbnails((current) => Object.fromEntries([...Object.entries(current), ...updates]));
    });
    return () => {
      cancelled = true;
    };
  }, [appState?.stock, thumbnails]);

  const filteredLeads = useMemo(() => {
    if (!appState) return [];
    const query = normalizeSearchValue(leadSearch.trim());
    if (!query) return appState.leads;
    const vehicleNames = new Map(appState.stock.map((vehicle) => [vehicle.folder_path, normalizeSearchValue(vehicle.name)]));
    return appState.leads.filter((lead) =>
      [
        lead.name,
        lead.phone,
        lead.vehicle_interest,
        lead.vehicle_folder_path ? vehicleNames.get(lead.vehicle_folder_path) ?? "" : "",
      ].some((value) => normalizeSearchValue(value).includes(query)),
    );
  }, [appState, leadSearch]);

  const filteredClients = useMemo(() => {
    if (!appState) return [];
    const query = normalizeSearchValue(clientSearch.trim());
    if (!query) return appState.clients;
    const vehicleNames = new Map(appState.stock.map((vehicle) => [vehicle.folder_path, normalizeSearchValue(vehicle.name)]));
    return appState.clients.filter((client) =>
      [
        client.name,
        client.phone,
        client.vehicle_folder_path ? vehicleNames.get(client.vehicle_folder_path) ?? "" : "",
      ].some((value) => normalizeSearchValue(value).includes(query)),
    );
  }, [appState, clientSearch]);

  function closeAllModals() {
    setStockModal(null);
    setLeadModal(null);
    setClientModal(null);
    setVehicleNameInput("");
    setSupplierInput("");
    setLeadForm(EMPTY_LEAD_FORM);
    setClientForm(EMPTY_CLIENT_FORM);
    setSelectedLeadVehicle("");
    setSelectedClientVehicle("");
    setStockVehicleForm(EMPTY_STOCK_VEHICLE_FORM);
  }

  function openCreateLeadModal() {
    setError(null);
    setLeadForm(EMPTY_LEAD_FORM);
    setSelectedLeadVehicle("");
    setLeadModal({ mode: "create" });
  }

  function openEditLeadModal(lead: Lead) {
    setError(null);
    setLeadForm({ name: lead.name, phone: lead.phone, email: lead.email, notes: lead.notes, vehicle_interest: lead.vehicle_interest });
    setSelectedLeadVehicle(lead.vehicle_folder_path ?? "");
    setLeadModal({ mode: "edit", lead });
  }

  function openCreateClientModal() {
    setError(null);
    setClientForm(EMPTY_CLIENT_FORM);
    setSelectedClientVehicle("");
    setClientModal({ mode: "create" });
  }

  function openEditClientModal(client: Client) {
    setError(null);
    setClientForm({ name: client.name, phone: client.phone, email: client.email, dni: client.dni, notes: client.notes });
    setSelectedClientVehicle(client.vehicle_folder_path ?? "");
    setClientModal({ mode: "edit", client });
  }

  function openConvertLeadModal(lead: Lead) {
    setError(null);
    setClientForm({ name: lead.name, phone: lead.phone, email: lead.email, dni: "", notes: lead.notes });
    setSelectedClientVehicle(lead.vehicle_folder_path ?? "");
    setClientModal({ mode: "create", sourceLeadId: lead.id, title: "Convertir lead en client" });
  }

  async function exportData() {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await invoke<{ export_path: string; included_files: string[] }>("export_app_data");
      setSuccessMessage(`Copia exportada en ${result.export_path}`);
    } catch (exportError) {
      setError(String(exportError));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockModal) return;
    setSubmitting(true);
    setError(null);
    try {
      let savedVehicle: StockVehicle;
      if (stockModal.mode === "create") {
        savedVehicle = await invoke<StockVehicle>("create_vehicle", { name: vehicleNameInput });
      } else {
        savedVehicle = await invoke<StockVehicle>("rename_vehicle", { folderPath: stockModal.vehicle.folder_path, newName: vehicleNameInput });
      }
      await invoke("set_vehicle_ad", { folderPath: savedVehicle.folder_path, input: stockVehicleForm });
      setThumbnails({});
      closeAllModals();
      await loadState();
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leadModal) return;
    setSubmitting(true);
    setError(null);
    try {
      if (leadModal.mode === "create") {
        await invoke("create_lead", { input: { ...leadForm, vehicleFolderPath: selectedLeadVehicle || null } });
      } else {
        await invoke("update_lead", { id: leadModal.lead.id, input: { ...leadForm, vehicleFolderPath: selectedLeadVehicle || null } });
      }
      closeAllModals();
      await loadState();
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientModal) return;
    setSubmitting(true);
    setError(null);
    try {
      if (clientModal.mode === "edit") {
        await invoke("update_client", { id: clientModal.client.id, input: { ...clientForm, vehicleFolderPath: selectedClientVehicle || null } });
      } else if ("sourceLeadId" in clientModal && clientModal.sourceLeadId) {
        await invoke("convert_lead_to_client", { leadId: clientModal.sourceLeadId, input: { ...clientForm, vehicleFolderPath: selectedClientVehicle || null } });
      } else {
        await invoke("create_client", { input: { ...clientForm, vehicleFolderPath: selectedClientVehicle || null } });
      }
      closeAllModals();
      await loadState();
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete(kind: "vehicle" | "lead" | "client" | "sales_record" | "purchase_record", idOrPath: number | string, name: string) {
    const message =
      kind === "vehicle"
        ? `¿Eliminar ${name}? Se borrará la carpeta y todo su contenido.`
        : kind === "lead"
          ? `¿Eliminar el lead ${name}? Se perderá el historial de contacto guardado.`
          : kind === "client"
            ? `¿Eliminar el client ${name}? El lead original, si existe, dejará de estar enlazado.`
            : kind === "purchase_record"
              ? `¿Eliminar el registro de compra ${name}?`
              : `¿Eliminar el registro de venta ${name}?`;
    if (!window.confirm(message)) return;
    setSubmitting(true);
    setError(null);
    try {
      if (kind === "vehicle") {
        await invoke("delete_vehicle", { folderPath: idOrPath });
        setThumbnails((current) => {
          const next = { ...current };
          delete next[String(idOrPath)];
          return next;
        });
      }
      if (kind === "lead") await invoke("delete_lead", { id: idOrPath });
      if (kind === "client") await invoke("delete_client", { id: idOrPath });
      if (kind === "sales_record") {
        await invoke("delete_sales_record", { recordId: idOrPath });
        setSalesRecords((current) => current.filter((r) => r.id !== idOrPath));
      }
      if (kind === "purchase_record") {
        await invoke("delete_purchase_record", { recordId: idOrPath });
        setPurchaseRecords((current) => current.filter((r) => r.id !== idOrPath));
      }
      await loadState();
    } catch (deleteError) {
      setError(String(deleteError));
    } finally {
      setSubmitting(false);
    }
  }

  // Display error state
  const displayError = error || appError;

  if (loading) {
    return (
      <main className="shell">
        <section className="panel status-panel">
          <p className="eyebrow">Cars Control</p>
          <h1>Cargando</h1>
          <p className="muted">Leyendo stock, leads y clients desde la carpeta de datos de la app.</p>
        </section>
      </main>
    );
  }

  if (!appState) {
    return (
      <main className="shell">
        <section className="panel status-panel">
          <p className="eyebrow">Cars Control</p>
          <h1>Error al cargar</h1>
          <p className="muted">No se pudo leer el estado de la aplicación.</p>
          {displayError ? <p className="error-banner" style={{ marginTop: "1rem" }}>{displayError}</p> : null}
          <div className="actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="button primary" onClick={() => void loadState()}>
              Reintentar
            </button>
          </div>
        </section>
      </main>
    );
  }

  const stockCountLabel = `${appState.stock.length} vehículo${appState.stock.length === 1 ? "" : "s"} en stock`;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Cars Control</p>
          <h1 className="sidebar-title">{session.company.trade_name}</h1>
          <p className="muted">{session.user.full_name} ({session.user.role})</p>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={currentView === item.key ? "nav-item active" : "nav-item"}
              onClick={() => setCurrentView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-tools panel">
          <p className="field-label">Datos</p>
          <button type="button" className="button secondary" onClick={() => void exportData()} disabled={submitting} style={{ width: "100%", marginBottom: "0.5rem" }}>
            {submitting ? "Exportando..." : "Exportar datos"}
          </button>
          <button type="button" className="button danger" onClick={onLogout} style={{ width: "100%" }}>
            Cerrar sesion
          </button>
        </div>
      </aside>
      <section className="content">
        {currentView === "dashboard" && (
          <DashboardView stock={appState.stock} leads={appState.leads} onReload={() => void loadState()} />
        )}

        {currentView === "stock" && !selectedVehicle && (
          <StockView
            stock={appState.stock}
            stockCount={stockCountLabel}
            thumbnails={thumbnails}
            onCreateVehicle={() => {
              setVehicleNameInput("");
              setStockVehicleForm(EMPTY_STOCK_VEHICLE_FORM);
              setStockModal({ mode: "create" });
            }}
            onEditVehicle={(vehicle) => setSelectedVehicle(vehicle)}
            onReload={() => void loadState()}
          />
        )}

        {currentView === "stock" && selectedVehicle && (
          <StockDetailView
            vehicle={selectedVehicle}
            thumbnail={thumbnails[selectedVehicle.folder_path] ?? null}
            submitting={submitting}
            onSave={async (vehicleName, form) => {
              setSubmitting(true);
              try {
                const saved = await invoke<StockVehicle>("rename_vehicle", { folderPath: selectedVehicle.folder_path, newName: vehicleName });
                await invoke("set_vehicle_ad", { folderPath: saved.folder_path, input: form });
                setSelectedVehicle(null);
                setThumbnails({});
                await loadState();
              } finally {
                setSubmitting(false);
              }
            }}
            onDelete={(folderPath, name) => {
              void confirmDelete("vehicle", folderPath, name);
              setSelectedVehicle(null);
            }}
            onBack={() => setSelectedVehicle(null)}
          />
        )}

        {currentView === "sales" && (
          <SalesView
            salesHistory={appState.sales_history}
            salesRoot={appState.sales_root}
            salesMessage={appState.sales_message}
            onReload={() => void loadState()}
          />
        )}

        {currentView === "legacy" && (
          <LegacyView
            fiscalEntries={appState.fiscal_entries}
            fiscalRoot={appState.fiscal_root}
            fiscalMessage={appState.fiscal_message}
            gastosEntries={appState.gastos_entries}
            gastosRoot={appState.gastos_root}
            gastosMessage={appState.gastos_message}
            onReload={() => void loadState()}
          />
        )}

        {currentView === "leads" && (
          <LeadsView
            leads={appState.leads}
            filteredLeads={filteredLeads}
            leadSearch={leadSearch}
            setLeadSearch={setLeadSearch}
            stock={appState.stock}
            clients={appState.clients}
            onCreateLead={openCreateLeadModal}
            onEditLead={openEditLeadModal}
            onConvertLead={openConvertLeadModal}
            onDeleteLead={(id, name) => void confirmDelete("lead", id, name)}
            onReload={() => void loadState()}
          />
        )}

        {currentView === "clients" && (
          <ClientsView
            clients={appState.clients}
            filteredClients={filteredClients}
            clientSearch={clientSearch}
            setClientSearch={setClientSearch}
            stock={appState.stock}
            leads={appState.leads}
            onCreateClient={openCreateClientModal}
            onEditClient={openEditClientModal}
            onDeleteClient={(id, name) => void confirmDelete("client", id, name)}
            onReload={() => void loadState()}
          />
        )}

        {currentView === "reminders" && (
          <RemindersView
            leads={appState.leads}
            stock={appState.stock}
            onEditLead={openEditLeadModal}
            onReload={() => void loadState()}
          />
        )}

        {currentView === "sales_records" && (
          <SalesRecordsView
            records={salesRecords}
            stock={appState.stock}
            clients={appState.clients}
            onReload={() => {
              void loadState();
              setSalesRecords([]);
              void (async () => {
                const records = await invoke<SalesRecord[]>("get_sales_records");
                setSalesRecords(records);
              })();
            }}
            onAddRecord={async (vehicleFolderPath, clientId, priceFinal, notes) => {
              const record = await invoke<SalesRecord>("add_sales_record", {
                vehicleFolderPath,
                clientId: clientId || null,
                leadId: null,
                priceFinal,
                notes,
              });
              setSalesRecords((prev) => [record, ...prev]);
            }}
            onDeleteRecord={(id) => void confirmDelete("sales_record", id, `Registro de venta ${id}`)}
            submitting={submitting}
          />
        )}

        {currentView === "purchases" && (
          <PurchasesView
            records={purchaseRecords}
            stock={appState.stock}
            onReload={() => {
              void loadState();
              setPurchaseRecords([]);
              void (async () => {
                const records = await invoke<PurchaseRecord[]>("get_purchase_records");
                setPurchaseRecords(records);
              })();
            }}
            onAddRecord={async (expenseType, vehicleFolderPath, vehicleName, plate, supplierName, purchaseDate, purchasePrice, invoiceNumber, paymentMethod, notes, sourceFile) => {
              const record = await invoke<PurchaseRecord>("add_purchase_record", {
                expenseType,
                vehicleFolderPath,
                vehicleName,
                plate,
                supplierName,
                purchaseDate,
                purchasePrice,
                invoiceNumber,
                paymentMethod,
                notes,
                sourceFile,
              });
              setPurchaseRecords((prev) => [record, ...prev]);
            }}
            onDeleteRecord={(id) => void confirmDelete("purchase_record", id, `Registro de compra ${id}`)}
            submitting={submitting}
          />
        )}

        {currentView === "suppliers" && (
          <SuppliersView
            records={purchaseRecords}
            onReload={() => {
              void loadState();
              setPurchaseRecords([]);
              void (async () => {
                const records = await invoke<PurchaseRecord[]>("get_purchase_records");
                setPurchaseRecords(records);
              })();
            }}
          />
        )}

        {displayError ? <p className="error-banner">{displayError}</p> : null}
        {successMessage ? <p className="success-banner">{successMessage}</p> : null}
      </section>

      <StockModalComponent
        modal={stockModal}
        vehicleNameInput={vehicleNameInput}
        setVehicleNameInput={setVehicleNameInput}
        stockVehicleForm={stockVehicleForm}
        setStockVehicleForm={setStockVehicleForm}
        supplierInput={supplierInput}
        setSupplierInput={setSupplierInput}
        suppliers={[...new Set(purchaseRecords.map((r) => r.supplier_name).filter(Boolean))].sort()}
        submitting={submitting}
        onSubmit={(event) => void submitStock(event)}
        onClose={closeAllModals}
      />

      <LeadModalComponent
        modal={leadModal}
        leadForm={leadForm}
        setLeadForm={setLeadForm}
        selectedLeadVehicle={selectedLeadVehicle}
        setSelectedLeadVehicle={setSelectedLeadVehicle}
        stock={appState.stock}
        submitting={submitting}
        onSubmit={(event) => void submitLead(event)}
        onClose={closeAllModals}
      />

      <ClientModalComponent
        modal={clientModal}
        clientForm={clientForm}
        setClientForm={setClientForm}
        selectedClientVehicle={selectedClientVehicle}
        setSelectedClientVehicle={setSelectedClientVehicle}
        stock={appState.stock}
        submitting={submitting}
        onSubmit={(event) => void submitClient(event)}
        onClose={closeAllModals}
      />
    </main>
  );
}

export default App;
