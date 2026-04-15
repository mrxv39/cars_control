import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

// Minimal interfaces compatible with both Tauri (types.ts) and Web (api.ts) types
interface FBVehicle {
  name: string;
  estado?: string;
  precio_compra?: number | null;
  precio_venta?: number | null;
  km?: number | null;
  anio?: number | null;
  ad_url?: string;
  notes?: string;
}

interface FBLead {
  id: number;
  name: string;
  estado?: string;
  fecha_contacto?: string | null;
  canal?: string | null;
  converted_client_id?: number | null;
}

interface FBClient {
  id: number;
}

interface Props {
  userName: string;
  currentView: string;
  stock: FBVehicle[];
  leads: FBLead[];
  clients: FBClient[];
  selectedVehicle?: FBVehicle | null;
}

interface Suggestion {
  id: string;
  icon: string;
  title: string;
  description: string;
  impact: "alto" | "medio" | "bajo";
  category: "automatizacion" | "seguimiento" | "datos" | "ventas";
}

// Detect which "logical" view we're on
function getViewContext(currentView: string): string {
  if (currentView.startsWith("vehiculo:")) return "vehicle_detail";
  return currentView;
}

const FAB_SEEN_KEY = "cc_fab_seen";

export function FeedbackButton({ userName, currentView, stock, leads, clients, selectedVehicle }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"sugerencias" | "mensaje">("sugerencias");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fabSeen, setFabSeen] = useState(() => { try { return !!localStorage.getItem(FAB_SEEN_KEY); } catch { return true; } });
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("cc_dismissed_suggestions");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const viewContext = getViewContext(currentView);

  // --- Contextual suggestions based on current view ---
  const suggestions = useMemo(() => {
    const tips: Suggestion[] = [];
    const now = new Date();
    const hace7Dias = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace3Dias = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // ═══════════════════════════════════════════════
    // VEHICLE DETAIL VIEW - suggestions for this vehicle
    // ═══════════════════════════════════════════════
    if (viewContext === "vehicle_detail" && selectedVehicle) {
      const v = selectedVehicle;

      if (!v.precio_compra) {
        tips.push({
          id: "vehicle_sin_precio_compra",
          icon: "\u{1F4B8}",
          title: "Falta precio de compra",
          description: "Sin el precio de compra no se puede calcular el margen de beneficio de este vehiculo.",
          impact: "alto",
          category: "datos",
        });
      }
      if (!v.precio_venta) {
        tips.push({
          id: "vehicle_sin_precio_venta",
          icon: "\u{1F3F7}\u{FE0F}",
          title: "Falta precio de venta",
          description: "Pon un precio de venta para que aparezca en el catalogo web y se pueda calcular el margen.",
          impact: "alto",
          category: "datos",
        });
      }
      if (!v.anio) {
        tips.push({
          id: "vehicle_sin_anio",
          icon: "\u{1F4C5}",
          title: "Falta el ano del vehiculo",
          description: "Los compradores filtran por ano. Anadelo para que aparezca en las busquedas.",
          impact: "medio",
          category: "datos",
        });
      }
      if (!v.km && v.km !== 0) {
        tips.push({
          id: "vehicle_sin_km",
          icon: "\u{1F697}",
          title: "Faltan los kilometros",
          description: "Los km son uno de los datos mas importantes para el comprador. Anadelos para generar mas confianza.",
          impact: "medio",
          category: "datos",
        });
      }
      if (!v.ad_url) {
        tips.push({
          id: "vehicle_sin_anuncio",
          icon: "\u{1F310}",
          title: "No tiene enlace de anuncio",
          description: "Vincula el anuncio de coches.net, Wallapop u otro portal para acceder rapido y controlar el estado de la publicacion.",
          impact: "bajo",
          category: "datos",
        });
      }
      if (v.precio_compra && v.precio_venta) {
        const margen = v.precio_venta - v.precio_compra;
        if (margen < 500) {
          tips.push({
            id: "vehicle_margen_bajo",
            icon: "\u{26A0}\u{FE0F}",
            title: `Margen muy ajustado: ${margen.toLocaleString("es-ES")}\u{20AC}`,
            description: "Con gastos de preparacion, ITP y transporte el beneficio real puede ser muy bajo o negativo. Revisa el precio de venta.",
            impact: "alto",
            category: "ventas",
          });
        } else if (margen > 0) {
          tips.push({
            id: "vehicle_margen_ok",
            icon: "\u{2705}",
            title: `Margen estimado: ${margen.toLocaleString("es-ES")}\u{20AC}`,
            description: "Recuerda que hay que descontar gastos de preparacion (taller, limpieza, transporte, ITP...) para el beneficio real.",
            impact: "bajo",
            category: "ventas",
          });
        }
      }
      if (v.estado === "reservado") {
        tips.push({
          id: "vehicle_reservado_cerrar",
          icon: "\u{1F4DD}",
          title: "Vehiculo reservado - pendiente de cerrar",
          description: "Recuerda registrar la venta cuando se formalice y marcarlo como vendido.",
          impact: "medio",
          category: "ventas",
        });
      }

      return tips.filter((t) => !dismissed.has(t.id));
    }

    // ═══════════════════════════════════════════════
    // STOCK LIST VIEW
    // ═══════════════════════════════════════════════
    if (viewContext === "stock") {
      const sinPrecios = stock.filter((v) => v.estado !== "vendido" && (!v.precio_compra || !v.precio_venta));
      if (sinPrecios.length > 0) {
        tips.push({
          id: "stock_sin_precios",
          icon: "\u{1F4B0}",
          title: `${sinPrecios.length} vehiculo${sinPrecios.length > 1 ? "s" : ""} sin precios completos`,
          description: `Entra en cada ficha y completa precio de compra y venta para calcular el margen: ${sinPrecios.slice(0, 3).map((v) => v.name).join(", ")}${sinPrecios.length > 3 ? "..." : ""}.`,
          impact: "medio",
          category: "datos",
        });
      }
      const reservados = stock.filter((v) => v.estado === "reservado");
      if (reservados.length > 0) {
        tips.push({
          id: "stock_reservados",
          icon: "\u{1F512}",
          title: `${reservados.length} vehiculo${reservados.length > 1 ? "s" : ""} reservado${reservados.length > 1 ? "s" : ""}`,
          description: `Pendientes de cerrar venta: ${reservados.map((v) => v.name).join(", ")}.`,
          impact: "medio",
          category: "ventas",
        });
      }
      const sinEstado = stock.filter((v) => !v.estado);
      if (sinEstado.length > 0) {
        tips.push({
          id: "stock_sin_estado",
          icon: "\u{1F3F7}\u{FE0F}",
          title: `${sinEstado.length} vehiculo${sinEstado.length > 1 ? "s" : ""} sin estado`,
          description: "Marca cada vehiculo como disponible, reservado o vendido para tener estadisticas precisas.",
          impact: "medio",
          category: "datos",
        });
      }
      return tips.filter((t) => !dismissed.has(t.id));
    }

    // ═══════════════════════════════════════════════
    // LEADS VIEW
    // ═══════════════════════════════════════════════
    if (viewContext === "leads") {
      const sinContacto = leads.filter((l) => (l.estado === "nuevo" || !l.estado) && !l.fecha_contacto);
      if (sinContacto.length > 0) {
        tips.push({
          id: "leads_sin_contacto",
          icon: "\u{1F4DE}",
          title: `${sinContacto.length} lead${sinContacto.length > 1 ? "s" : ""} sin primer contacto`,
          description: `Responde rapido para aumentar la conversion: ${sinContacto.slice(0, 3).map((l) => l.name).join(", ")}${sinContacto.length > 3 ? "..." : ""}.`,
          impact: "alto",
          category: "seguimiento",
        });
      }
      const sinSeguimiento = leads.filter((l) => {
        if (!l.fecha_contacto) return false;
        return new Date(l.fecha_contacto) < hace7Dias && !["cerrado", "perdido"].includes(l.estado || "");
      });
      if (sinSeguimiento.length > 0) {
        tips.push({
          id: "leads_sin_seguimiento",
          icon: "\u{23F0}",
          title: `${sinSeguimiento.length} lead${sinSeguimiento.length > 1 ? "s" : ""} sin seguimiento (+7 dias)`,
          description: `Llevan mas de una semana sin contacto. Haz seguimiento o marcalos como "perdido".`,
          impact: "alto",
          category: "seguimiento",
        });
      }
      const negociandoViejos = leads.filter((l) => {
        if (l.estado !== "negociando" || !l.fecha_contacto) return false;
        return new Date(l.fecha_contacto) < hace3Dias;
      });
      if (negociandoViejos.length > 0) {
        tips.push({
          id: "leads_negociando_viejos",
          icon: "\u{1F504}",
          title: `${negociandoViejos.length} negociacion${negociandoViejos.length > 1 ? "es" : ""} estancada${negociandoViejos.length > 1 ? "s" : ""}`,
          description: "Leads en negociacion sin actividad reciente. Actualiza su estado o haz seguimiento.",
          impact: "medio",
          category: "seguimiento",
        });
      }
      const cerradosSinConvertir = leads.filter((l) => l.estado === "cerrado" && !l.converted_client_id);
      if (cerradosSinConvertir.length > 0) {
        tips.push({
          id: "leads_cerrados_convertir",
          icon: "\u{1F91D}",
          title: `${cerradosSinConvertir.length} venta${cerradosSinConvertir.length > 1 ? "s" : ""} sin registrar como cliente`,
          description: "Convertir leads cerrados en clientes permite hacer seguimiento postventa.",
          impact: "medio",
          category: "ventas",
        });
      }
      const leadsCoches = leads.filter((l) => l.canal === "coches.net");
      if (leadsCoches.length === 0 && leads.length > 0) {
        tips.push({
          id: "leads_coches_net",
          icon: "\u{1F4E7}",
          title: "Importacion automatica de coches.net",
          description: "Puedes configurar la importacion automatica de leads desde los emails de coches.net.",
          impact: "alto",
          category: "automatizacion",
        });
      }
      return tips.filter((t) => !dismissed.has(t.id));
    }

    // ═══════════════════════════════════════════════
    // CLIENTS VIEW
    // ═══════════════════════════════════════════════
    if (viewContext === "clients") {
      if (leads.length > 10 && clients.length < leads.length * 0.1) {
        tips.push({
          id: "clients_conversion_baja",
          icon: "\u{1F4C9}",
          title: "Tasa de conversion baja",
          description: `Tienes ${leads.length} leads pero solo ${clients.length} clientes. Revisa si hay ventas cerradas sin convertir.`,
          impact: "medio",
          category: "ventas",
        });
      }
      const cerradosSinConvertir = leads.filter((l) => l.estado === "cerrado" && !l.converted_client_id);
      if (cerradosSinConvertir.length > 0) {
        tips.push({
          id: "clients_leads_pendientes",
          icon: "\u{1F91D}",
          title: `${cerradosSinConvertir.length} lead${cerradosSinConvertir.length > 1 ? "s" : ""} cerrado${cerradosSinConvertir.length > 1 ? "s" : ""} pendiente${cerradosSinConvertir.length > 1 ? "s" : ""} de convertir`,
          description: "Ve a Leads y usa 'Convertir en cliente' para registrarlos.",
          impact: "medio",
          category: "ventas",
        });
      }
      return tips.filter((t) => !dismissed.has(t.id));
    }

    // ═══════════════════════════════════════════════
    // SALES / PURCHASES / SUPPLIERS / DASHBOARD - general tips
    // ═══════════════════════════════════════════════
    if (viewContext === "sales") {
      const reservados = stock.filter((v) => v.estado === "reservado");
      if (reservados.length > 0) {
        tips.push({
          id: "sales_reservados",
          icon: "\u{1F512}",
          title: `${reservados.length} vehiculo${reservados.length > 1 ? "s" : ""} reservado${reservados.length > 1 ? "s" : ""} sin venta registrada`,
          description: `Registra la venta cuando se formalice: ${reservados.map((v) => v.name).join(", ")}.`,
          impact: "medio",
          category: "ventas",
        });
      }
    }

    if (viewContext === "purchases") {
      tips.push({
        id: "purchases_tip",
        icon: "\u{1F4CB}",
        title: "Registra todos los gastos",
        description: "Anota taller, transporte, limpieza y otros gastos vinculados a cada vehiculo para conocer el coste real y el beneficio neto.",
        impact: "bajo",
        category: "datos",
      });
    }

    // Dashboard - high-level overview
    if (viewContext === "dashboard") {
      const sinContacto = leads.filter((l) => (l.estado === "nuevo" || !l.estado) && !l.fecha_contacto);
      if (sinContacto.length > 0) {
        tips.push({
          id: "dash_leads_nuevos",
          icon: "\u{1F4DE}",
          title: `${sinContacto.length} lead${sinContacto.length > 1 ? "s" : ""} esperando respuesta`,
          description: "Ve a Leads para contactarlos.",
          impact: "alto",
          category: "seguimiento",
        });
      }
      const reservados = stock.filter((v) => v.estado === "reservado");
      if (reservados.length > 0) {
        tips.push({
          id: "dash_reservados",
          icon: "\u{1F512}",
          title: `${reservados.length} vehiculo${reservados.length > 1 ? "s" : ""} reservado${reservados.length > 1 ? "s" : ""}`,
          description: "Pendientes de formalizar venta.",
          impact: "medio",
          category: "ventas",
        });
      }
    }

    return tips.filter((t) => !dismissed.has(t.id));
  }, [stock, leads, clients, viewContext, selectedVehicle, dismissed]);

  function dismissSuggestion(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("cc_dismissed_suggestions", JSON.stringify([...next]));
      return next;
    });
  }

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from("feedback").insert({
        user_name: userName,
        category: "mensaje",
        message: message.trim(),
        page: currentView,
        created_at: new Date().toISOString(),
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage("");
        setTab("sugerencias");
      }, 1500);
    } catch (err) {
      console.error("Error sending feedback:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendSuggestionFeedback(suggestion: Suggestion, response: "util" | "no_util") {
    try {
      await supabase.from("feedback").insert({
        user_name: userName,
        category: "sugerencia_" + response,
        message: `[${suggestion.id}] ${suggestion.title}`,
        page: currentView,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error sending suggestion feedback:", err);
    }
    if (response === "no_util") {
      dismissSuggestion(suggestion.id);
    }
  }

  const impactColor = (impact: string) =>
    impact === "alto" ? "#dc2626" : impact === "medio" ? "#d97706" : "#6b7280";

  const impactLabel = (impact: string) =>
    impact === "alto" ? "Prioritario" : impact === "medio" ? "Recomendado" : "Opcional";

  const categoryLabel = (cat: string) =>
    cat === "automatizacion" ? "Automatizacion"
    : cat === "seguimiento" ? "Seguimiento"
    : cat === "datos" ? "Datos"
    : "Ventas";

  const viewLabel = viewContext === "vehicle_detail" ? "Ficha vehiculo" : currentView;

  return (
    <>
      <button
        type="button"
        className={`feedback-fab${!fabSeen ? " pulse" : ""}`}
        onClick={() => { setOpen(true); if (!fabSeen) { setFabSeen(true); try { localStorage.setItem(FAB_SEEN_KEY, "1"); } catch { /* ignore */ } } }}
        title="Sugerencias y optimizaciones"
      >
        {suggestions.length > 0 && (
          <span className="feedback-badge">{suggestions.length}</span>
        )}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => { if (!submitting) setOpen(false); }}>
          <div
            className="modal-card panel feedback-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">Asistente - {viewLabel}</p>
            <h3 className="modal-title">
              {viewContext === "vehicle_detail" && selectedVehicle
                ? selectedVehicle.name
                : "Optimiza tu tiempo"}
            </h3>

            <div className="feedback-tabs">
              <button
                type="button"
                className={`feedback-tab ${tab === "sugerencias" ? "active" : ""}`}
                onClick={() => setTab("sugerencias")}
              >
                Sugerencias {suggestions.length > 0 && <span className="feedback-tab-count">{suggestions.length}</span>}
              </button>
              <button
                type="button"
                className={`feedback-tab ${tab === "mensaje" ? "active" : ""}`}
                onClick={() => setTab("mensaje")}
              >
                Enviar mensaje
              </button>
            </div>

            {tab === "sugerencias" && (
              <div className="feedback-suggestions">
                {suggestions.length === 0 ? (
                  <div className="feedback-empty">
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{"\u2705"}</div>
                    <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>Todo en orden</p>
                    <p className="muted" style={{ margin: 0 }}>
                      {viewContext === "vehicle_detail"
                        ? "Esta ficha tiene toda la informacion completa."
                        : "No hay sugerencias pendientes en esta seccion."}
                    </p>
                  </div>
                ) : (
                  suggestions.map((s) => (
                    <div key={s.id} className="suggestion-card">
                      <div className="suggestion-card-header">
                        <span className="suggestion-card-icon">{s.icon}</span>
                        <div style={{ flex: 1 }}>
                          <p className="suggestion-card-title">{s.title}</p>
                          <div className="suggestion-card-tags">
                            <span className="suggestion-tag" style={{ color: impactColor(s.impact), borderColor: impactColor(s.impact) }}>
                              {impactLabel(s.impact)}
                            </span>
                            <span className="suggestion-tag suggestion-tag-cat">
                              {categoryLabel(s.category)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="suggestion-card-desc">{s.description}</p>
                      <div className="suggestion-card-actions">
                        <button
                          type="button"
                          className="suggestion-action-btn"
                          title="Ocultar sugerencia"
                          onClick={() => {
                            void sendSuggestionFeedback(s, "no_util");
                          }}
                        >
                          Ocultar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "mensaje" && (
              <div className="feedback-message-tab">
                {sent ? (
                  <div className="feedback-empty">
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{"\u2705"}</div>
                    <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>Enviado</p>
                    <p className="muted" style={{ margin: 0 }}>Gracias por tu mensaje!</p>
                  </div>
                ) : (
                  <>
                    <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
                      Desde: <strong>{currentView}</strong> - Escribe cualquier idea, problema o peticion.
                    </p>
                    <textarea
                      className="feedback-textarea"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ej: Me gustaria poder filtrar vehiculos por precio, o que al crear un lead se envie un WhatsApp automatico..."
                      autoFocus
                      rows={4}
                    />
                    <div className="actions">
                      <button
                        type="button"
                        className="button primary"
                        disabled={submitting || !message.trim()}
                        onClick={() => void handleSubmit()}
                      >
                        {submitting ? "Enviando..." : "Enviar"}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={submitting}
                        onClick={() => setOpen(false)}
                      >
                        Cerrar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
