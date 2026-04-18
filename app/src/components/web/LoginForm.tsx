import { useState, useEffect, FormEvent } from "react";
import * as api from "../../lib/api";
import * as platformApi from "../../lib/platform-api";
import { supabase } from "../../lib/supabase";
import { isSuperAdmin } from "../../lib/platform-types";
import { CatalogHeader } from "./PublicCatalog";
import { GoogleIcon } from "./GoogleIcon";

type AppMode = "store" | "admin" | "both";

export type LoginFormProps = {
  appMode: AppMode;
  storeUrl: string;
  onLoginSuccess: (result: api.LoginResult) => void;
  onOpenPlatform: (result: api.LoginResult) => void;
  onRegister: () => void;
  onCatalog: () => void;
};

export function LoginForm({ appMode, storeUrl, onLoginSuccess, onOpenPlatform, onRegister, onCatalog }: LoginFormProps) {
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
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    setOauthLoading(true);
    void (async () => {
      try {
        const result = await platformApi.linkOAuthSession();
        if (result) {
          localStorage.setItem("cc_session", JSON.stringify(result));
          if (isSuperAdmin(result.user.role)) onOpenPlatform(result);
          else onLoginSuccess(result);
        } else {
          setLoginError("Tu email no tiene una cuenta en Cars Control. Contacta con el administrador o registra tu empresa.");
        }
      } catch {
        setLoginError("Error al vincular cuenta Google. Comprueba tu conexión e inténtalo de nuevo.");
      } finally {
        setOauthLoading(false);
        window.history.replaceState(null, "", window.location.pathname);
      }
    })();
  }, []);

  async function handleGoogleLogin() {
    setLoginError(null);
    try {
      await platformApi.signInWithGoogle();
    } catch {
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
      onLoginSuccess(result);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("Usuario o contrasena")) setLoginError("Usuario o contraseña incorrectos.");
      else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) setLoginError("Error de conexion. Comprueba tu internet.");
      else setLoginError("Error al iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setLoginSubmitting(false);
    }
  }

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

  return (
    <div className="catalog-page">
      <CatalogHeader onLogin={() => { /* already on login */ }} onCatalog={() => {
        if (appMode === "admin") { window.location.href = storeUrl; return; }
        onCatalog();
      }} />
      <main className="page-container-narrow">
        <section className="panel" style={{ padding: "2rem" }}>
          <p className="eyebrow">Acceso usuarios</p>
          <h2 style={{ margin: "0.3rem 0 0.5rem" }}>Iniciar sesión</h2>
          <p className="muted" style={{ marginBottom: "1.5rem" }}>Panel de gestión para usuarios autorizados.</p>

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
            <GoogleIcon />
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
                <button type="button" className="button secondary" onClick={onRegister} style={{ fontSize: "0.85rem" }}>
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
