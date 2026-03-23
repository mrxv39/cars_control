import React, { useState, useMemo, FormEvent } from "react";
import * as api from "./lib/api";
import { supabase } from "./lib/supabase";
import { FeedbackButton } from "./components/FeedbackButton";
import "./App.css";

type ViewKey = "stock" | "stock_detail" | "leads" | "clients" | "sales" | "purchases" | "suppliers" | "revision";

function WebApp() {
  const [page, setPage] = useState<"catalog" | "login" | "admin">(() => {
    try {
      const saved = localStorage.getItem("cc_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user?.id && parsed?.company?.id) return "admin";
      }
    } catch { /* ignore */ }
    localStorage.removeItem("cc_session");
    return "catalog";
  });
  const [session, setSession] = useState<api.LoginResult | null>(() => {
    try {
      const saved = localStorage.getItem("cc_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user?.id && parsed?.company?.id) return parsed;
      }
    } catch { /* ignore */ }
    return null;
  });
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
      localStorage.setItem("cc_session", JSON.stringify(result));
      setSession(result);
      setPage("admin");
    } catch (err) {
      setLoginError(String(err));
    } finally {
      setLoginSubmitting(false);
    }
  }

  // Login page
  if (page === "login" && !session) {
    return (
      <div className="catalog-page">
        <CatalogHeader onLogin={() => setPage("login")} onCatalog={() => setPage("catalog")} isAdmin={false} />
        <main style={{ maxWidth: 420, margin: "3rem auto", padding: "0 1rem" }}>
          <section className="panel" style={{ padding: "2rem" }}>
            <p className="eyebrow">Acceso usuarios</p>
            <h2 style={{ margin: "0.3rem 0 0.5rem" }}>Iniciar sesion</h2>
            <p className="muted" style={{ marginBottom: "1.5rem" }}>Panel de gestion para usuarios autorizados.</p>
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
      </div>
    );
  }

  // Admin panel
  if (page === "admin" && session) {
    return <AuthenticatedWebApp session={session} onLogout={() => { localStorage.removeItem("cc_session"); setSession(null); setPage("catalog"); }} />;
  }

  // Public catalog (default)
  return <PublicCatalog onLogin={() => setPage("login")} />;
}

// ============================================================
// Header for public pages
// ============================================================
function CatalogHeader({ onLogin, onCatalog, isAdmin: _isAdmin }: { onLogin: () => void; onCatalog: () => void; isAdmin: boolean }) {
  return (
    <header className="catalog-topbar">
      <div className="catalog-topbar-inner">
        <div className="catalog-brand" onClick={onCatalog} style={{ cursor: "pointer" }}>
          <img src="/logo.png" alt="CodinaCars" className="catalog-logo-img" />
        </div>
        <nav className="catalog-nav">
          <a href="tel:+34646131565" className="catalog-nav-link">646 13 15 65</a>
          <button type="button" className="catalog-nav-btn" onClick={onLogin}>
            Acceso usuarios
          </button>
        </nav>
      </div>
    </header>
  );
}

