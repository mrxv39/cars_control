import React, { useState, useMemo, FormEvent } from "react";
import * as api from "./lib/api";
import "./App.css";

type ViewKey = "stock" | "stock_detail" | "leads" | "clients" | "sales" | "purchases" | "suppliers";

function WebApp() {
  const [session, setSession] = useState<api.LoginResult | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const result = await api.login(loginUsername, loginPassword);
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
          <p className="muted" style={{ marginBottom: "1.5rem" }}>Introduce tus credenciales para acceder.</p>
          <form onSubmit={(e) => void handleLogin(e)}>
            <div style={{ marginBottom: "1rem" }}>
              <label className="field-label" htmlFor="login-user">Usuario</label>
              <input id="login-user" type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Usuario" autoFocus />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label className="field-label" htmlFor="login-pass">Contrasena</label>
              <input id="login-pass" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Contrasena" />
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

  return <AuthenticatedWebApp session={session} onLogout={() => setSession(null)} />;
}

const NAV_ITEMS: Array<{ key: ViewKey; label: string }> = [
  { key: "stock", label: "Stock" },
  { key: "sales", label: "Ventas" },
  { key: "purchases", label: "Compras" },
  { key: "suppliers", label: "Proveedores" },
  { key: "leads", label: "Leads" },
  { key: "clients", label: "Clientes" },
];

function AuthenticatedWebApp({ session, onLogout }: { session: api.LoginResult; onLogout: () => void }) {
  const companyId = session.company.id;
  const [currentView, setCurrentView] = useState<ViewKey>("stock");
  const [vehicles, setVehicles] = useState<api.Vehicle[]>([]);
  const [leads, setLeads] = useState<api.Lead[]>([]);
  const [clients, setClients] = useState<api.Client[]>([]);
  const [salesRecords, setSalesRecords] = useState<api.SalesRecord[]>([]);
  const [purchaseRecords, setPurchaseRecords] = useState<api.PurchaseRecord[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<api.Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [v, l, c, s, p] = await Promise.all([
        api.listVehicles(companyId),
        api.listLeads(companyId),
        api.listClients(companyId),
        api.listSalesRecords(companyId),
        api.listPurchaseRecords(companyId),
      ]);
      setVehicles(v);
      setLeads(l);
      setClients(c);
      setSalesRecords(s);
      setPurchaseRecords(p);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="panel status-panel" style={{ margin: "auto" }}>
          <p className="eyebrow">Cars Control</p>
          <h1>Cargando...</h1>
        </section>
      </main>
    );
  }

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
              onClick={() => { setCurrentView(item.key); setSelectedVehicle(null); }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-tools panel">
          <button type="button" className="button danger" onClick={onLogout} style={{ width: "100%" }}>
            Cerrar sesion
          </button>
        </div>
      </aside>
      <section className="content">
        {currentView === "stock" && !selectedVehicle && (
          <StockList vehicles={vehicles} companyId={companyId} onSelect={setSelectedVehicle} onReload={loadAll} />
        )}
        {currentView === "stock" && selectedVehicle && (
          <VehicleDetail vehicle={selectedVehicle} onBack={() => { setSelectedVehicle(null); void loadAll(); }} onReload={loadAll} />
        )}
        {currentView === "leads" && <LeadsList leads={leads} vehicles={vehicles} companyId={companyId} onReload={loadAll} />}
        {currentView === "clients" && <ClientsList clients={clients} companyId={companyId} onReload={loadAll} />}
        {currentView === "sales" && <SalesList records={salesRecords} vehicles={vehicles} clients={clients} companyId={companyId} onReload={loadAll} />}
        {currentView === "purchases" && <PurchasesList records={purchaseRecords} companyId={companyId} onReload={loadAll} />}
        {currentView === "suppliers" && <SuppliersList records={purchaseRecords} />}
      </section>
    </main>
  );
}

