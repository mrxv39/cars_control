import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateSuggestions, getViewContext } from "../lib/feedbackSuggestions";
import type { FBVehicle, FBLead, FBClient, Suggestion } from "../lib/feedbackSuggestions";

interface Props {
  userName: string;
  currentView: string;
  stock: FBVehicle[];
  leads: FBLead[];
  clients: FBClient[];
  selectedVehicle?: FBVehicle | null;
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

  const suggestions = useMemo(
    () => generateSuggestions(viewContext, stock, leads, clients, selectedVehicle, dismissed),
    [stock, leads, clients, viewContext, selectedVehicle, dismissed],
  );

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
