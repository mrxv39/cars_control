import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "./lib/api";
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
import { PublicCatalog } from "./components/web/PublicCatalog";
import { LoginForm } from "./components/web/LoginForm";
import { GlobalSearchResults } from "./components/web/GlobalSearchResults";
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

  // Login page
  if (page === "login" && !session) {
    return (
      <LoginForm
        appMode={APP_MODE}
        storeUrl={STORE_URL}
        onLoginSuccess={(result) => { setSession(result); setPage("admin"); }}
        onOpenPlatform={(result) => { setSession(result); setPage("platform"); }}
        onRegister={() => setPage("register")}
        onCatalog={() => setPage("catalog")}
      />
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

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  viewer: "Visor",
  super_admin: "Super Admin",
};

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

// Vistas que se recuerdan entre sesiones — evita que F5 te devuelva a Stock
// cuando estabas revisando Banco/Leads. stock_detail queda fuera porque
// depende de un vehículo seleccionado que no se rehidrata.
const PERSISTABLE_VIEWS: ViewKey[] = ["dashboard", "stock", "leads", "clients", "sales", "purchases", "suppliers", "bank", "revision", "profile", "company"];

function AuthenticatedWebApp({ session, onLogout, onOpenPlatform }: { session: api.LoginResult; onLogout: () => void; onOpenPlatform?: () => void }) {
  const companyId = session.company.id;
  const [currentView, setCurrentView] = useState<ViewKey>(() => {
    try {
      const saved = localStorage.getItem("cc_last_view");
      if (saved && (PERSISTABLE_VIEWS as string[]).includes(saved)) return saved as ViewKey;
    } catch { /* ignore */ }
    return "stock";
  });
  useEffect(() => {
    if ((PERSISTABLE_VIEWS as string[]).includes(currentView)) {
      try { localStorage.setItem("cc_last_view", currentView); } catch { /* ignore */ }
    }
  }, [currentView]);
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
            <p className="eyebrow"><Car size={14} className="icon-inline" />Cars Control</p>
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
          <p className="eyebrow"><Car size={14} className="icon-inline" />Cars Control</p>
          <button
            type="button"
            className="sidebar-link"
            onClick={() => { setCurrentView("company"); setMobileMenuOpen(false); }}
            title="Editar datos de empresa"
          >
            <h1 className="sidebar-title"><Building2 size={16} className="icon-inline icon-inline--wider icon-inline--soft" />{session.company.trade_name}</h1>
          </button>
          <button
            type="button"
            className="sidebar-link"
            onClick={() => { setCurrentView("profile"); setMobileMenuOpen(false); }}
            title="Editar mi perfil"
          >
            <p className="muted" style={{ margin: 0 }}><User size={13} className="icon-inline icon-inline--soft" />{session.user.full_name} ({ROLE_LABELS[session.user.role] || session.user.role})</p>
          </button>
        </div>
        <div className="sidebar-search">
          <Search size={15} className="sidebar-search-icon" />
          <input
            ref={searchInputRef}
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Buscar... (pulsa / para enfocar)"
            aria-expanded={globalSearch.trim().length >= 2}
            aria-haspopup="listbox"
            className="sidebar-search-input"
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
          <button type="button" className="button primary full-width button-hint" onClick={() => setShowOnboarding(true)}>
            <ClipboardCheck size={15} className="icon-inline icon-inline--wider" />Ayuda / Tutorial
          </button>
          <button type="button" className="button danger full-width" onClick={onLogout}>
            <LogOut size={16} style={{ verticalAlign: "-3px", marginRight: "0.4rem" }} />Cerrar sesión
          </button>
        </div>
      </aside>
      <section className="content">
        {loading && <div className="content-loading-bar" />}
        {loadError && (
          <div className="error-banner error-banner--retry" role="alert">
            <span>{loadError}</span>
            <button type="button" className="button primary" onClick={() => void loadAll()}>Reintentar</button>
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
          <button type="button" className="toast-close" onClick={() => setToast(null)} aria-label="Cerrar">✕</button>
        </div>
      )}

      <OnboardingTour show={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </main>
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
