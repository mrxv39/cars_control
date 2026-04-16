import React, { useState, useEffect, useCallback, useMemo, FormEvent } from "react";
import * as api from "./lib/api";
import { supabase } from "./lib/supabase";
import { FeedbackButton } from "./components/FeedbackButton";
import { BankList } from "./components/BankList";
import { isSuperAdmin } from "./lib/platform-types";
import { PlatformLayout } from "./components/platform/PlatformLayout";
import { RegistrationPage } from "./components/platform/RegistrationPage";
import * as platformApi from "./lib/platform-api";
import { WebDashboard } from "./components/web/WebDashboard";
import { StockList } from "./components/web/StockList";
import { LeadsList } from "./components/web/LeadsList";
import { ClientsList, SalesList, PurchasesList, SuppliersList } from "./components/web/RecordLists";
import { ErrorBoundary } from "./components/ErrorBoundary";
import EmptyState from "./components/web/EmptyState";
import { ProfileView, CompanyView } from "./components/web/ProfileCompanyViews";
import { VehicleDetail, translateError } from "./components/web/VehicleDetailPanel";
import { SkeletonGrid } from "./components/web/Skeleton";
import OnboardingTour from "./components/web/OnboardingTour";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import Car from "lucide-react/dist/esm/icons/car";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Landmark from "lucide-react/dist/esm/icons/landmark";
import Truck from "lucide-react/dist/esm/icons/truck";
import Users from "lucide-react/dist/esm/icons/users";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import ClipboardCheck from "lucide-react/dist/esm/icons/clipboard-check";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import User from "lucide-react/dist/esm/icons/user";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import Search from "lucide-react/dist/esm/icons/search";
import Menu from "lucide-react/dist/esm/icons/menu";
import X from "lucide-react/dist/esm/icons/x";
import "./App.css";

// Detect app mode based on hostname
type AppMode = "store" | "admin" | "both";
function getAppMode(): AppMode {
  const host = window.location.hostname;
  if (host.includes("codinacars")) return "store";
  if (host.includes("carscontrol")) return "admin";
  return "both"; // localhost / legacy domain
}
const APP_MODE = getAppMode();
const STORE_URL = "https://codinacars.vercel.app";
const ADMIN_URL = "https://carscontrol.vercel.app";

type ViewKey = "dashboard" | "stock" | "stock_detail" | "leads" | "clients" | "sales" | "purchases" | "suppliers" | "bank" | "revision" | "profile" | "company";