// ============================================================
// Stock List
// ============================================================
function StockList({ vehicles, companyId, onSelect, onReload }: { vehicles: api.Vehicle[]; companyId: number; onSelect: (v: api.Vehicle) => void; onReload: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.createVehicle(companyId, newName.trim());
      setNewName("");
      setShowAdd(false);
      await onReload();
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Stock</p>
          <h2>Vehiculos en stock</h2>
          <p className="muted">{vehicles.length} vehiculo{vehicles.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "Cancelar" : "Añadir vehiculo"}
          </button>
        </div>
      </header>

      {showAdd && (
        <section className="panel" style={{ padding: "1.5rem" }}>
          <form onSubmit={(e) => void handleAdd(e)} style={{ display: "flex", gap: "0.75rem", alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Marca y modelo</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="SEAT Ibiza 1.0 MPI Style" autoFocus />
            </div>
            <button type="submit" className="button primary" disabled={adding}>{adding ? "Añadiendo..." : "Añadir"}</button>
          </form>
        </section>
      )}

      <section className="stock-grid">
        {vehicles.map((v) => (
          <article key={v.id} className="vehicle-card vehicle-card-clickable" onClick={() => onSelect(v)}>
            <VehicleThumb vehicleId={v.id} />
            <div className="vehicle-copy">
              <h3>{v.name}</h3>
              {(v.anio || v.km) && (
                <p className="muted">{[v.anio, v.km ? `${v.km.toLocaleString()} km` : null].filter(Boolean).join(" · ")}</p>
              )}
              {v.precio_venta && <p className="vehicle-price">{v.precio_venta.toLocaleString("es-ES")} €</p>}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

// ============================================================
// Vehicle Thumbnail (loads from Supabase Storage)
// ============================================================
function VehicleThumb({ vehicleId }: { vehicleId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  React.useEffect(() => {
    void api.listVehiclePhotos(vehicleId).then((photos) => {
      if (photos.length > 0) setUrl(photos[0].url);
    });
  }, [vehicleId]);

  if (!url) return null;
  return (
    <div className="thumb-frame">
      <img src={url} className="thumb-image" alt="" />
    </div>
  );
}

// ============================================================
// Vehicle Detail
// ============================================================
function VehicleDetail({ vehicle, onBack, onReload }: { vehicle: api.Vehicle; onBack: () => void; onReload: () => void }) {
  const [form, setForm] = useState(vehicle);
  const [photos, setPhotos] = useState<api.VehiclePhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { void loadPhotos(); }, [vehicle.id]);

  async function loadPhotos() {
    const p = await api.listVehiclePhotos(vehicle.id);
    setPhotos(p);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateVehicle(vehicle.id, {
        name: form.name, anio: form.anio, km: form.km,
        precio_compra: form.precio_compra, precio_venta: form.precio_venta,
        ad_url: form.ad_url, estado: form.estado, fuel: form.fuel, color: form.color, notes: form.notes,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await api.uploadVehiclePhoto(vehicle.id, files[i]);
      }
      await loadPhotos();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeletePhoto(photo: api.VehiclePhoto) {
    if (!confirm(`Eliminar ${photo.file_name}?`)) return;
    await api.deleteVehiclePhoto(photo);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  const mainPhoto = selectedPhoto != null ? photos.find((p) => p.id === selectedPhoto)?.url : photos[0]?.url;

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Stock</p>
          <h2>{vehicle.name}</h2>
          <p className="muted">{[vehicle.anio, vehicle.km ? `${vehicle.km.toLocaleString()} km` : null, vehicle.estado].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={onBack}>Volver al stock</button>
          <button type="button" className="button danger" onClick={async () => {
            if (!confirm(`Eliminar ${vehicle.name}?`)) return;
            await api.deleteVehicle(vehicle.id);
            onBack();
          }}>Eliminar</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: mainPhoto ? "1fr 1fr" : "1fr", gap: "1.25rem" }}>
        {mainPhoto && (
          <div>
            <section className="panel" style={{ overflow: "hidden", padding: 0 }}>
              <img src={mainPhoto} alt={vehicle.name} style={{ width: "100%", display: "block", borderRadius: 24 }} />
            </section>
            {photos.length > 1 && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", overflowX: "auto" }}>
                {photos.map((p) => (
                  <img key={p.id} src={p.url} onClick={() => setSelectedPhoto(p.id)}
                    style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, cursor: "pointer",
                      border: (selectedPhoto === p.id || (!selectedPhoto && p === photos[0])) ? "2px solid #1d4ed8" : "2px solid transparent" }} />
                ))}
              </div>
            )}
          </div>
        )}

        <section className="panel" style={{ padding: "1.5rem" }}>
          <p className="eyebrow" style={{ marginBottom: "1rem" }}>Datos del vehiculo</p>
          <form onSubmit={(e) => void handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label className="field-label">Marca y modelo</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="field-label">Año</label>
                <input type="number" value={form.anio || ""} onChange={(e) => setForm({ ...form, anio: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
              <div>
                <label className="field-label">Kilometros</label>
                <input type="number" value={form.km || ""} onChange={(e) => setForm({ ...form, km: e.target.value ? parseInt(e.target.value) : null })} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="field-label">Precio compra</label>
                <input type="number" step="100" value={form.precio_compra || ""} onChange={(e) => setForm({ ...form, precio_compra: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <label className="field-label">Precio venta</label>
                <input type="number" step="100" value={form.precio_venta || ""} onChange={(e) => setForm({ ...form, precio_venta: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
            </div>
            <div>
              <label className="field-label">Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="disponible">Disponible</option>
                <option value="reservado">Reservado</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>
            <div>
              <label className="field-label">Notas</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            {success && <p className="success-banner">Guardado</p>}
            <button type="submit" className="button primary" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
          </form>
        </section>
      </div>

      <section className="panel" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow">Fotografias</p>
            <p className="muted" style={{ margin: 0 }}>{photos.length} foto{photos.length !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => void handleUpload(e)} style={{ display: "none" }} />
            <button type="button" className="button primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Subiendo..." : "Subir fotos"}
            </button>
          </div>
        </div>
        {photos.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative" }}>
                <img src={p.url} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 12, cursor: "pointer" }} onClick={() => setSelectedPhoto(p.id)} />
                <button type="button" onClick={() => void handleDeletePhoto(p)}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 8, padding: "4px 8px", fontSize: "0.75rem", cursor: "pointer", fontWeight: 700 }}>X</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Sin fotos. Pulsa "Subir fotos" para añadir imagenes.</p>
        )}
      </section>
    </>
  );
}

// ============================================================
// Leads List
// ============================================================
function LeadsList({ leads, vehicles, companyId, onReload }: { leads: api.Lead[]; vehicles: api.Vehicle[]; companyId: number; onReload: () => void }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) => [l.name, l.phone, l.vehicle_interest].some((v) => v.toLowerCase().includes(q)));
  }, [leads, search]);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Leads</p>
          <h2>Contactos</h2>
          <p className="muted">{leads.length} lead{leads.length !== 1 ? "s" : ""}</p>
        </div>
      </header>
      {leads.length > 0 && (
        <section className="panel filter-panel">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lead..." />
        </section>
      )}
      <section className="record-grid">
        {filtered.map((lead) => (
          <article key={lead.id} className="record-card panel">
            <div className="record-header">
              <div>
                <p className="record-title">{lead.name}</p>
                <p className="muted">{lead.phone || "Sin telefono"}</p>
              </div>
              <span className="badge">{lead.estado}</span>
            </div>
            {lead.vehicle_interest && <p className="record-line">Interes: {lead.vehicle_interest}</p>}
            {lead.notes && <p className="record-notes">{lead.notes}</p>}
          </article>
        ))}
      </section>
    </>
  );
}

// ============================================================
// Clients List
// ============================================================
function ClientsList({ clients, companyId, onReload }: { clients: api.Client[]; companyId: number; onReload: () => void }) {
  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Clientes</p>
          <h2>Clientes registrados</h2>
          <p className="muted">{clients.length} cliente{clients.length !== 1 ? "s" : ""}</p>
        </div>
      </header>
      <section className="record-grid">
        {clients.map((c) => (
          <article key={c.id} className="record-card panel">
            <div className="record-header">
              <div>
                <p className="record-title">{c.name}</p>
                <p className="muted">{c.phone || "Sin telefono"}</p>
              </div>
              <span className="badge badge-success">Cliente</span>
            </div>
            {c.dni && <p className="record-line">DNI: {c.dni}</p>}
            {c.email && <p className="record-line">{c.email}</p>}
          </article>
        ))}
      </section>
    </>
  );
}

// ============================================================
// Sales List
// ============================================================
function SalesList({ records, vehicles, clients, companyId, onReload }: { records: api.SalesRecord[]; vehicles: api.Vehicle[]; clients: api.Client[]; companyId: number; onReload: () => void }) {
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const total = records.reduce((s, r) => s + r.price_final, 0);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Ventas</p>
          <h2>Registro de ventas</h2>
          <p className="muted">{records.length} venta{records.length !== 1 ? "s" : ""} · {total.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
        </div>
      </header>
      {records.length > 0 && (
        <section className="panel sales-records-panel">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead><tr>
                <th className="sales-th">Vehiculo</th>
                <th className="sales-th">Cliente</th>
                <th className="sales-th">Fecha</th>
                <th className="sales-th sales-th-right">Precio</th>
              </tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="sales-row">
                    <td className="sales-td">{r.vehicle_id ? vehicleMap.get(r.vehicle_id)?.name || "—" : "—"}</td>
                    <td className="sales-td">{r.client_id ? clientMap.get(r.client_id)?.name || "—" : "—"}</td>
                    <td className="sales-td">{new Date(r.date).toLocaleDateString("es-ES")}</td>
                    <td className="sales-td sales-td-right"><span className="sales-price">{r.price_final.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

// ============================================================
// Purchases List
// ============================================================
function PurchasesList({ records, companyId, onReload }: { records: api.PurchaseRecord[]; companyId: number; onReload: () => void }) {
  const total = records.reduce((s, r) => s + r.purchase_price, 0);
  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Compras y Gastos</p>
          <h2>Registro de compras</h2>
          <p className="muted">{records.length} registro{records.length !== 1 ? "s" : ""} · {total.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
        </div>
      </header>
      {records.length > 0 && (
        <section className="panel sales-records-panel">
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead><tr>
                <th className="sales-th">Tipo</th>
                <th className="sales-th">Proveedor</th>
                <th className="sales-th">Fecha</th>
                <th className="sales-th sales-th-right">Importe</th>
                <th className="sales-th">Factura</th>
              </tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="sales-row">
                    <td className="sales-td"><span className="badge">{r.expense_type}</span></td>
                    <td className="sales-td">{r.supplier_name}</td>
                    <td className="sales-td">{r.purchase_date}</td>
                    <td className="sales-td sales-td-right"><span className="sales-price">{r.purchase_price.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span></td>
                    <td className="sales-td"><span className="badge badge-info">{r.invoice_number || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

// ============================================================
// Suppliers List
// ============================================================
function SuppliersList({ records }: { records: api.PurchaseRecord[] }) {
  const suppliers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const r of records) {
      const key = r.supplier_name || "Desconocido";
      const existing = map.get(key);
      if (existing) { existing.total += r.purchase_price; existing.count++; }
      else map.set(key, { name: key, total: r.purchase_price, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [records]);

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Proveedores</p>
          <h2>Directorio de proveedores</h2>
          <p className="muted">{suppliers.length} proveedor{suppliers.length !== 1 ? "es" : ""}</p>
        </div>
      </header>
      <section className="panel sales-records-panel">
        <div className="sales-table-scroll">
          <table className="sales-table">
            <thead><tr>
              <th className="sales-th">Proveedor</th>
              <th className="sales-th sales-th-right">Facturas</th>
              <th className="sales-th sales-th-right">Total</th>
            </tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.name} className="sales-row">
                  <td className="sales-td"><span className="sales-vehicle-name">{s.name}</span></td>
                  <td className="sales-td sales-td-right">{s.count}</td>
                  <td className="sales-td sales-td-right"><span className="sales-price">{s.total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default WebApp;
