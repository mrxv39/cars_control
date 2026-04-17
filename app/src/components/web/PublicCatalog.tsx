import React, { useState, useMemo } from "react";
import * as api from "../../lib/api";
import { SkeletonGrid } from "./Skeleton";
import EmptyState from "./EmptyState";
import X from "lucide-react/dist/esm/icons/x";

// Detect app mode based on hostname
function getAppMode(): "store" | "admin" | "both" {
  const host = window.location.hostname;
  if (host.includes("codinacars")) return "store";
  if (host.includes("carscontrol")) return "admin";
  return "both";
}
const APP_MODE = getAppMode();

export function CatalogHeader({ onLogin, onCatalog }: { onLogin: () => void; onCatalog: () => void }) {
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

function ContactForm({ vehicleName }: { vehicleName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="catalog-contact-form">
        <p className="success-banner" role="status" style={{ textAlign: "center" }}>Mensaje enviado. Te contactaremos pronto.</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    try {
      const body = new FormData();
      body.append("_subject", `Consulta: ${vehicleName}`);
      body.append("_template", "table");
      body.append("_captcha", "false");
      body.append("Vehiculo", vehicleName);
      body.append("Nombre", name);
      body.append("Telefono", phone);
      body.append("Mensaje", message);
      const resp = await fetch("https://formsubmit.co/codinacars@gmail.com", { method: "POST", body });
      if (!resp.ok) throw new Error("Error del servidor");
      setSent(true);
    } catch {
      setSendError("No se pudo enviar el mensaje. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      className="catalog-contact-form"
      onSubmit={(e) => void handleSubmit(e)}
    >
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
      {sendError && <p className="error-banner" role="alert" style={{ marginTop: "0.5rem" }}>{sendError}</p>}
      <button type="submit" className="button primary" style={{ width: "100%", marginTop: "0.75rem" }} disabled={sending}>
        {sending ? "Enviando..." : "Enviar consulta"}
      </button>
    </form>
  );
}

function PublicVehicleDetail({ vehicle, onBack }: { vehicle: api.Vehicle; onBack: () => void }) {
  const [photos, setPhotos] = useState<api.VehiclePhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  React.useEffect(() => {
    void api.listVehiclePhotos(vehicle.id).then(setPhotos).catch(() => setPhotos([]));
  }, [vehicle.id]);

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

      {lightboxOpen && mainPhoto && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-label="Foto ampliada"
          aria-modal="true"
          ref={(el) => {
            if (!el) return;
            const closeBtn = el.querySelector<HTMLButtonElement>(".lightbox-close");
            closeBtn?.focus();
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
              <img src={mainPhoto} alt={vehicle.name} onClick={() => setLightboxOpen(true)} style={{ cursor: "zoom-in" }} />
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
                <img key={p.id} src={p.url} alt="" loading="lazy"
                  className={selectedPhoto === p.id || (!selectedPhoto && p === photos[0]) ? "active" : ""}
                  onClick={() => setSelectedPhoto(p.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="catalog-detail-info">
          <h1>{vehicle.name}</h1>
          {vehicle.precio_venta && <p className="catalog-detail-price">{vehicle.precio_venta.toLocaleString("es-ES")} €</p>}
          <table className="catalog-detail-specs">
            <tbody>
              {vehicle.anio && <tr><td>Año</td><td>{vehicle.anio}</td></tr>}
              {vehicle.km && <tr><td>Kilometraje</td><td>{vehicle.km.toLocaleString()} km</td></tr>}
              {vehicle.fuel && <tr><td>Combustible</td><td>{vehicle.fuel}</td></tr>}
              {vehicle.cv && <tr><td>Potencia</td><td>{vehicle.cv}</td></tr>}
              {vehicle.transmission && <tr><td>Cambio</td><td>{vehicle.transmission}</td></tr>}
              {vehicle.color && <tr><td>Color</td><td>{vehicle.color}</td></tr>}
              <tr><td>Estado</td><td>{{ disponible: "Disponible", reservado: "Reservado", vendido: "Vendido", listo_para_venta: "Listo para venta" }[vehicle.estado] || vehicle.estado}</td></tr>
            </tbody>
          </table>
          {vehicle.notes && vehicle.notes.startsWith("Desde") && (
            <div className="catalog-detail-financing">
              <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>Financiación</p>
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

export function PublicCatalog({ onLogin }: { onLogin: () => void }) {
  const [vehicles, setVehicles] = useState<api.Vehicle[]>([]);
  const [thumbs, setThumbs] = useState<Map<number, api.VehiclePhoto>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<api.Vehicle | null>(null);
  const [fuelFilter, setFuelFilter] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [sortBy, setSortBy] = useState<"" | "price-asc" | "price-desc" | "year-desc" | "km-asc">("");

  React.useEffect(() => {
    void api.listPublicVehicles(1).then(async (v) => {
      setVehicles(v);
      const photos = await api.listPrimaryPhotos(v.map((x) => x.id));
      setThumbs(photos);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, []);

  const fuelOptions = useMemo(() => [...new Set(vehicles.map((v) => v.fuel).filter(Boolean))].sort(), [vehicles]);

  const filtered = useMemo(() => {
    let result = vehicles.filter((v) => v.precio_venta && v.precio_venta > 0 && v.estado !== "vendido");
    const q = search.toLowerCase().trim();
    if (q) result = result.filter((v) => [v.name, v.fuel, String(v.anio || ""), String(v.precio_venta || "")].some((f) => f.toLowerCase().includes(q)));
    if (fuelFilter) result = result.filter((v) => v.fuel === fuelFilter);
    const maxPrice = Number(priceMax);
    if (maxPrice > 0) result = result.filter((v) => v.precio_venta && v.precio_venta <= maxPrice);
    const minYear = Number(yearMin);
    if (minYear > 0) result = result.filter((v) => v.anio && v.anio >= minYear);
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
        <div className="catalog-hero-bar">
          <div className="catalog-hero-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="catalog-search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="catalog-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar marca, modelo..." aria-label="Buscar vehículos" />
          </div>
          <select value={fuelFilter} onChange={(e) => setFuelFilter(e.target.value)} aria-label="Combustible" className={`catalog-hero-chip ${fuelFilter ? "active" : ""}`}>
            <option value="">Combustible</option>
            {fuelOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={priceMax} onChange={(e) => setPriceMax(e.target.value)} aria-label="Precio" className={`catalog-hero-chip ${priceMax ? "active" : ""}`}>
            <option value="">Precio</option>
            <option value="8000">8.000 €</option><option value="12000">12.000 €</option><option value="18000">18.000 €</option><option value="25000">25.000 €</option><option value="35000">35.000 €</option>
          </select>
          <select value={yearMin} onChange={(e) => setYearMin(e.target.value)} aria-label="Año" className={`catalog-hero-chip ${yearMin ? "active" : ""}`}>
            <option value="">Año</option>
            <option value="2024">2024+</option><option value="2022">2022+</option><option value="2020">2020+</option><option value="2018">2018+</option><option value="2015">2015+</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Ordenar" className={`catalog-hero-chip ${sortBy ? "active" : ""}`}>
            <option value="">Ordenar</option>
            <option value="price-asc">Precio ↑</option><option value="price-desc">Precio ↓</option><option value="year-desc">Recientes</option><option value="km-asc">Menos km</option>
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
                    {v.precio_venta && <p className="catalog-card-price">{v.precio_venta.toLocaleString("es-ES")} €</p>}
                    {v.notes && v.notes.startsWith("Desde") && <p className="catalog-card-financing">{v.notes.split("|")[0].trim()}</p>}
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

      <a href="https://wa.me/34646131565?text=Hola%2C%20he%20visto%20un%20coche%20en%20vuestra%20web" className="whatsapp-fab" target="_blank" rel="noopener" aria-label="Contactar por WhatsApp">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </div>
  );
}
