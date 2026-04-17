import React, { useState, FormEvent } from "react";
import * as api from "../../lib/api";
import { showToast } from "../../lib/toast";
import { translateError } from "../../lib/translateError";

function ProfileView({ session }: { session: api.LoginResult }) {
  const [fullName, setFullName] = useState(session.user.full_name);
  const [username, setUsername] = useState(session.user.username);
  // Si el usuario aún no tiene email propio, prefijar con el de la empresa
  const [email, setEmail] = useState(session.user.email || session.company.email || "");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Refrescar desde DB al montar para evitar mostrar sesión cacheada vieja.
  React.useEffect(() => {
    void api.getUser(session.user.id).then((u) => {
      if (!u) return;
      setFullName(u.full_name || "");
      setUsername(u.username || "");
      setEmail(u.email || session.company.email || "");
      const stored = localStorage.getItem("cc_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.user = { ...parsed.user, ...u };
        localStorage.setItem("cc_session", JSON.stringify(parsed));
      }
    });
  }, [session.user.id]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await api.updateUser(session.user.id, { full_name: fullName, username, email });
      // Actualizar la sesión guardada en localStorage para reflejar los cambios sin re-login
      const stored = localStorage.getItem("cc_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.user.full_name = fullName;
        parsed.user.username = username;
        parsed.user.email = email;
        localStorage.setItem("cc_session", JSON.stringify(parsed));
      }
      setMsg({ kind: "ok", text: "Perfil actualizado correctamente." });
      showToast("Perfil actualizado", "success");
    } catch (err: unknown) {
      setMsg({ kind: "err", text: translateError(err) });
    } finally { setSaving(false); }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pw1.length < 6) { setMsg({ kind: "err", text: "La contraseña debe tener al menos 6 caracteres" }); return; }
    if (pw1 !== pw2) { setMsg({ kind: "err", text: "Las contraseñas no coinciden" }); return; }
    setSaving(true); setMsg(null);
    try {
      await api.updateUserPassword(session.user.id, pw1);
      setPw1(""); setPw2("");
      setMsg({ kind: "ok", text: "Contraseña actualizada correctamente" });
    } catch (err: unknown) {
      setMsg({ kind: "err", text: translateError(err) });
    } finally { setSaving(false); }
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Mi cuenta</p>
          <h2>Perfil de usuario</h2>
          <p className="muted">Rol: {({ owner: "Propietario", admin: "Administrador", viewer: "Solo lectura", super_admin: "Super Admin" } as Record<string, string>)[session.user.role] || session.user.role}</p>
        </div>
      </header>
      {msg && (
        <section className="panel" style={{ padding: "0.75rem 1rem", marginBottom: "1rem", background: msg.kind === "ok" ? "var(--color-bg-success, #f0fdf4)" : "var(--color-bg-error, #fef2f2)" }}>
          <p style={{ margin: 0, color: msg.kind === "ok" ? "#15803d" : "#b91c1c" }}>{msg.text}</p>
        </section>
      )}
      <section className="panel" style={{ padding: "1.25rem", maxWidth: "560px" }}>
        <h3 style={{ margin: "0 0 1rem" }}>Datos personales</h3>
        <form onSubmit={(e) => void saveProfile(e)} className="form-stack">
          <div>
            <label className="field-label required">Nombre completo</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className="field-label required">Nombre de usuario</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" />
          </div>
          <div className="form-actions">
            <button type="submit" className="button primary" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
          </div>
        </form>
      </section>
      <section className="panel" style={{ padding: "1.25rem", maxWidth: "560px", marginTop: "1rem" }}>
        <h3 style={{ margin: "0 0 1rem" }}>Cambiar contraseña</h3>
        <form onSubmit={(e) => void changePassword(e)} className="form-stack">
          <div>
            <label className="field-label required">Nueva contraseña</label>
            <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" required />
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.78rem" }}>Mínimo 6 caracteres.</p>
          </div>
          <div>
            <label className="field-label">Repetir contraseña</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="form-actions">
            <button type="submit" className="button primary" disabled={saving}>{saving ? "Cambiando..." : "Cambiar contraseña"}</button>
          </div>
        </form>
      </section>
    </>
  );
}

function CompanyView({ session }: { session: api.LoginResult }) {
  const [tradeName, setTradeName] = useState(session.company.trade_name);
  const [legalName, setLegalName] = useState(session.company.legal_name || "");
  const [cif, setCif] = useState(session.company.cif || "");
  const [address, setAddress] = useState(session.company.address || "");
  const [phone, setPhone] = useState(session.company.phone || "");
  const [email, setEmail] = useState(session.company.email || "");
  const [website, setWebsite] = useState(session.company.website || "");
  const [saving, setSaving] = useState(false);

  // Refrescar desde DB al montar — la sesión en localStorage puede estar
  // desactualizada (por ejemplo después de añadir columnas nuevas a la tabla).
  React.useEffect(() => {
    void api.getCompany(session.company.id).then((c) => {
      if (!c) return;
      setTradeName(c.trade_name || "");
      setLegalName(c.legal_name || "");
      setCif(c.cif || "");
      setAddress(c.address || "");
      setPhone(c.phone || "");
      setEmail(c.email || "");
      setWebsite(c.website || "");
      // Actualizar también el localStorage para que el sidebar y otras vistas
      // tengan la versión fresca.
      const stored = localStorage.getItem("cc_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.company = { ...parsed.company, ...c };
        localStorage.setItem("cc_session", JSON.stringify(parsed));
      }
    });
  }, [session.company.id]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await api.updateCompany(session.company.id, {
        trade_name: tradeName, legal_name: legalName, cif, address, phone, email, website,
      });
      const stored = localStorage.getItem("cc_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.company = { ...parsed.company, trade_name: tradeName, legal_name: legalName, cif, address, phone, email, website };
        localStorage.setItem("cc_session", JSON.stringify(parsed));
      }
      setMsg({ kind: "ok", text: "Datos de empresa actualizados correctamente." });
      showToast("Empresa actualizada", "success");
    } catch (err: unknown) {
      setMsg({ kind: "err", text: translateError(err) });
    } finally { setSaving(false); }
  }

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Empresa</p>
          <h2>Datos de la empresa</h2>
          <p className="muted">Estos datos se usarán en facturas, contratos y documentos generados por la app.</p>
        </div>
      </header>
      {msg && (
        <section className="panel" style={{ padding: "0.75rem 1rem", marginBottom: "1rem", background: msg.kind === "ok" ? "var(--color-bg-success, #f0fdf4)" : "var(--color-bg-error, #fef2f2)" }}>
          <p style={{ margin: 0, color: msg.kind === "ok" ? "#15803d" : "#b91c1c" }}>{msg.text}</p>
        </section>
      )}
      <section className="panel" style={{ padding: "1.25rem", maxWidth: "720px" }}>
        <form onSubmit={(e) => void save(e)} className="form-stack">
          <div className="form-grid-2">
            <div>
              <label className="field-label required">Nombre comercial</label>
              <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Razón social</label>
              <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label">CIF / NIF</label>
              <input value={cif} onChange={(e) => setCif(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Teléfono</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Web</label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.coches.net/concesionario/..." />
          </div>
          <div>
            <label className="field-label">Dirección</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="submit" className="button primary" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
          </div>
        </form>
      </section>
    </>
  );
}

export { ProfileView, CompanyView };