function WebApp() {
  const [page, setPage] = useState<"catalog" | "login" | "register" | "admin" | "platform">(() => {
    try {
      const saved = localStorage.getItem("cc_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user?.id && parsed?.company?.id) return "admin";
      }
    } catch { /* ignore */ }
    localStorage.removeItem("cc_session");
    // Admin domain skips catalog, goes straight to login
    if (APP_MODE === "admin") return "login";
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
  const [loginFieldErrors, setLoginFieldErrors] = useState<{ user?: string; pass?: string }>({});
  const [oauthLoading, setOauthLoading] = useState(false);

  // Detectar callback de Google OAuth al cargar la página
  useEffect(() => {
    if (session) return; // Ya tiene sesión
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return; // No es un callback OAuth

    setOauthLoading(true);
    void (async () => {
      try {
        const result = await platformApi.linkOAuthSession();
        if (result) {
          localStorage.setItem("cc_session", JSON.stringify(result));
          setSession(result);
          // Si es super_admin, ir al panel de plataforma directamente
          setPage(isSuperAdmin(result.user.role) ? "platform" : "admin");
        } else {
          setLoginError("Tu email no tiene una cuenta en Cars Control. Contacta con el administrador o registra tu empresa.");
          setPage("login");
        }
      } catch (err) {
        setLoginError("Error al vincular cuenta Google. Comprueba tu conexion e intentalo de nuevo.");
        setPage("login");
      } finally {
        setOauthLoading(false);
        // Limpiar el hash de la URL
        window.history.replaceState(null, "", window.location.pathname);
      }
    })();
  }, []);

  async function handleGoogleLogin() {
    setLoginError(null);
    try {
      await platformApi.signInWithGoogle();
      // El navegador redirige a Google, no llegamos aquí hasta el callback
    } catch (err) {
      setLoginError("Error al conectar con Google. Comprueba tu conexion e intentalo de nuevo.");
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    const fieldErrors: { user?: string; pass?: string } = {};
    if (!loginUsername.trim()) fieldErrors.user = "Usuario obligatorio";
    if (!loginPassword) fieldErrors.pass = "Contraseña obligatoria";
    if (Object.keys(fieldErrors).length > 0) { setLoginFieldErrors(fieldErrors); return; }
    setLoginFieldErrors({});
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const result = await api.login(loginUsername, loginPassword);
      localStorage.setItem("cc_session", JSON.stringify(result));
      setSession(result);
      setPage("admin");
    } catch (err) {
      const msg = String(err);
      if (msg.includes("Usuario o contrasena")) setLoginError("Usuario o contraseña incorrectos.");
      else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) setLoginError("Error de conexion. Comprueba tu internet.");
      else setLoginError("Error al iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setLoginSubmitting(false);
    }
  }

  // Registration page (public)
  if (page === "register") {
    return <RegistrationPage onBackToLogin={() => setPage("login")} />;
  }

  // Platform super-admin panel
  if (page === "platform" && session && isSuperAdmin(session.user.role)) {
    return (
      <PlatformLayout
        userId={session.user.id}
        userName={session.user.full_name}
        onBackToCompany={() => setPage("admin")}
      />
    );
  }

  // OAuth loading splash
  if (oauthLoading) {
    return (
      <main className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <section className="panel" style={{ padding: "2rem", textAlign: "center" }}>
          <p className="eyebrow">Cars Control</p>
          <h2>Verificando cuenta Google...</h2>
          <p className="muted">Un momento, estamos vinculando tu cuenta.</p>
        </section>
      </main>
    );
  }

  // Login page
  if (page === "login" && !session) {
    return (
      <div className="catalog-page">
        <CatalogHeader onLogin={() => setPage("login")} onCatalog={() => {
          if (APP_MODE === "admin") { window.location.href = STORE_URL; return; }
          setPage("catalog");
        }} />
        <main className="page-container-narrow">
          <section className="panel" style={{ padding: "2rem" }}>
            <p className="eyebrow">Acceso usuarios</p>
            <h2 style={{ margin: "0.3rem 0 0.5rem" }}>Iniciar sesión</h2>
            <p className="muted" style={{ marginBottom: "1.5rem" }}>Panel de gestion para usuarios autorizados.</p>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              style={{
                width: "100%",
                padding: "0.75rem",
                marginBottom: "1.5rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                background: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                fontSize: "0.95rem",
                fontWeight: 500,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.07 24.07 0 000 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Entrar con Google
            </button>

            <div style={{ textAlign: "center", marginBottom: "1.5rem", color: "#999", fontSize: "0.85rem" }}>
              o con usuario y contraseña
            </div>

            <form onSubmit={(e) => void handleLogin(e)}>
              <div style={{ marginBottom: "1rem" }}>
                <label className="field-label required" htmlFor="login-user">Email o usuario</label>
                <input id="login-user" type="text" className={loginFieldErrors.user ? "input-error" : ""} value={loginUsername} onChange={(e) => { setLoginUsername(e.target.value); setLoginFieldErrors((f) => ({ ...f, user: undefined })); }} placeholder="tu@email.com o nombre de usuario" autoFocus />
                {loginFieldErrors.user && <p className="input-error-message">{loginFieldErrors.user}</p>}
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label className="field-label required" htmlFor="login-pass">Contraseña</label>
                <input id="login-pass" type="password" className={loginFieldErrors.pass ? "input-error" : ""} value={loginPassword} onChange={(e) => { setLoginPassword(e.target.value); setLoginFieldErrors((f) => ({ ...f, pass: undefined })); }} placeholder="Contraseña" />
                {loginFieldErrors.pass && <p className="input-error-message">{loginFieldErrors.pass}</p>}
              </div>
              {loginError && <p className="error-banner" role="alert" style={{ marginBottom: "1rem" }}>{loginError}</p>}
              <button type="submit" className="button primary full-width" disabled={loginSubmitting}>
                {loginSubmitting ? "Entrando..." : "Entrar"}
              </button>
            </form>
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button type="button" className="button secondary" onClick={() => setPage("register")} style={{ fontSize: "0.85rem" }}>
                ¿No tienes cuenta? Registra tu empresa
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // Admin panel
  if (page === "admin" && session) {
    return <AuthenticatedWebApp session={session} onLogout={() => { void platformApi.signOutOAuth(); localStorage.removeItem("cc_session"); setSession(null); setPage(APP_MODE === "admin" ? "login" : "catalog"); }} onOpenPlatform={() => setPage("platform")} />;
  }

  // Public catalog (default)
  return <PublicCatalog onLogin={() => {
    if (APP_MODE === "store") { window.location.href = ADMIN_URL; return; }
    setPage("login");
  }} />;
}

// ============================================================
// Header for public pages
// ============================================================
function CatalogHeader({ onLogin, onCatalog }: { onLogin: () => void; onCatalog: () => void }) {
  return (
    <header className="catalog-topbar">
      <div className="catalog-topbar-inner">
        <button type="button" className="catalog-brand" onClick={onCatalog} aria-label="Ir al catálogo">
          <img src="/logo.png" alt="CodinaCars" className="catalog-logo-img" />
        </button>
        <nav className="catalog-nav">
          <a href="tel:+34646131565" className="catalog-nav-link">646 13 15 65</a>
          {APP_MODE !== "store" && (
            <button type="button" className="catalog-nav-btn" onClick={onLogin}>
              Acceso usuarios
            </button>
          )}
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
  const [thumbs, setThumbs] = useState<Map<number, api.VehiclePhoto>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<api.Vehicle | null>(null);

  // Filtros estructurados
  const [fuelFilter, setFuelFilter] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [sortBy, setSortBy] = useState<"" | "price-asc" | "price-desc" | "year-desc" | "km-asc">("");

  React.useEffect(() => {
    void api.listPublicVehicles(1).then(async (v) => {
      setVehicles(v);
      // Batch: una sola query para todas las fotos primarias
      const photos = await api.listPrimaryPhotos(v.map((x) => x.id));
      setThumbs(photos);
      setLoading(false);
    });
  }, []);

  // Opciones de filtro derivadas de los datos
  const fuelOptions = useMemo(() =>
    [...new Set(vehicles.map((v) => v.fuel).filter(Boolean))].sort(),
    [vehicles]
  );

  const filtered = useMemo(() => {
    // Excluir coches sin precio o vendidos del catálogo público
    let result = vehicles.filter((v) => v.precio_venta && v.precio_venta > 0 && v.estado !== "vendido");

    // Búsqueda de texto libre
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter((v) =>
        [v.name, v.fuel, String(v.anio || ""), String(v.precio_venta || "")]
          .some((f) => f.toLowerCase().includes(q))
      );
    }

    // Filtro por combustible
    if (fuelFilter) {
      result = result.filter((v) => v.fuel === fuelFilter);
    }

    // Filtro por precio máximo
    const maxPrice = Number(priceMax);
    if (maxPrice > 0) {
      result = result.filter((v) => v.precio_venta && v.precio_venta <= maxPrice);
    }

    // Filtro por año mínimo
    const minYear = Number(yearMin);
    if (minYear > 0) {
      result = result.filter((v) => v.anio && v.anio >= minYear);
    }

    // Ordenar
    if (sortBy) {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case "price-asc": return (a.precio_venta || 0) - (b.precio_venta || 0);
          case "price-desc": return (b.precio_venta || 0) - (a.precio_venta || 0);
          case "year-desc": return (b.anio || 0) - (a.anio || 0);
          case "km-asc": return (a.km || 0) - (b.km || 0);
          default: return 0;
        }
      });
    }

    return result;
  }, [vehicles, search, fuelFilter, priceMax, yearMin, sortBy]);

  if (selectedVehicle) {
    return (
      <div className="catalog-page">
        <CatalogHeader onLogin={onLogin} onCatalog={() => setSelectedVehicle(null)} />
        <PublicVehicleDetail vehicle={selectedVehicle} onBack={() => setSelectedVehicle(null)} />
      </div>
    );
  }

  return (
    <div className="catalog-page">
      <CatalogHeader onLogin={onLogin} onCatalog={() => setSelectedVehicle(null)} />

      <section className="catalog-hero-banner">
        <h1>Vehículos de ocasión</h1>
        <p>Compraventa de coches en Molins de Rei, Barcelona</p>
        <div className="catalog-hero-stats">
          <span>{vehicles.filter((v) => v.precio_venta && v.estado !== "vendido").length} vehículos</span>
          <span>Molins de Rei</span>
          <span>+15 años</span>
        </div>
        {/* Search + filtros en el hero */}
        <div className="catalog-hero-bar">
          <div className="catalog-hero-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="catalog-search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="catalog-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar marca, modelo..."
              aria-label="Buscar vehículos"
            />
          </div>
          <select value={fuelFilter} onChange={(e) => setFuelFilter(e.target.value)} aria-label="Combustible" className={`catalog-hero-chip ${fuelFilter ? "active" : ""}`}>
            <option value="">Combustible</option>
            {fuelOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={priceMax} onChange={(e) => setPriceMax(e.target.value)} aria-label="Precio" className={`catalog-hero-chip ${priceMax ? "active" : ""}`}>
            <option value="">Precio</option>
            <option value="8000">8.000 €</option>
            <option value="12000">12.000 €</option>
            <option value="18000">18.000 €</option>
            <option value="25000">25.000 €</option>
            <option value="35000">35.000 €</option>
          </select>
          <select value={yearMin} onChange={(e) => setYearMin(e.target.value)} aria-label="Año" className={`catalog-hero-chip ${yearMin ? "active" : ""}`}>
            <option value="">Año</option>
            <option value="2024">2024+</option>
            <option value="2022">2022+</option>
            <option value="2020">2020+</option>
            <option value="2018">2018+</option>
            <option value="2015">2015+</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Ordenar" className={`catalog-hero-chip ${sortBy ? "active" : ""}`}>
            <option value="">Ordenar</option>
            <option value="price-asc">Precio ↑</option>
            <option value="price-desc">Precio ↓</option>
            <option value="year-desc">Recientes</option>
            <option value="km-asc">Menos km</option>
          </select>
          {(fuelFilter || priceMax || yearMin || sortBy) && (
            <button type="button" className="catalog-hero-chip-clear" onClick={() => { setFuelFilter(""); setPriceMax(""); setYearMin(""); setSortBy(""); }}>✕</button>
          )}
        </div>
      </section>

      <main className="catalog-main">
        <div className="catalog-result-bar">
          <span className="catalog-result-count">{filtered.length} vehículo{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <SkeletonGrid count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No se encontraron vehículos con estos filtros" icon="🔍" />
        ) : (
          <div className="catalog-grid">
            {filtered.map((v) => {
              const thumb = thumbs.get(v.id);
              const imgUrl = thumb?.thumbUrl || thumb?.url || null;
              return (
                <article key={v.id} className="catalog-card" tabIndex={0} role="button" onClick={() => setSelectedVehicle(v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedVehicle(v); } }}>
                  <div className="catalog-card-img">
                    {imgUrl ? <img src={imgUrl} alt={v.name || ""} loading="lazy" /> : (
                      <div className="catalog-card-noimg">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.25"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M5 6l2-3h10l2 3"/></svg>
                      </div>
                    )}
                    {v.estado === "reservado" && <span className="catalog-badge-reserved">Reservado</span>}
                  </div>
                  <div className="catalog-card-body">
                    <h3 className="catalog-card-title">{v.name}</h3>
                    <div className="catalog-card-specs">
                      {v.anio && <span>{v.anio}</span>}
                      {v.km != null && <span>{v.km.toLocaleString()} km</span>}
                      {v.fuel && <span>{v.fuel}</span>}
                      {v.color && <span>{v.color}</span>}
                    </div>
                    {v.precio_venta && (
                      <p className="catalog-card-price">{v.precio_venta.toLocaleString("es-ES")} €</p>
                    )}
                    {v.notes && v.notes.startsWith("Desde") && (
                      <p className="catalog-card-financing">{v.notes.split("|")[0].trim()}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="catalog-footer">
        <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "rgba(255,255,255,0.85)", marginBottom: "0.5rem" }}>CodinaCars</p>
        <p><a href="https://maps.google.com/?q=C/+Sant+Antoni+Maria+Claret+3,+08750+Molins+de+Rei" target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "2px" }}>C/ Sant Antoni Maria Claret 3, Bajos 2, 08750 Molins de Rei (Barcelona)</a></p>
        <p>Tel: <a href="tel:+34646131565" style={{ color: "inherit" }}>646 13 15 65</a> · codinacars@gmail.com</p>
        <p>Lunes a Viernes 10:00–14:00 / 16:00–20:00 · Sábados con cita previa</p>
      </footer>

      {/* WhatsApp FAB — visible on mobile for quick contact */}
      <a
        href="https://wa.me/34646131565?text=Hola%2C%20he%20visto%20un%20coche%20en%20vuestra%20web"
        className="whatsapp-fab"
        target="_blank"
        rel="noopener"
        aria-label="Contactar por WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </div>
  );
}

// ============================================================
// Public Vehicle Detail
// ============================================================
function PublicVehicleDetail({ vehicle, onBack }: { vehicle: api.Vehicle; onBack: () => void }) {
  const [photos, setPhotos] = useState<api.VehiclePhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  React.useEffect(() => {
    void api.listVehiclePhotos(vehicle.id).then(setPhotos);
  }, [vehicle.id]);

  // Escape closes lightbox
  React.useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxOpen]);

  const mainPhotoIdx = selectedPhoto != null ? photos.findIndex((p) => p.id === selectedPhoto) : 0;
  const mainPhoto = photos[mainPhotoIdx >= 0 ? mainPhotoIdx : 0]?.url;
  function prevPhoto() { if (mainPhotoIdx > 0) setSelectedPhoto(photos[mainPhotoIdx - 1].id); }
  function nextPhoto() { if (mainPhotoIdx < photos.length - 1) setSelectedPhoto(photos[mainPhotoIdx + 1].id); }

  return (
    <main className="catalog-main">
      <button type="button" className="catalog-back" onClick={onBack}>← Volver al listado</button>

      {/* Lightbox with focus trap */}
      {lightboxOpen && mainPhoto && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-label="Foto ampliada"
          aria-modal="true"
          ref={(el) => {
            if (!el) return;
            // Focus the close button on open
            const closeBtn = el.querySelector<HTMLButtonElement>(".lightbox-close");
            closeBtn?.focus();
            // Trap focus inside dialog
            const trap = (e: KeyboardEvent) => {
              if (e.key !== "Tab") return;
              const focusable = el.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
              if (focusable.length === 0) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
              else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            };
            el.addEventListener("keydown", trap);
          }}
        >
          <button type="button" className="lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Cerrar">
            <X size={28} />
          </button>
          <img src={mainPhoto} alt={vehicle.name} className="lightbox-img" />
        </div>
      )}

      <div className="catalog-detail">
        <div className="catalog-detail-gallery">
          {mainPhoto ? (
            <div className="catalog-detail-main-img" style={{ position: "relative" }}>
              <img src={mainPhoto} alt={vehicle.name} loading="lazy" onClick={() => setLightboxOpen(true)} style={{ cursor: "zoom-in" }} />
              {photos.length > 1 && mainPhotoIdx > 0 && <button type="button" className="gallery-arrow gallery-arrow-left" onClick={prevPhoto} aria-label="Foto anterior">‹</button>}
              {photos.length > 1 && mainPhotoIdx < photos.length - 1 && <button type="button" className="gallery-arrow gallery-arrow-right" onClick={nextPhoto} aria-label="Foto siguiente">›</button>}
              {photos.length > 1 && <span className="gallery-counter">{mainPhotoIdx + 1} / {photos.length}</span>}
            </div>
          ) : (
            <div className="catalog-detail-main-img catalog-detail-noimg">
              <span style={{ fontSize: "3rem" }}>🚗</span>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>Fotos no disponibles</span>
            </div>
          )}
          {photos.length > 1 && (
            <div className="catalog-detail-thumbs">
              {photos.map((p) => (
                <img
                  key={p.id} src={p.url} alt="" loading="lazy"
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
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="catalog-contact-form">
        <p className="success-banner" role="status" style={{ textAlign: "center" }}>Mensaje enviado. Te contactaremos pronto.</p>
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
      <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Contactar por este vehículo</p>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="contact-name">Nombre</label>
          <input id="contact-name" name="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" required maxLength={100} />
        </div>
        <div>
          <label className="field-label" htmlFor="contact-phone">Teléfono</label>
          <input id="contact-phone" name="Telefono" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="600 123 456" required pattern="[0-9\s\+]{9,15}" title="Introduce un teléfono válido (9-15 dígitos)" />
        </div>
      </div>
      <div style={{ marginTop: "0.5rem" }}>
        <label className="field-label" htmlFor="contact-message">Mensaje (opcional)</label>
        <textarea id="contact-message" name="Mensaje" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ej: ¿Está disponible? ¿Se puede financiar?" rows={3} maxLength={500} />
      </div>
      <button type="submit" className="button primary" style={{ width: "100%", marginTop: "0.75rem" }}>
        Enviar consulta
      </button>
    </form>
  );
}

// ── Pagination Controls ──
// ── Global Search Results ──
function GlobalSearchResults({ query, vehicles, leads, clients, onSelect }: {
  query: string;
  vehicles: api.Vehicle[];
  leads: api.Lead[];
  clients: api.Client[];
  onSelect: (type: "vehicle" | "lead" | "client", id: number) => void;
}) {
  const q = query.toLowerCase().trim();

  const matchedVehicles = vehicles.filter((v) =>
    [v.name, String(v.anio || "")].some((f) => f.toLowerCase().includes(q))
  ).slice(0, 5);

  const matchedLeads = leads.filter((l) =>
    [l.name, l.phone, l.vehicle_interest].some((f) => f.toLowerCase().includes(q))
  ).slice(0, 5);

  const matchedClients = clients.filter((c) =>
    [c.name, c.dni, c.email, c.phone].some((f) => f.toLowerCase().includes(q))
  ).slice(0, 5);

  const hasResults = matchedVehicles.length > 0 || matchedLeads.length > 0 || matchedClients.length > 0;

  return (
    <div role="listbox" aria-label="Resultados de búsqueda" style={{
      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
      background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px",
      marginTop: "0.35rem", maxHeight: "320px", overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      {!hasResults && (
        <p style={{ padding: "0.85rem 1rem", margin: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>Sin resultados</p>
      )}
      {matchedVehicles.length > 0 && (
        <div>
          <p style={{ padding: "0.5rem 1rem 0.25rem", margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)" }}>Vehículos</p>
          {matchedVehicles.map((v) => (
            <button key={v.id} type="button" onClick={() => onSelect("vehicle", v.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 1rem", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "0.88rem" }}>
              {v.name} <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>{v.anio || ""}</span>
            </button>
          ))}
        </div>
      )}
      {matchedLeads.length > 0 && (
        <div>
          <p style={{ padding: "0.5rem 1rem 0.25rem", margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)" }}>Leads</p>
          {matchedLeads.map((l) => (
            <button key={l.id} type="button" onClick={() => onSelect("lead", l.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 1rem", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "0.88rem" }}>
              {l.name} <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>{l.phone}</span>
            </button>
          ))}
        </div>
      )}
      {matchedClients.length > 0 && (
        <div>
          <p style={{ padding: "0.5rem 1rem 0.25rem", margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)" }}>Clientes</p>
          {matchedClients.map((c) => (
            <button key={c.id} type="button" onClick={() => onSelect("client", c.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 1rem", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "0.88rem" }}>
              {c.name} <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>{c.dni || c.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "stock", label: "Stock", icon: Car },
  { key: "sales", label: "Ventas", icon: Receipt },
  { key: "purchases", label: "Compras", icon: ShoppingCart },
  { key: "bank", label: "Banco", icon: Landmark },
  { key: "suppliers", label: "Proveedores", icon: Truck },
  { key: "leads", label: "Leads", icon: Users },
  { key: "clients", label: "Clientes", icon: UserCheck },
  // Recordatorios eliminado (sesión Ricard 2026-04-04): los recordatorios
  // ahora son inline en stock/leads (chips de checklist).
  { key: "revision", label: "Revision", icon: ClipboardCheck },
];

function AuthenticatedWebApp({ session, onLogout, onOpenPlatform }: { session: api.LoginResult; onLogout: () => void; onOpenPlatform?: () => void }) {
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
  const [globalSearch, setGlobalSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const showToast = useCallback((message: string) => setToast({ message, key: Date.now() }), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  React.useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [v, allV, l, c, s, p, sup] = await Promise.all([
        api.listVehicles(companyId).catch(() => [] as api.Vehicle[]),
        api.listAllVehicles(companyId).catch(() => [] as api.Vehicle[]),
        api.listLeads(companyId).catch(() => [] as api.Lead[]),
        api.listClients(companyId).catch(() => [] as api.Client[]),
        api.listSalesRecords(companyId).catch(() => [] as api.SalesRecord[]),
        api.listPurchaseRecords(companyId).catch(() => [] as api.PurchaseRecord[]),
        api.listSuppliers(companyId).catch(() => [] as api.Supplier[]),
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
      showToast(translateError(err));
    } finally {
      setLoading(false);
    }
  }

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const shortcuts = useMemo(() => ({
    "/": () => searchInputRef.current?.focus(),
    "escape": () => { setSelectedVehicle(null); setGlobalSearch(""); setMobileMenuOpen(false); },
  }), []);
  useKeyboardShortcuts(shortcuts);

  if (loading) {
    return (
      <main className="shell">
        <aside className="sidebar">
          <div>
            <p className="eyebrow"><Car size={14} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />Cars Control</p>
            <div className="skeleton-line skeleton-lg" style={{ marginTop: "0.5rem" }} />
            <div className="skeleton-line skeleton-sm" style={{ marginTop: "0.5rem" }} />
          </div>
        </aside>
        <section className="content">
          <SkeletonGrid count={6} />
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <button
        type="button"
        className="mobile-menu-btn"
        aria-label={mobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {mobileMenuOpen && <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div>
          <p className="eyebrow"><Car size={14} style={{ verticalAlign: "-2px", marginRight: "0.3rem" }} />Cars Control</p>
          <button
            type="button"
            className="sidebar-link"
            onClick={() => { setCurrentView("company"); setMobileMenuOpen(false); }}
            title="Editar datos de empresa"
          >
            <h1 className="sidebar-title"><Building2 size={16} style={{ verticalAlign: "-2px", marginRight: "0.4rem", opacity: 0.7 }} />{session.company.trade_name}</h1>
          </button>
          <button
            type="button"
            className="sidebar-link"
            onClick={() => { setCurrentView("profile"); setMobileMenuOpen(false); }}
            title="Editar mi perfil"
          >
            <p className="muted" style={{ margin: 0 }}><User size={13} style={{ verticalAlign: "-2px", marginRight: "0.3rem", opacity: 0.7 }} />{session.user.full_name} ({session.user.role})</p>
          </button>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", opacity: 0.5, pointerEvents: "none" }} />
          <input
            ref={searchInputRef}
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Buscar... (pulsa / para enfocar)"
            aria-expanded={globalSearch.trim().length >= 2}
            aria-haspopup="listbox"
            style={{ width: "100%", padding: "0.7rem 1rem 0.7rem 2.2rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "inherit", fontSize: "0.88rem" }}
          />
          {globalSearch.trim().length >= 2 && (
            <GlobalSearchResults
              query={globalSearch}
              vehicles={vehicles}
              leads={leads}
              clients={clients}
              onSelect={(type, _id) => {
                setGlobalSearch("");
                if (type === "vehicle") setCurrentView("stock");
                else if (type === "lead") setCurrentView("leads");
                else if (type === "client") setCurrentView("clients");
              }}
            />
          )}
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={currentView === item.key ? "nav-item active" : "nav-item"}
                onClick={() => { setCurrentView(item.key); setSelectedVehicle(null); setMobileMenuOpen(false); }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-tools panel">
          {onOpenPlatform && isSuperAdmin(session.user.role) && (
            <button type="button" className="button secondary full-width" onClick={onOpenPlatform} style={{ marginBottom: "0.5rem" }}>
              Panel plataforma
            </button>
          )}
          <button type="button" className="button primary full-width" onClick={() => setShowOnboarding(true)} style={{ marginBottom: "0.5rem", background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }}>
            <ClipboardCheck size={15} style={{ verticalAlign: "-2px", marginRight: "0.4rem" }} />Ayuda / Tutorial
          </button>
          <button type="button" className="button danger full-width" onClick={onLogout}>
            <LogOut size={16} style={{ verticalAlign: "-3px", marginRight: "0.4rem" }} />Cerrar sesión
          </button>
        </div>
      </aside>
      <section className="content">
        {loading && <div className="content-loading-bar" />}
        {currentView === "dashboard" && (
          <WebDashboard
            vehicles={vehicles}
            allVehicles={allVehicles}
            leads={leads}
            salesRecords={salesRecords}
            purchaseRecords={purchaseRecords}
            onReload={loadAll}
            onNavigate={(view) => { setCurrentView(view as ViewKey); }}
          />
        )}
        {currentView === "stock" && !selectedVehicle && (
          <StockList vehicles={vehicles} allVehicles={allVehicles} leads={leads} purchaseRecords={purchaseRecords} companyId={companyId} dealerWebsite={session.company.website || ""} onSelect={setSelectedVehicle} onReload={loadAll} externalSearch={globalSearch} />
        )}
        {currentView === "stock" && selectedVehicle && (
          <VehicleDetail vehicle={selectedVehicle} suppliers={suppliers} leads={leads} purchaseRecords={purchaseRecords} companyId={companyId} clients={clients} onBack={() => { setSelectedVehicle(null); void loadAll(); }} onReload={loadAll} />
        )}
        {currentView === "leads" && <LeadsList leads={leads} vehicles={vehicles} companyId={companyId} onReload={loadAll} />}
        {currentView === "clients" && <ClientsList clients={clients} companyId={companyId} onReload={loadAll} />}
        {currentView === "sales" && <SalesList records={salesRecords} vehicles={vehicles} clients={clients} companyId={companyId} company={session.company} onReload={loadAll} />}
        {currentView === "purchases" && <PurchasesList records={purchaseRecords} companyId={companyId} onReload={loadAll} />}
        {currentView === "bank" && <BankList companyId={companyId} />}
        {currentView === "suppliers" && <SuppliersList suppliers={suppliers} companyId={companyId} onReload={loadAll} />}
        {currentView === "revision" && <RevisionSheet vehicles={allVehicles} companyId={companyId} />}
        {currentView === "profile" && <ProfileView session={session} />}
        {currentView === "company" && <CompanyView session={session} />}
      </section>

      <FeedbackButton
        userName={session.user.full_name}
        currentView={selectedVehicle ? "vehículo: " + selectedVehicle.name : currentView}
        stock={vehicles}
        leads={leads}
        clients={clients}
        selectedVehicle={selectedVehicle}
      />

      {toast && (
        <div className="toast success" role="status" key={toast.key}>
          {toast.message}
          <button type="button" style={{ background: "none", border: "none", color: "inherit", marginLeft: "0.75rem", cursor: "pointer", fontSize: "0.85rem" }} onClick={() => setToast(null)} aria-label="Cerrar">✕</button>
        </div>
      )}

      <OnboardingTour show={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </main>
  );
}

// ============================================================
// Stock List
// ============================================================
// ProfileView, CompanyView -> extracted to components/web/ProfileCompanyViews.tsx
// VehicleDetail + sub-components -> extracted to components/web/VehicleDetailPanel.tsx
// translateError -> exported from VehicleDetailPanel.tsx
// ============================================================
// Leads List
// ============================================================
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
      { key: "trans_dir_asistida", label: "Dirección asistida" },
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
  const [history, setHistory] = useState<api.VehicleInspection[]>([]);

  useEffect(() => {
    if (selectedVehicleId) {
      void api.listVehicleInspections(Number(selectedVehicleId)).then(setHistory);
    } else {
      setHistory([]);
    }
  }, [selectedVehicleId]);

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
    if (!selectedVehicleId) { setSaveMsg("Selecciona un vehículo."); return; }
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
      const savedVehicleId = selectedVehicleId;
      resetForm();
      if (savedVehicleId) void api.listVehicleInspections(Number(savedVehicleId)).then(setHistory);
    } catch (err) {
      setSaveMsg("Error al guardar. Intentalo de nuevo.");
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
      <p className="eyebrow">Inspección de vehículo</p>
      <h2 style={{ margin: "0.3rem 0 1rem" }}>Hoja de revision</h2>

      {/* Vehicle selector */}
      <section className="panel" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 300px" }}>
            <label className="field-label">Vehículo</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value ? Number(e.target.value) : "")}
              className="full-width"
            >
              <option value="">-- Seleccionar vehículo --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.anio ? `(${v.anio})` : ""} {v.plate ? `- ${v.plate}` : ""}
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
              className="full-width"
            />
          </div>
        </div>
      </section>

      {/* Inspection sections */}
      {INSPECTION_SECTIONS.map((section) => (
        <section key={section.title} className="panel" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
          <p className="eyebrow">{section.title}</p>
          <div className="form-grid-2" style={{ gap: "0.5rem 1.5rem", marginTop: "0.5rem" }}>
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

      {/* Inspection History */}
      {history.length > 0 && (
        <section className="panel" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
          <p className="eyebrow">Historial de revisiones</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
            {history.map((insp) => {
              const totalItems = Object.keys(insp.items).length;
              const okCount = Object.values(insp.items).filter((i) => i.status === "ok").length;
              const noCount = Object.values(insp.items).filter((i) => i.status === "no").length;
              return (
                <div key={insp.id} style={{ padding: "0.75rem", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.5)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>
                        {new Date(insp.created_at).toLocaleDateString("es-ES")}
                        {insp.inspector_name && <span className="muted"> — {insp.inspector_name}</span>}
                      </p>
                      <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
                        {okCount} OK · {noCount} NO · {totalItems - okCount - noCount} sin revisar
                      </p>
                    </div>
                    <button type="button" className="button danger" style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
                      onClick={async () => { await api.deleteVehicleInspection(insp.id); setHistory((h) => h.filter((x) => x.id !== insp.id)); }}>
                      Eliminar
                    </button>
                  </div>
                  {insp.resultado_general && <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", fontStyle: "italic" }}>{insp.resultado_general}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function WebAppWithBoundary() {
  return (
    <ErrorBoundary>
      <WebApp />
    </ErrorBoundary>
  );
}

export default WebAppWithBoundary;