// ============================================================
// Public Catalog
// ============================================================
function PublicCatalog({ onLogin }: { onLogin: () => void }) {
  const [vehicles, setVehicles] = useState<api.Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<api.Vehicle | null>(null);

  React.useEffect(() => {
    void api.listVehicles(1).then((v) => { setVehicles(v); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.name, v.fuel, String(v.anio || ""), String(v.precio_venta || "")]
        .some((f) => f.toLowerCase().includes(q))
    );
  }, [vehicles, search]);

  if (selectedVehicle) {
    return (
      <div className="catalog-page">
        <CatalogHeader onLogin={onLogin} onCatalog={() => setSelectedVehicle(null)} isAdmin={false} />
        <PublicVehicleDetail vehicle={selectedVehicle} onBack={() => setSelectedVehicle(null)} />
      </div>
    );
  }

  return (
    <div className="catalog-page">
      <CatalogHeader onLogin={onLogin} onCatalog={() => setSelectedVehicle(null)} isAdmin={false} />

      <section className="catalog-hero-banner">
        <h1>Vehiculos de ocasion</h1>
        <p>Compraventa de coches en Molins de Rei, Barcelona</p>
      </section>

      <main className="catalog-main">
        <div className="catalog-toolbar">
          <input
            className="catalog-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, año..."
          />
          <span className="muted">{filtered.length} vehiculo{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <p className="muted" style={{ textAlign: "center", padding: "3rem" }}>Cargando vehiculos...</p>
        ) : (
          <div className="catalog-grid">
            {filtered.map((v) => (
              <article key={v.id} className="catalog-card" onClick={() => setSelectedVehicle(v)}>
                <CatalogThumb vehicleId={v.id} />
                <div className="catalog-card-body">
                  <h3 className="catalog-card-title">{v.name}</h3>
                  <div className="catalog-card-specs">
                    {v.anio && <span>{v.anio}</span>}
                    {v.km && <span>{v.km.toLocaleString()} km</span>}
                    {v.fuel && <span>{v.fuel}</span>}
                  </div>
                  {v.precio_venta && (
                    <p className="catalog-card-price">{v.precio_venta.toLocaleString("es-ES")} €</p>
                  )}
                  {v.notes && v.notes.startsWith("Desde") && (
                    <p className="catalog-card-financing">{v.notes.split("|")[0].trim()}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="catalog-footer">
        <p>CodinaCars · C/ Sant Antoni Maria Claret 3, Bajos 2, 08750 Molins de Rei (Barcelona)</p>
        <p>Tel: 646 13 15 65 · codinacars@gmail.com</p>
      </footer>
    </div>
  );
}

// ============================================================
// Catalog Thumbnail
// ============================================================
function CatalogThumb({ vehicleId }: { vehicleId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  React.useEffect(() => {
    void api.listVehiclePhotos(vehicleId).then((photos) => {
      if (photos.length > 0) setUrl(photos[0].url);
    });
  }, [vehicleId]);

  return (
    <div className="catalog-card-img">
      {url ? <img src={url} alt="" /> : <div className="catalog-card-noimg">Sin foto</div>}
    </div>
  );
}

// ============================================================
// Public Vehicle Detail
// ============================================================
function PublicVehicleDetail({ vehicle, onBack }: { vehicle: api.Vehicle; onBack: () => void }) {
  const [photos, setPhotos] = useState<api.VehiclePhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);

  React.useEffect(() => {
    void api.listVehiclePhotos(vehicle.id).then(setPhotos);
  }, [vehicle.id]);

  const mainPhoto = selectedPhoto != null ? photos.find((p) => p.id === selectedPhoto)?.url : photos[0]?.url;

  return (
    <main className="catalog-main">
      <button type="button" className="catalog-back" onClick={onBack}>Volver al listado</button>

      <div className="catalog-detail">
        <div className="catalog-detail-gallery">
          {mainPhoto && (
            <div className="catalog-detail-main-img">
              <img src={mainPhoto} alt={vehicle.name} />
            </div>
          )}
          {photos.length > 1 && (
            <div className="catalog-detail-thumbs">
              {photos.map((p) => (
                <img
                  key={p.id} src={p.url} alt=""
                  className={selectedPhoto === p.id || (!selectedPhoto && p === photos[0]) ? "active" : ""}
                  onClick={() => setSelectedPhoto(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="catalog-detail-info">
          <h1>{vehicle.name}</h1>
          {vehicle.precio_venta && (
            <p className="catalog-detail-price">{vehicle.precio_venta.toLocaleString("es-ES")} €</p>
          )}
          <table className="catalog-detail-specs">
            <tbody>
              {vehicle.anio && <tr><td>Año</td><td>{vehicle.anio}</td></tr>}
              {vehicle.km && <tr><td>Kilometraje</td><td>{vehicle.km.toLocaleString()} km</td></tr>}
              {vehicle.fuel && <tr><td>Combustible</td><td>{vehicle.fuel}</td></tr>}
              {vehicle.cv && <tr><td>Potencia</td><td>{vehicle.cv}</td></tr>}
              {vehicle.transmission && <tr><td>Cambio</td><td>{vehicle.transmission}</td></tr>}
              {vehicle.color && <tr><td>Color</td><td>{vehicle.color}</td></tr>}
              <tr><td>Estado</td><td style={{ textTransform: "capitalize" }}>{vehicle.estado}</td></tr>
            </tbody>
          </table>
          {vehicle.notes && vehicle.notes.startsWith("Desde") && (
            <div className="catalog-detail-financing">
              <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>Financiacion</p>
              <p className="catalog-detail-financing-text">{vehicle.notes}</p>
            </div>
          )}
          <div className="catalog-detail-contact">
            <a href="tel:+34646131565" className="button primary" style={{ textDecoration: "none", textAlign: "center" }}>Llamar: 646 13 15 65</a>
            <a href="https://wa.me/34646131565" className="button secondary" style={{ textDecoration: "none", textAlign: "center" }} target="_blank" rel="noopener">WhatsApp</a>
          </div>

          <ContactForm vehicleName={vehicle.name} />
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Contact Form (sends to codinacars@gmail.com via formsubmit.co)
// ============================================================
function ContactForm({ vehicleName }: { vehicleName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="catalog-contact-form">
        <p className="success-banner" style={{ textAlign: "center" }}>Mensaje enviado. Te contactaremos pronto.</p>
      </div>
    );
  }

  return (
    <form
      className="catalog-contact-form"
      action="https://formsubmit.co/codinacars@gmail.com"
      method="POST"
      onSubmit={() => setSent(true)}
    >
      <input type="hidden" name="_subject" value={`Consulta: ${vehicleName}`} />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="Vehiculo" value={vehicleName} />
      <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Contactar por este vehiculo</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label className="field-label">Nombre</label>
          <input name="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" required />
        </div>
        <div>
          <label className="field-label">Telefono</label>
          <input name="Telefono" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="600 123 456" required />
        </div>
      </div>
      <button type="submit" className="button primary" style={{ width: "100%", marginTop: "0.75rem" }}>
        Enviar consulta
      </button>
    </form>
  );
}

const NAV_ITEMS: Array<{ key: ViewKey; label: string }> = [
  { key: "stock", label: "Stock" },
  { key: "sales", label: "Ventas" },
  { key: "purchases", label: "Compras" },
  { key: "suppliers", label: "Proveedores" },
  { key: "leads", label: "Leads" },
  { key: "clients", label: "Clientes" },
  { key: "revision", label: "Revision" },
];

function AuthenticatedWebApp({ session, onLogout }: { session: api.LoginResult; onLogout: () => void }) {
  const companyId = session.company.id;
  const [currentView, setCurrentView] = useState<ViewKey>("stock");
  const [vehicles, setVehicles] = useState<api.Vehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<api.Vehicle[]>([]);
  const [leads, setLeads] = useState<api.Lead[]>([]);
  const [clients, setClients] = useState<api.Client[]>([]);
  const [salesRecords, setSalesRecords] = useState<api.SalesRecord[]>([]);
  const [purchaseRecords, setPurchaseRecords] = useState<api.PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<api.Supplier[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<api.Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [v, allV, l, c, s, p, sup] = await Promise.all([
        api.listVehicles(companyId),
        api.listAllVehicles(companyId),
        api.listLeads(companyId),
        api.listClients(companyId),
        api.listSalesRecords(companyId),
        api.listPurchaseRecords(companyId),
        api.listSuppliers(companyId),
      ]);
      setVehicles(v);
      setAllVehicles(allV);
      setLeads(l);
      setClients(c);
      setSalesRecords(s);
      setPurchaseRecords(p);
      setSuppliers(sup);
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
          <StockList vehicles={vehicles} allVehicles={allVehicles} leads={leads} companyId={companyId} onSelect={setSelectedVehicle} onReload={loadAll} />
        )}
        {currentView === "stock" && selectedVehicle && (
          <VehicleDetail vehicle={selectedVehicle} suppliers={suppliers} leads={leads} onBack={() => { setSelectedVehicle(null); void loadAll(); }} onReload={loadAll} />
        )}
        {currentView === "leads" && <LeadsList leads={leads} vehicles={vehicles} companyId={companyId} onReload={loadAll} />}
        {currentView === "clients" && <ClientsList clients={clients} companyId={companyId} onReload={loadAll} />}
        {currentView === "sales" && <SalesList records={salesRecords} vehicles={vehicles} clients={clients} companyId={companyId} onReload={loadAll} />}
        {currentView === "purchases" && <PurchasesList records={purchaseRecords} companyId={companyId} onReload={loadAll} />}
        {currentView === "suppliers" && <SuppliersList suppliers={suppliers} companyId={companyId} onReload={loadAll} />}
        {currentView === "revision" && <RevisionSheet vehicles={allVehicles} companyId={companyId} />}
      </section>

      <FeedbackButton
        userName={session.user.full_name}
        currentView={selectedVehicle ? "vehiculo: " + selectedVehicle.name : currentView}
        stock={vehicles}
        leads={leads}
        clients={clients}
        selectedVehicle={selectedVehicle}
      />
    </main>
  );
}

// ============================================================
// Stock List
// ============================================================
function StockList({ vehicles, allVehicles, leads, companyId, onSelect, onReload }: { vehicles: api.Vehicle[]; allVehicles: api.Vehicle[]; leads: api.Lead[]; companyId: number; onSelect: (v: api.Vehicle) => void; onReload: () => void }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAnio, setNewAnio] = useState("");
  const [newKm, setNewKm] = useState("");
  const [newPrecioCompra, setNewPrecioCompra] = useState("");
  const [newPrecioVenta, setNewPrecioVenta] = useState("");
  const [newFuel, setNewFuel] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    let list = vehicles;
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((v) =>
        [v.name, v.estado, v.fuel, String(v.anio || ""), String(v.precio_venta || "")]
          .some((field) => field.toLowerCase().includes(q))
      );
    }
    // Sort: 1) leads sin respuesta, 2) más leads, 3) más antiguos
    const unanswered = new Map<number, number>();
    const totalLeads = new Map<number, number>();
    for (const l of leads) {
      if (!l.vehicle_id) continue;
      totalLeads.set(l.vehicle_id, (totalLeads.get(l.vehicle_id) || 0) + 1);
      if (l.estado === "nuevo" || !l.estado) {
        unanswered.set(l.vehicle_id, (unanswered.get(l.vehicle_id) || 0) + 1);
      }
    }
    return [...list].sort((a, b) => {
      const ua = unanswered.get(a.id) || 0;
      const ub = unanswered.get(b.id) || 0;
      if (ua !== ub) return ub - ua;
      const la = totalLeads.get(a.id) || 0;
      const lb = totalLeads.get(b.id) || 0;
      if (la !== lb) return lb - la;
      return a.id - b.id;
    });
  }, [vehicles, leads, search]);

  const suggestions = useMemo(() => {
    const q = newName.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return allVehicles
      .filter((v) => v.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allVehicles, newName]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.createVehicle(companyId, {
        name: newName.trim(),
        anio: newAnio ? parseInt(newAnio) : null,
        km: newKm ? parseInt(newKm) : null,
        precio_compra: newPrecioCompra ? parseFloat(newPrecioCompra) : null,
        precio_venta: newPrecioVenta ? parseFloat(newPrecioVenta) : null,
        fuel: newFuel,
        color: newColor,
        notes: newNotes,
      } as api.Vehicle);
      setNewName(""); setNewAnio(""); setNewKm(""); setNewPrecioCompra(""); setNewPrecioVenta(""); setNewFuel(""); setNewColor(""); setNewNotes("");
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
          <button type="button" className="button secondary" onClick={() => window.open("https://www.coches.net/concesionario/codinacars/", "_blank")}>
            Update stock
          </button>
          <button type="button" className="button primary" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "Cancelar" : "Añadir vehiculo"}
          </button>
        </div>
      </header>

      <section className="panel filter-panel">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por marca, modelo, año..."
          className="sales-search"
        />
        {search && <p className="muted" style={{ margin: "0.5rem 0 0" }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>}
      </section>

      {showAdd && (
        <section className="panel" style={{ padding: "1.5rem" }}>
          <form onSubmit={(e) => void handleAdd(e)}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "end" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <label className="field-label">Marca y modelo</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Escribe para buscar coincidencias..." autoFocus />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div>
                <label className="field-label">Año</label>
                <input type="number" value={newAnio} onChange={(e) => setNewAnio(e.target.value)} placeholder="2024" />
              </div>
              <div>
                <label className="field-label">Kilometros</label>
                <input type="number" value={newKm} onChange={(e) => setNewKm(e.target.value)} placeholder="50000" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div>
                <label className="field-label">Precio compra</label>
                <input type="number" step="100" value={newPrecioCompra} onChange={(e) => setNewPrecioCompra(e.target.value)} placeholder="8000" />
              </div>
              <div>
                <label className="field-label">Precio venta</label>
                <input type="number" step="100" value={newPrecioVenta} onChange={(e) => setNewPrecioVenta(e.target.value)} placeholder="10500" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div>
                <label className="field-label">Combustible</label>
                <select value={newFuel} onChange={(e) => setNewFuel(e.target.value)}>
                  <option value="">—</option>
                  <option value="Gasolina">Gasolina</option>
                  <option value="Diésel">Diésel</option>
                  <option value="Híbrido">Híbrido</option>
                  <option value="Eléctrico">Eléctrico</option>
                  <option value="GLP">GLP</option>
                </select>
              </div>
              <div>
                <label className="field-label">Color</label>
                <input value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="Blanco" />
              </div>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label className="field-label">Notas</label>
              <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <button type="submit" className="button primary" disabled={adding}>{adding ? "Añadiendo..." : "Añadir vehiculo"}</button>
            </div>
            {suggestions.length > 0 && (
              <div className="suggestions-list">
                <p className="field-label" style={{ margin: "0.75rem 0 0.4rem", fontSize: "0.72rem" }}>Coincidencias en la base de datos:</p>
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="suggestion-item"
                    onClick={() => setNewName(s.name)}
                  >
                    <span className="suggestion-name">{s.name}</span>
                    <span className="suggestion-meta">
                      {[s.anio, s.km ? `${s.km.toLocaleString()} km` : null, s.estado].filter(Boolean).join(" · ")}
                      {s.precio_venta ? ` · ${s.precio_venta.toLocaleString("es-ES")} €` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </form>
        </section>
      )}

      <section className="stock-grid">
        {filtered.map((v) => (
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
// Vehicle Detail — wrapper with layout selector
// ============================================================
type VehicleLayout = "A" | "B" | "C";
type VDProps = { vehicle: api.Vehicle; suppliers: api.Supplier[]; leads: api.Lead[]; onBack: () => void; onReload: () => void };

function VehicleDetail(props: VDProps) {
  const [layout, setLayout] = useState<VehicleLayout>(() => {
    return (localStorage.getItem("cc_vehicle_layout") as VehicleLayout) || "A";
  });
  function switchLayout(l: VehicleLayout) { setLayout(l); localStorage.setItem("cc_vehicle_layout", l); }
  const btnStyle = (l: VehicleLayout): React.CSSProperties => ({
    padding: "0.3rem 0.7rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
    border: layout === l ? "2px solid #1d4ed8" : "2px solid #cbd5e1",
    borderRadius: 6, background: layout === l ? "#1d4ed8" : "transparent",
    color: layout === l ? "#fff" : "#475569",
  });
  return (
    <>
      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", color: "#64748b", alignSelf: "center", marginRight: "0.25rem" }}>Vista:</span>
        <button type="button" style={btnStyle("A")} onClick={() => switchLayout("A")}>Sidebar</button>
        <button type="button" style={btnStyle("B")} onClick={() => switchLayout("B")}>Tabs</button>
        <button type="button" style={btnStyle("C")} onClick={() => switchLayout("C")}>Dashboard</button>
      </div>
      {layout === "A" && <VehicleDetailA {...props} />}
      {layout === "B" && <VehicleDetailB {...props} />}
      {layout === "C" && <VehicleDetailC {...props} />}
    </>
  );
}

// Shared hooks for all vehicle detail layouts
function useVehicleDetail(vehicle: api.Vehicle) {
  const [form, setForm] = useState(vehicle);
  const [photos, setPhotos] = useState<api.VehiclePhoto[]>([]);
  const [docs, setDocs] = useState<api.VehicleDocument[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const docFileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { void loadPhotos(); void loadDocs(); }, [vehicle.id]);

  async function loadPhotos() { setPhotos(await api.listVehiclePhotos(vehicle.id)); }
  async function loadDocs() { setDocs(await api.listVehicleDocuments(vehicle.id)); }

  async function handleSave(e: FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.updateVehicle(vehicle.id, {
        name: form.name, anio: form.anio, km: form.km,
        precio_compra: form.precio_compra, precio_venta: form.precio_venta,
        ad_url: form.ad_url, estado: form.estado, fuel: form.fuel, color: form.color, notes: form.notes,
        supplier_id: form.supplier_id,
      });
      setSuccess(true); setTimeout(() => setSuccess(false), 2000);
    } finally { setSaving(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files) return;
    setUploading(true);
    try { for (let i = 0; i < files.length; i++) await api.uploadVehiclePhoto(vehicle.id, files[i]); await loadPhotos(); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleDeletePhoto(photo: api.VehiclePhoto) {
    if (!confirm(`Eliminar ${photo.file_name}?`)) return;
    await api.deleteVehiclePhoto(photo);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function handleUploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingDoc(true);
    try { await api.uploadVehicleDocument(vehicle.id, file, "factura"); await loadDocs(); }
    finally { setUploadingDoc(false); if (docFileRef.current) docFileRef.current.value = ""; }
  }

  async function handleDeleteDoc(doc: api.VehicleDocument) {
    if (!confirm(`Eliminar ${doc.file_name}?`)) return;
    await api.deleteVehicleDocument(doc);
    setDocs((prev) => prev.filter((x) => x.id !== doc.id));
  }

  const mainPhoto = selectedPhoto != null ? photos.find((p) => p.id === selectedPhoto)?.url : photos[0]?.url;
  const margin = (form.precio_compra && form.precio_venta) ? form.precio_venta - form.precio_compra : null;
  const facturas = docs.filter((d) => d.doc_type === "factura");

  return { form, setForm, photos, docs, facturas, selectedPhoto, setSelectedPhoto, saving, uploading, uploadingDoc, success,
    fileRef, docFileRef, handleSave, handleUpload, handleDeletePhoto, handleUploadDoc, handleDeleteDoc, mainPhoto, margin, loadPhotos };
}

// Shared: Hero header
function VDHero({ vehicle, onBack }: { vehicle: api.Vehicle; onBack: () => void }) {
  return (
    <header className="hero">
      <div>
        <p className="eyebrow">Stock</p>
        <h2>{vehicle.name}</h2>
        <p className="muted">{[vehicle.anio, vehicle.km ? `${vehicle.km.toLocaleString()} km` : null, vehicle.estado].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="hero-actions">
        <button type="button" className="button secondary" onClick={onBack}>Volver al stock</button>
        <button type="button" className="button danger" onClick={async () => { if (!confirm(`Eliminar ${vehicle.name}?`)) return; await api.deleteVehicle(vehicle.id); onBack(); }}>Eliminar</button>
      </div>
    </header>
  );
}

// Shared: Photos gallery
function VDPhotos({ photos, fileRef, uploading, handleUpload, handleDeletePhoto, setSelectedPhoto }: { photos: api.VehiclePhoto[]; fileRef: React.RefObject<HTMLInputElement | null>; uploading: boolean; handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; handleDeletePhoto: (p: api.VehiclePhoto) => void; setSelectedPhoto: (id: number) => void }) {
  return (
    <section className="panel" style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div><p className="eyebrow">Fotografias</p><p className="muted" style={{ margin: 0 }}>{photos.length} foto{photos.length !== 1 ? "s" : ""}</p></div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => void handleUpload(e)} style={{ display: "none" }} />
          <button type="button" className="button primary" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "Subiendo..." : "Subir fotos"}</button>
        </div>
      </div>
      {photos.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem" }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <img src={p.url} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 12, cursor: "pointer" }} onClick={() => setSelectedPhoto(p.id)} />
              <button type="button" onClick={() => void handleDeletePhoto(p)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 8, padding: "4px 8px", fontSize: "0.75rem", cursor: "pointer", fontWeight: 700 }}>X</button>
            </div>
          ))}
        </div>
      ) : <p className="muted">Sin fotos. Pulsa "Subir fotos" para anadir imagenes.</p>}
    </section>
  );
}

// Shared: Factura section
function VDFactura({ facturas, docFileRef, uploadingDoc, handleUploadDoc, handleDeleteDoc }: { facturas: api.VehicleDocument[]; docFileRef: React.RefObject<HTMLInputElement | null>; uploadingDoc: boolean; handleUploadDoc: (e: React.ChangeEvent<HTMLInputElement>) => void; handleDeleteDoc: (d: api.VehicleDocument) => void }) {
  return (
    <>
      <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Factura de compra</p>
      {facturas.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", background: "#f8fafc", borderRadius: 8, marginBottom: "0.35rem" }}>
          <span style={{ flex: 1, fontSize: "0.85rem" }}>{d.file_name}</span>
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="button secondary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>Ver</a>
          <button type="button" className="button danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => void handleDeleteDoc(d)}>Eliminar</button>
        </div>
      ))}
      {facturas.length === 0 && <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>No hay factura adjunta.</p>}
      <input ref={docFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => void handleUploadDoc(e)} />
      <button type="button" className="button secondary" onClick={() => docFileRef.current?.click()} disabled={uploadingDoc} style={{ fontSize: "0.8rem" }}>{uploadingDoc ? "Subiendo..." : "Adjuntar factura"}</button>
    </>
  );
}

// Shared: Leads sidebar/section
function VDLeads({ vehicleLeads }: { vehicleLeads: api.Lead[] }) {
  if (vehicleLeads.length === 0) return <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Sin leads para este vehiculo.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {vehicleLeads.map((l) => (
        <div key={l.id} style={{ padding: "0.65rem 0.75rem", background: "#f8fafc", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{l.name}</span>
            <span className="muted" style={{ fontSize: "0.7rem" }}>{l.canal} · {l.estado}</span>
          </div>
          {l.phone && <p style={{ margin: "0.15rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>Tel: {l.phone}</p>}
          {l.email && <p style={{ margin: "0.1rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>{l.email}</p>}
          {l.notes && <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "#475569" }}>{l.notes}</p>}
        </div>
      ))}
    </div>
  );
}

// ── PROPOSAL A: Sidebar layout ──
function VehicleDetailA({ vehicle, suppliers, leads, onBack }: VDProps) {
  const h = useVehicleDetail(vehicle);
  const vehicleLeads = leads.filter((l) => l.vehicle_id === vehicle.id);
  return (
    <>
      <VDHero vehicle={vehicle} onBack={onBack} />
      {h.photos.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", padding: "0.25rem 0" }}>
          {h.photos.map((p) => (
            <img key={p.id} src={p.url} onClick={() => h.setSelectedPhoto(p.id)}
              style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 10, cursor: "pointer", flexShrink: 0,
                border: (h.selectedPhoto === p.id || (!h.selectedPhoto && p === h.photos[0])) ? "2px solid #1d4ed8" : "2px solid transparent" }} />
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "1.25rem", alignItems: "start" }}>
        <section className="panel" style={{ padding: "1.25rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Datos del vehiculo</p>
          <form onSubmit={(e) => void h.handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <div><label className="field-label">Marca y modelo</label><input value={h.form.name} onChange={(e) => h.setForm({ ...h.form, name: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.65rem" }}>
              <div><label className="field-label">Ano</label><input type="number" value={h.form.anio || ""} onChange={(e) => h.setForm({ ...h.form, anio: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><label className="field-label">Km</label><input type="number" value={h.form.km || ""} onChange={(e) => h.setForm({ ...h.form, km: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><label className="field-label">Estado</label><select value={h.form.estado} onChange={(e) => h.setForm({ ...h.form, estado: e.target.value })}><option value="disponible">Disponible</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option></select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
              <div><label className="field-label">Precio compra</label><input type="number" step="100" value={h.form.precio_compra || ""} onChange={(e) => h.setForm({ ...h.form, precio_compra: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="field-label">Precio venta</label><input type="number" step="100" value={h.form.precio_venta || ""} onChange={(e) => h.setForm({ ...h.form, precio_venta: e.target.value ? parseFloat(e.target.value) : null })} /></div>
            </div>
            <div><label className="field-label">Proveedor</label><select value={h.form.supplier_id || ""} onChange={(e) => h.setForm({ ...h.form, supplier_id: e.target.value ? parseInt(e.target.value) : null })}><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="field-label">Notas</label><textarea value={h.form.notes} onChange={(e) => h.setForm({ ...h.form, notes: e.target.value })} rows={3} /></div>
            {h.success && <p className="success-banner">Guardado</p>}
            <button type="submit" className="button primary" disabled={h.saving} style={{ alignSelf: "flex-start" }}>{h.saving ? "Guardando..." : "Guardar"}</button>
          </form>
        </section>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {h.margin !== null && (
            <div className="panel" style={{ padding: "1rem 1.25rem" }}>
              <p className="eyebrow" style={{ marginBottom: "0.35rem" }}>Margen estimado</p>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: h.margin >= 0 ? "#166534" : "#991b1b" }}>{h.margin.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
            </div>
          )}
          <section className="panel" style={{ padding: "1.25rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Leads ({vehicleLeads.length})</p>
            <VDLeads vehicleLeads={vehicleLeads} />
          </section>
          <section className="panel" style={{ padding: "1.25rem" }}>
            <VDFactura facturas={h.facturas} docFileRef={h.docFileRef} uploadingDoc={h.uploadingDoc} handleUploadDoc={h.handleUploadDoc} handleDeleteDoc={h.handleDeleteDoc} />
          </section>
        </div>
      </div>
      <VDPhotos photos={h.photos} fileRef={h.fileRef} uploading={h.uploading} handleUpload={h.handleUpload} handleDeletePhoto={h.handleDeletePhoto} setSelectedPhoto={h.setSelectedPhoto} />
    </>
  );
}

// ── PROPOSAL B: Tabs layout ──
function VehicleDetailB({ vehicle, suppliers, leads, onBack }: VDProps) {
  const h = useVehicleDetail(vehicle);
  const [activeTab, setActiveTab] = useState<"datos" | "leads" | "documentos">("datos");
  const vehicleLeads = leads.filter((l) => l.vehicle_id === vehicle.id);
  const tabStyle = (tab: typeof activeTab): React.CSSProperties => ({
    flex: "none", padding: "0.65rem 1.25rem", border: "none", background: "none", fontSize: "0.88rem", fontWeight: 600,
    color: activeTab === tab ? "#1d4ed8" : "#64748b", cursor: "pointer",
    borderBottom: activeTab === tab ? "2px solid #1d4ed8" : "2px solid transparent", marginBottom: -2,
  });
  return (
    <>
      <VDHero vehicle={vehicle} onBack={onBack} />
      {h.mainPhoto && (
        <div style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
          <section className="panel" style={{ overflow: "hidden", padding: 0 }}>
            <img src={h.mainPhoto} alt={vehicle.name} style={{ width: "100%", display: "block", borderRadius: 24, maxHeight: 360, objectFit: "cover" }} />
          </section>
          {h.photos.length > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", overflowX: "auto" }}>
              {h.photos.map((p) => (
                <img key={p.id} src={p.url} onClick={() => h.setSelectedPhoto(p.id)}
                  style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, cursor: "pointer",
                    border: (h.selectedPhoto === p.id || (!h.selectedPhoto && p === h.photos[0])) ? "2px solid #1d4ed8" : "2px solid transparent" }} />
              ))}
            </div>
          )}
        </div>
      )}
      <section className="panel" style={{ maxWidth: 800, margin: "0 auto", width: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid rgba(0,0,0,0.06)", padding: "0 1.5rem" }}>
          <button type="button" style={tabStyle("datos")} onClick={() => setActiveTab("datos")}>Datos</button>
          <button type="button" style={tabStyle("leads")} onClick={() => setActiveTab("leads")}>Leads{vehicleLeads.length > 0 && <span style={{ marginLeft: 6, background: "#dc2626", color: "#fff", fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 8 }}>{vehicleLeads.length}</span>}</button>
          <button type="button" style={tabStyle("documentos")} onClick={() => setActiveTab("documentos")}>Documentos</button>
        </div>
        {activeTab === "datos" && (
          <div style={{ padding: "1.5rem" }}>
            <form onSubmit={(e) => void h.handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div><label className="field-label">Marca y modelo</label><input value={h.form.name} onChange={(e) => h.setForm({ ...h.form, name: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div><label className="field-label">Estado</label><select value={h.form.estado} onChange={(e) => h.setForm({ ...h.form, estado: e.target.value })}><option value="disponible">Disponible</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option></select></div>
                <div><label className="field-label">Proveedor</label><select value={h.form.supplier_id || ""} onChange={(e) => h.setForm({ ...h.form, supplier_id: e.target.value ? parseInt(e.target.value) : null })}><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div><label className="field-label">Ano</label><input type="number" value={h.form.anio || ""} onChange={(e) => h.setForm({ ...h.form, anio: e.target.value ? parseInt(e.target.value) : null })} /></div>
                <div><label className="field-label">Km</label><input type="number" value={h.form.km || ""} onChange={(e) => h.setForm({ ...h.form, km: e.target.value ? parseInt(e.target.value) : null })} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div><label className="field-label">Precio compra</label><input type="number" step="100" value={h.form.precio_compra || ""} onChange={(e) => h.setForm({ ...h.form, precio_compra: e.target.value ? parseFloat(e.target.value) : null })} /></div>
                <div><label className="field-label">Precio venta</label><input type="number" step="100" value={h.form.precio_venta || ""} onChange={(e) => h.setForm({ ...h.form, precio_venta: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              </div>
              <div><label className="field-label">Notas</label><textarea value={h.form.notes} onChange={(e) => h.setForm({ ...h.form, notes: e.target.value })} rows={3} /></div>
              {h.success && <p className="success-banner">Guardado</p>}
              <button type="submit" className="button primary" disabled={h.saving} style={{ alignSelf: "flex-start" }}>{h.saving ? "Guardando..." : "Guardar"}</button>
            </form>
          </div>
        )}
        {activeTab === "leads" && (
          <div style={{ padding: "1.5rem" }}>
            {vehicleLeads.length > 0 ? <VDLeads vehicleLeads={vehicleLeads} /> : (
              <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#475569", margin: "0 0 0.5rem" }}>Sin leads para este vehiculo</p>
                <p className="muted" style={{ margin: 0 }}>Cuando un cliente contacte interesado en este coche, aparecera aqui.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === "documentos" && (
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div><VDFactura facturas={h.facturas} docFileRef={h.docFileRef} uploadingDoc={h.uploadingDoc} handleUploadDoc={h.handleUploadDoc} handleDeleteDoc={h.handleDeleteDoc} /></div>
            <div><VDPhotos photos={h.photos} fileRef={h.fileRef} uploading={h.uploading} handleUpload={h.handleUpload} handleDeletePhoto={h.handleDeletePhoto} setSelectedPhoto={h.setSelectedPhoto} /></div>
          </div>
        )}
      </section>
    </>
  );
}

// ── PROPOSAL C: Dashboard layout ──
function VehicleDetailC({ vehicle, suppliers, leads, onBack }: VDProps) {
  const h = useVehicleDetail(vehicle);
  const vehicleLeads = leads.filter((l) => l.vehicle_id === vehicle.id);
  return (
    <>
      <VDHero vehicle={vehicle} onBack={onBack} />
      <div style={{ display: "grid", gridTemplateColumns: "35% 35% 30%", gap: "1.25rem" }}>
        {/* Col 1: Photo */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <section className="panel" style={{ overflow: "hidden", padding: 0 }}>
            {h.mainPhoto ? (
              <img src={h.mainPhoto} alt={vehicle.name} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block", borderRadius: 24 }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "4/3", display: "grid", placeItems: "center", background: "#e8ecf2", borderRadius: 24, color: "#64748b", textAlign: "center" }}>
                <div><p style={{ margin: 0, fontWeight: 600 }}>Sin foto</p><p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>Sube fotos desde la galeria</p></div>
              </div>
            )}
          </section>
          {h.photos.length > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto" }}>
              {h.photos.map((p) => (
                <img key={p.id} src={p.url} onClick={() => h.setSelectedPhoto(p.id)}
                  style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 8, cursor: "pointer", flexShrink: 0,
                    border: (h.selectedPhoto === p.id || (!h.selectedPhoto && p === h.photos[0])) ? "2px solid #1d4ed8" : "2px solid transparent" }} />
              ))}
            </div>
          )}
        </div>
        {/* Col 2: Form */}
        <section className="panel" style={{ padding: "1.25rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Datos del vehiculo</p>
          <form onSubmit={(e) => void h.handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div><label className="field-label">Marca y modelo</label><input value={h.form.name} onChange={(e) => h.setForm({ ...h.form, name: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div><label className="field-label">Ano</label><input type="number" value={h.form.anio || ""} onChange={(e) => h.setForm({ ...h.form, anio: e.target.value ? parseInt(e.target.value) : null })} /></div>
              <div><label className="field-label">Km</label><input type="number" value={h.form.km || ""} onChange={(e) => h.setForm({ ...h.form, km: e.target.value ? parseInt(e.target.value) : null })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div><label className="field-label">P. Compra</label><input type="number" step="100" value={h.form.precio_compra || ""} onChange={(e) => h.setForm({ ...h.form, precio_compra: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              <div><label className="field-label">P. Venta</label><input type="number" step="100" value={h.form.precio_venta || ""} onChange={(e) => h.setForm({ ...h.form, precio_venta: e.target.value ? parseFloat(e.target.value) : null })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div><label className="field-label">Estado</label><select value={h.form.estado} onChange={(e) => h.setForm({ ...h.form, estado: e.target.value })}><option value="disponible">Disponible</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option></select></div>
              <div><label className="field-label">Proveedor</label><select value={h.form.supplier_id || ""} onChange={(e) => h.setForm({ ...h.form, supplier_id: e.target.value ? parseInt(e.target.value) : null })}><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            </div>
            <div><label className="field-label">Notas</label><textarea value={h.form.notes} onChange={(e) => h.setForm({ ...h.form, notes: e.target.value })} rows={2} /></div>
            {h.success && <p className="success-banner">Guardado</p>}
            <button type="submit" className="button primary" disabled={h.saving}>{h.saving ? "Guardando..." : "Guardar"}</button>
          </form>
        </section>
        {/* Col 3: Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <section className="panel" style={{ padding: "1.15rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Margen</p>
            {h.margin !== null ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.6rem", fontWeight: 800, color: h.margin >= 0 ? "#166534" : "#991b1b" }}>{h.margin >= 0 ? "+" : ""}{h.margin.toLocaleString("es-ES")} &euro;</span>
                {h.form.precio_compra ? <span style={{ fontSize: "0.82rem", color: "#64748b" }}>({Math.round((h.margin / h.form.precio_compra) * 100)}%)</span> : null}
              </div>
            ) : <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Introduce precios para ver el margen</p>}
          </section>
          <section className="panel" style={{ padding: "1.15rem" }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Leads ({vehicleLeads.length})</p>
            <VDLeads vehicleLeads={vehicleLeads} />
          </section>
          <section className="panel" style={{ padding: "1.15rem" }}>
            <VDFactura facturas={h.facturas} docFileRef={h.docFileRef} uploadingDoc={h.uploadingDoc} handleUploadDoc={h.handleUploadDoc} handleDeleteDoc={h.handleDeleteDoc} />
          </section>
        </div>
      </div>
      <VDPhotos photos={h.photos} fileRef={h.fileRef} uploading={h.uploading} handleUpload={h.handleUpload} handleDeletePhoto={h.handleDeletePhoto} setSelectedPhoto={h.setSelectedPhoto} />
    </>
  );
}

// ============================================================
// Leads List
// ============================================================
function LeadsList({ leads, vehicles: _vehicles, companyId: _companyId, onReload: _onReload }: { leads: api.Lead[]; vehicles: api.Vehicle[]; companyId: number; onReload: () => void }) {
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
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                {lead.canal === "coches.net" && <span className="badge badge-coches">coches.net</span>}
                <span className="badge">{lead.estado}</span>
              </div>
            </div>
            {lead.vehicle_interest && <p className="record-line">Interes: {lead.vehicle_interest}</p>}
            {lead.notes && <p className="record-notes">{lead.notes}</p>}
            {lead.canal === "coches.net" && (
              <a href="https://www.coches.net/concesionario/codinacars/" target="_blank" rel="noopener"
                className="button secondary" style={{ textDecoration: "none", textAlign: "center", fontSize: "0.85rem", padding: "0.5rem 0.8rem" }}>
                Responder en coches.net
              </a>
            )}
          </article>
        ))}
      </section>
    </>
  );
}

// ============================================================
// Clients List
// ============================================================
function ClientsList({ clients, companyId: _companyId, onReload: _onReload }: { clients: api.Client[]; companyId: number; onReload: () => void }) {
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
function SalesList({ records, vehicles, clients, companyId: _companyId, onReload: _onReload }: { records: api.SalesRecord[]; vehicles: api.Vehicle[]; clients: api.Client[]; companyId: number; onReload: () => void }) {
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
function PurchasesList({ records, companyId: _companyId, onReload: _onReload }: { records: api.PurchaseRecord[]; companyId: number; onReload: () => void }) {
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
function SuppliersList({ suppliers, companyId, onReload }: { suppliers: api.Supplier[]; companyId: number; onReload: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCif, setNewCif] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.createSupplier(companyId, {
        name: newName.trim(),
        cif: newCif.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        contact_person: newContactPerson.trim(),
        notes: newNotes.trim(),
      });
      setNewName(""); setNewCif(""); setNewPhone(""); setNewEmail(""); setNewContactPerson(""); setNewNotes("");
      setShowAdd(false);
      onReload();
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Eliminar proveedor "${name}"?`)) return;
    await api.deleteSupplier(id);
    onReload();
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Proveedores</p>
          <h2>Directorio de proveedores</h2>
          <p className="muted">{suppliers.length} proveedor{suppliers.length !== 1 ? "es" : ""}</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button primary" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "Cancelar" : "Nuevo proveedor"}
          </button>
        </div>
      </header>

      {showAdd && (
        <section className="panel" style={{ padding: "1.5rem", maxWidth: "400px", marginBottom: "1rem" }}>
          <p className="eyebrow" style={{ marginBottom: "1rem" }}>Nuevo proveedor</p>
          <form onSubmit={(e) => void handleAdd(e)} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label className="field-label">Nombre proveedor *</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Taller Perez" autoFocus required />
            </div>
            <div>
              <label className="field-label">CIF / NIF</label>
              <input value={newCif} onChange={(e) => setNewCif(e.target.value)} placeholder="B12345678" />
            </div>
            <div>
              <label className="field-label">Persona de contacto</label>
              <input value={newContactPerson} onChange={(e) => setNewContactPerson(e.target.value)} placeholder="Juan Garcia" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="field-label">Telefono</label>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="612 345 678" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="info@taller.com" />
              </div>
            </div>
            <div>
              <label className="field-label">Notas</label>
              <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
            <button type="submit" className="button primary" disabled={adding || !newName.trim()}>
              {adding ? "Guardando..." : "Guardar proveedor"}
            </button>
          </form>
        </section>
      )}

      <section className="panel sales-records-panel">
        <div className="sales-table-scroll">
          <table className="sales-table">
            <thead><tr>
              <th className="sales-th">Proveedor</th>
              <th className="sales-th">CIF</th>
              <th className="sales-th">Contacto</th>
              <th className="sales-th">Telefono</th>
              <th className="sales-th"></th>
            </tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="sales-row">
                  <td className="sales-td"><span className="sales-vehicle-name">{s.name}</span></td>
                  <td className="sales-td">{s.cif || "-"}</td>
                  <td className="sales-td">{s.contact_person || "-"}</td>
                  <td className="sales-td">{s.phone || "-"}</td>
                  <td className="sales-td">
                    <button type="button" className="button danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }} onClick={() => void handleDelete(s.id, s.name)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td className="sales-td" colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No hay proveedores. Pulsa "Nuevo proveedor" para añadir uno.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ============================================================
// Revision Sheet (Vehicle Inspection)
// ============================================================

const INSPECTION_SECTIONS: Array<{ title: string; items: Array<{ key: string; label: string }> }> = [
  {
    title: "Exterior",
    items: [
      { key: "ext_pintura", label: "Pintura (estado general)" },
      { key: "ext_carroceria", label: "Carroceria (golpes, abolladuras)" },
      { key: "ext_cristales", label: "Cristales (parabrisas, ventanillas)" },
      { key: "ext_faros", label: "Faros y pilotos" },
      { key: "ext_espejos", label: "Espejos retrovisores" },
      { key: "ext_limpiaparabrisas", label: "Limpiaparabrisas" },
      { key: "ext_matricula", label: "Matricula y adhesivos" },
    ],
  },
  {
    title: "Interior",
    items: [
      { key: "int_tapiceria", label: "Tapiceria (asientos, techo)" },
      { key: "int_salpicadero", label: "Salpicadero y consola" },
      { key: "int_volante", label: "Volante y mandos" },
      { key: "int_cinturones", label: "Cinturones de seguridad" },
      { key: "int_aire", label: "Aire acondicionado / climatizador" },
      { key: "int_audio", label: "Sistema de audio / pantalla" },
      { key: "int_guantera", label: "Guantera y compartimentos" },
    ],
  },
  {
    title: "Motor y mecanica",
    items: [
      { key: "mot_arranque", label: "Arranque del motor" },
      { key: "mot_ruidos", label: "Ruidos anomalos" },
      { key: "mot_aceite", label: "Nivel de aceite" },
      { key: "mot_refrigerante", label: "Liquido refrigerante" },
      { key: "mot_frenos_liq", label: "Liquido de frenos" },
      { key: "mot_distribucion", label: "Correa de distribucion (estado/km)" },
      { key: "mot_escape", label: "Escape (humos, ruidos)" },
    ],
  },
  {
    title: "Transmision y direccion",
    items: [
      { key: "trans_embrague", label: "Embrague (si manual)" },
      { key: "trans_marchas", label: "Cambio de marchas" },
      { key: "trans_dir_asistida", label: "Direccion asistida" },
      { key: "trans_holguras", label: "Holguras en la direccion" },
    ],
  },
  {
    title: "Frenos y suspension",
    items: [
      { key: "fren_eficacia", label: "Frenado (eficacia)" },
      { key: "fren_discos", label: "Discos y pastillas" },
      { key: "fren_amortiguadores", label: "Amortiguadores" },
      { key: "fren_neumaticos", label: "Estado de los neumaticos (4)" },
      { key: "fren_dibujo", label: "Profundidad del dibujo" },
    ],
  },
  {
    title: "Electrica",
    items: [
      { key: "elec_bateria", label: "Bateria" },
      { key: "elec_luces", label: "Luces (cortas, largas, antiniebla)" },
      { key: "elec_intermitentes", label: "Intermitentes y warning" },
      { key: "elec_elevalunas", label: "Elevalunas electricos" },
      { key: "elec_cierre", label: "Cierre centralizado" },
      { key: "elec_testigos", label: "Testigos en cuadro de instrumentos" },
    ],
  },
  {
    title: "Documentacion",
    items: [
      { key: "doc_itv", label: "ITV en vigor" },
      { key: "doc_permiso", label: "Permiso de circulacion" },
      { key: "doc_ficha", label: "Ficha tecnica" },
      { key: "doc_historial", label: "Historial de mantenimiento" },
    ],
  },
];

type ItemStatus = "ok" | "no" | null;

interface InspectionItemState {
  status: ItemStatus;
  notes: string;
}

function RevisionSheet({ vehicles, companyId }: { vehicles: api.Vehicle[]; companyId: number }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | "">("");
  const [inspectorName, setInspectorName] = useState("");
  const [items, setItems] = useState<Record<string, InspectionItemState>>(() => {
    const init: Record<string, InspectionItemState> = {};
    for (const section of INSPECTION_SECTIONS) {
      for (const item of section.items) {
        init[item.key] = { status: null, notes: "" };
      }
    }
    return init;
  });
  const [resultadoGeneral, setResultadoGeneral] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  function setItemStatus(key: string, status: ItemStatus) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], status: prev[key].status === status ? null : status } }));
  }

  function setItemNotes(key: string, notes: string) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], notes } }));
  }

  function resetForm() {
    const init: Record<string, InspectionItemState> = {};
    for (const section of INSPECTION_SECTIONS) {
      for (const item of section.items) {
        init[item.key] = { status: null, notes: "" };
      }
    }
    setItems(init);
    setResultadoGeneral("");
    setSelectedVehicleId("");
    setInspectorName("");
  }

  async function handleSave() {
    if (!selectedVehicleId) { setSaveMsg("Selecciona un vehiculo."); return; }
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = {
        vehicle_id: selectedVehicleId,
        company_id: companyId,
        inspector_name: inspectorName || null,
        items,
        resultado_general: resultadoGeneral || null,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("vehicle_inspections").insert(payload);
      if (error) throw error;
      setSaveMsg("Revision guardada correctamente.");
      resetForm();
    } catch (err) {
      setSaveMsg("Error al guardar: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  const toggleBtnBase: React.CSSProperties = {
    padding: "0.15rem 0.5rem",
    fontSize: "0.7rem",
    fontWeight: 600,
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    cursor: "pointer",
    lineHeight: 1.4,
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <p className="eyebrow">Inspeccion de vehiculo</p>
      <h2 style={{ margin: "0.3rem 0 1rem" }}>Hoja de revision</h2>

      {/* Vehicle selector */}
      <section className="panel" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 300px" }}>
            <label className="field-label">Vehiculo</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value ? Number(e.target.value) : "")}
              style={{ width: "100%" }}
            >
              <option value="">-- Seleccionar vehiculo --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.anio ? `(${v.anio})` : ""} {(v as any).matricula ? `- ${(v as any).matricula}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label className="field-label">Inspector</label>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="Nombre del inspector"
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </section>

      {/* Inspection sections */}
      {INSPECTION_SECTIONS.map((section) => (
        <section key={section.title} className="panel" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
          <p className="eyebrow">{section.title}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1.5rem", marginTop: "0.5rem" }}>
            {section.items.map((item) => {
              const state = items[item.key];
              return (
                <div key={item.key} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", padding: "0.4rem 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                    <span className="field-label" style={{ margin: 0, fontSize: "0.8rem" }}>{item.label}</span>
                    <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                      <button
                        type="button"
                        style={{
                          ...toggleBtnBase,
                          background: state.status === "ok" ? "#16a34a" : "#fff",
                          color: state.status === "ok" ? "#fff" : "#64748b",
                          borderColor: state.status === "ok" ? "#16a34a" : "#cbd5e1",
                        }}
                        onClick={() => setItemStatus(item.key, "ok")}
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        style={{
                          ...toggleBtnBase,
                          background: state.status === "no" ? "#dc2626" : "#fff",
                          color: state.status === "no" ? "#fff" : "#64748b",
                          borderColor: state.status === "no" ? "#dc2626" : "#cbd5e1",
                        }}
                        onClick={() => setItemStatus(item.key, "no")}
                      >
                        NO
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Notas..."
                    value={state.notes}
                    onChange={(e) => setItemNotes(item.key, e.target.value)}
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* General result + save */}
      <section className="panel" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <p className="eyebrow">Resultado general</p>
        <textarea
          value={resultadoGeneral}
          onChange={(e) => setResultadoGeneral(e.target.value)}
          placeholder="Observaciones generales de la revision..."
          rows={4}
          style={{ width: "100%", marginTop: "0.5rem", fontSize: "0.85rem" }}
        />
        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            className="button primary"
            disabled={saving || !selectedVehicleId}
            onClick={() => void handleSave()}
          >
            {saving ? "Guardando..." : "Guardar revision"}
          </button>
          {saveMsg && <span style={{ fontSize: "0.85rem", color: saveMsg.startsWith("Error") ? "#dc2626" : "#16a34a" }}>{saveMsg}</span>}
        </div>
      </section>
    </div>
  );
}

export default WebApp;
