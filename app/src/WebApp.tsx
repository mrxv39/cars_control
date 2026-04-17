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
import { ProfileView, CompanyView } from "./components/web/ProfileCompanyViews";
import { VehicleDetail } from "./components/web/VehicleDetailPanel";
import { translateError } from "./lib/translateError";
import { onToast, type ToastType } from "./lib/toast";
import { SkeletonGrid } from "./components/web/Skeleton";
import { PublicCatalog, CatalogHeader } from "./components/web/PublicCatalog";
import OnboardingTour from "./components/web/OnboardingTour";
import { RevisionSheet } from "./components/web/RevisionSheet";
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
  const [forgotPassword, setForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
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
        setLoginError("Error al vincular cuenta Google. Comprueba tu conexión e inténtalo de nuevo.");
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
      setLoginError("Error al conectar con Google. Comprueba tu conexión e inténtalo de nuevo.");
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
            <p className="muted" style={{ marginBottom: "1.5rem" }}>Panel de gestión para usuarios autorizados.</p>

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

            {forgotPassword ? (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!forgotEmail.trim()) { setForgotMsg({ text: "Introduce tu email.", ok: false }); return; }
                setForgotSubmitting(true);
                setForgotMsg(null);
                const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo: `${window.location.origin}` });
                setForgotSubmitting(false);
                if (error) { setForgotMsg({ text: "No se pudo enviar el email. Verifica la dirección.", ok: false }); }
                else { setForgotMsg({ text: "Email enviado. Revisa tu bandeja de entrada (y spam).", ok: true }); }
              }}>
                <div style={{ marginBottom: "1rem" }}>
                  <label className="field-label required" htmlFor="forgot-email">Email de tu cuenta</label>
                  <input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="tu@email.com" autoFocus required />
                </div>
                {forgotMsg && <p className={forgotMsg.ok ? "success-banner" : "error-banner"} role="alert" style={{ marginBottom: "1rem" }}>{forgotMsg.text}</p>}
                <button type="submit" className="button primary full-width" disabled={forgotSubmitting}>
                  {forgotSubmitting ? "Enviando..." : "Enviar enlace de recuperación"}
                </button>
                <div style={{ textAlign: "center", marginTop: "0.75rem" }}>
                  <button type="button" className="button secondary" onClick={() => { setForgotPassword(false); setForgotMsg(null); }} style={{ fontSize: "0.85rem" }}>
                    Volver al login
                  </button>
                </div>
              </form>
            ) : (
              <>
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
                <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                  <button type="button" style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "0.82rem" }} onClick={() => setForgotPassword(true)}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                  <button type="button" className="button secondary" onClick={() => setPage("register")} style={{ fontSize: "0.85rem" }}>
                    ¿No tienes cuenta? Registra tu empresa
                  </button>
                </div>
              </>
            )}
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

// PublicCatalog, CatalogHeader, PublicVehicleDetail, ContactForm -> extracted to components/web/PublicCatalog.tsx

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
  { key: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { key: "stock", label: "Stock", icon: Car },
  { key: "sales", label: "Ventas", icon: Receipt },
  { key: "purchases", label: "Compras", icon: ShoppingCart },
  { key: "bank", label: "Banco", icon: Landmark },
  { key: "suppliers", label: "Proveedores", icon: Truck },
  { key: "leads", label: "Interesados", icon: Users },
  { key: "clients", label: "Clientes", icon: UserCheck },
  // Recordatorios eliminado (sesión Ricard 2026-04-04): los recordatorios
  // ahora son inline en stock/leads (chips de checklist).
  { key: "revision", label: "Revisión", icon: ClipboardCheck },
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType; key: number } | null>(null);
  const showToastLocal = useCallback((message: string, type: ToastType = "success") => setToast({ message, type, key: Date.now() }), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => onToast((msg, type) => showToastLocal(msg, type)), [showToastLocal]);

  React.useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
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
      const msg = translateError(err);
      setLoadError(msg);
      showToastLocal(msg, "error");
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
        aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
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
            <p className="muted" style={{ margin: 0 }}><User size={13} style={{ verticalAlign: "-2px", marginRight: "0.3rem", opacity: 0.7 }} />{session.user.full_name} ({({ owner: "Propietario", admin: "Administrador", viewer: "Visor", super_admin: "Super Admin" } as Record<string, string>)[session.user.role] || session.user.role})</p>
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
        {loadError && (
          <div className="error-banner" role="alert" style={{ margin: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{loadError}</span>
            <button type="button" className="button primary" style={{ marginLeft: "1rem", whiteSpace: "nowrap" }} onClick={() => void loadAll()}>Reintentar</button>
          </div>
        )}
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
        companyId={companyId}
      />

      {toast && (
        <div className={`toast ${toast.type}`} role={toast.type === "error" ? "alert" : "status"} key={toast.key}>
          {toast.message}
          <button type="button" style={{ background: "none", border: "none", color: "inherit", marginLeft: "0.75rem", cursor: "pointer", fontSize: "0.85rem" }} onClick={() => setToast(null)} aria-label="Cerrar">✕</button>
        </div>
      )}

      <OnboardingTour show={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </main>
  );
}

// RevisionSheet -> extracted to components/web/RevisionSheet.tsx

function WebAppWithBoundary() {
  return (
    <ErrorBoundary>
      <WebApp />
    </ErrorBoundary>
  );
}

export default WebAppWithBoundary;
