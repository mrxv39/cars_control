import { FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LoginResult } from "../types";

export function TauriLoginForm({ onLogin }: { onLogin: (session: LoginResult) => void }) {
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
      onLogin(result);
    } catch (err) {
      setLoginError(String(err));
    } finally {
      setLoginSubmitting(false);
    }
  }

  return (
    <main className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <section className="panel" style={{ maxWidth: 400, width: "100%", padding: "2rem" }}>
        <p className="eyebrow">Cars Control</p>
        <h1 style={{ marginBottom: "0.5rem" }}>Iniciar sesión</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>Introduce tus credenciales para acceder a la aplicación.</p>
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
            <label className="field-label" htmlFor="login-pass">Contraseña</label>
            <input
              id="login-pass"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Contraseña"
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
