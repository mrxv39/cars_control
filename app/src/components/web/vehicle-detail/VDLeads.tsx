import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../../lib/api";
import EmptyState from "../EmptyState";
import Spinner from "../Spinner";
import { showToast } from "../../../lib/toast";
import { translateError } from "../../../lib/translateError";
import { cleanLeadMessage } from "../../../lib/leadMessageClean";

type Tab = "mensajes" | "llamadas";

function formatDateCompact(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDateDay(ts: string): string {
  const d = new Date(ts);
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return days[d.getDay()];
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function VDChat({ leadId, leadNotes }: { leadId: number; leadNotes?: string }) {
  const [messages, setMessages] = useState<api.LeadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api.listLeadMessages(leadId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const byDay = useMemo(() => {
    const groups: { label: string; items: api.LeadMessage[] }[] = [];
    for (const m of messages) {
      const label = formatDateDay(m.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(m);
      else groups.push({ label, items: [m] });
    }
    return groups;
  }, [messages]);

  if (loading) return <Spinner label="Cargando chat..." />;

  if (messages.length === 0) {
    if (leadNotes) {
      return (
        <div className="leads-inbox-chat" ref={scrollRef}>
          <div className="chat-bubble lead">
            <div className="chat-sender">Mensaje original</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{cleanLeadMessage(leadNotes)}</div>
          </div>
        </div>
      );
    }
    return <div className="leads-inbox-chat empty">Sin mensajes en esta conversación</div>;
  }

  return (
    <div className="leads-inbox-chat" ref={scrollRef}>
      {byDay.map((g, idx) => (
        <div key={idx} className="leads-inbox-day-group">
          <p className="leads-inbox-day-label">{g.label}</p>
          {g.items.map((msg) => (
            <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
              <div style={{ whiteSpace: "pre-wrap" }}>{cleanLeadMessage(msg.content)}</div>
              <div className="chat-time">{formatTime(msg.timestamp)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function VDLeads({ vehicleLeads }: { vehicleLeads: api.Lead[] }) {
  const [tab, setTab] = useState<Tab>("mensajes");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestLang, setSuggestLang] = useState<"es" | "ca" | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const selected = useMemo(
    () => vehicleLeads.find((l) => l.id === selectedId) ?? null,
    [vehicleLeads, selectedId],
  );

  useEffect(() => {
    setDraft("");
    setSuggestLang(null);
    setSuggestError(null);
  }, [selectedId]);

  async function handleSuggest() {
    if (!selected) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await api.suggestLeadReply(selected.id);
      if (res.reply) setDraft(res.reply);
      if (res.language) setSuggestLang(res.language);
      if (!res.ok) {
        setSuggestError(res.error ?? "Usando plantilla de respaldo");
        showToast(res.error ?? "Usando plantilla de respaldo", "error");
      }
    } catch (e) {
      showToast(translateError(e), "error");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSend() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      const res = await api.sendLeadReply(selected.id, draft.trim());
      if (res.ok) {
        showToast("Respuesta enviada", "success");
        setDraft("");
      } else if (res.canSend === false) {
        showToast(res.error ?? "No se pudo enviar. Copia el texto y responde en coches.net.", "error");
      } else {
        showToast(res.error ?? "Error enviando la respuesta", "error");
      }
    } catch (e) {
      showToast(translateError(e), "error");
    } finally {
      setSending(false);
    }
  }

  if (vehicleLeads.length === 0) {
    return <EmptyState title="Sin leads" description="Este vehículo no tiene leads asociados" />;
  }

  return (
    <>
      <div className="leads-inbox-tabs">
        <button
          type="button"
          className={`leads-inbox-tab ${tab === "mensajes" ? "active" : ""}`}
          onClick={() => setTab("mensajes")}
        >
          Mensajes <span className="leads-inbox-badge">{vehicleLeads.length}</span>
        </button>
        <button
          type="button"
          className="leads-inbox-tab disabled"
          disabled
          title="Próximamente"
        >
          Llamadas <span className="leads-inbox-badge muted">0</span>
        </button>
      </div>

      {tab === "mensajes" && (
        <div className="leads-inbox">
          <aside className="leads-inbox-col-list">
            <ul className="leads-inbox-list" role="listbox">
              {vehicleLeads.map((lead) => {
                const active = selectedId === lead.id;
                return (
                  <li key={lead.id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`leads-inbox-item ${active ? "active" : ""}`}
                      onClick={() => setSelectedId(lead.id)}
                    >
                      <span className="leads-inbox-check" aria-hidden="true" />
                      <div className="leads-inbox-item-body">
                        <div className="leads-inbox-item-row">
                          <span className="leads-inbox-item-name">
                            <span className={`lead-status-dot ${lead.estado || "nuevo"}`} />
                            {lead.name}
                          </span>
                          <span className="leads-inbox-item-date">{formatDateCompact(lead.fecha_contacto)}</span>
                        </div>
                        {lead.vehicle_interest && (
                          <p className="leads-inbox-item-sub">{lead.vehicle_interest}</p>
                        )}
                        <div className="leads-inbox-item-badges">
                          {lead.canal === "coches.net" && <span className="badge badge-coches xs">coches.net</span>}
                          {lead.converted_client_id && <span className="badge badge-success xs">Convertido</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <main className="leads-inbox-col-detail">
            {!selected ? (
              <div className="leads-inbox-empty-detail">
                <p className="muted">Selecciona un contacto para ver la conversación</p>
              </div>
            ) : (
              <>
                <div className="leads-inbox-detail-topbar">
                  <h3 className="leads-inbox-detail-title">Mensaje</h3>
                  <button
                    type="button"
                    className="button secondary xs"
                    disabled
                    title="Próximamente: etiquetar conversaciones"
                  >
                    🏷 Etiquetar
                  </button>
                </div>

                <div className="leads-inbox-detail-header">
                  <div>
                    <p className="leads-inbox-detail-name">
                      <span className={`lead-status-dot ${selected.estado || "nuevo"}`} />
                      {selected.name}
                    </p>
                    <div className="leads-inbox-detail-meta">
                      {selected.email && <span>{selected.email}</span>}
                      {selected.phone && <span>{selected.phone}</span>}
                      <span className="badge">{selected.estado}</span>
                      {selected.canal === "coches.net" && <span className="badge badge-coches">coches.net</span>}
                    </div>
                  </div>
                </div>

                {selected.canal === "coches.net" ? (
                  <VDChat leadId={selected.id} leadNotes={selected.notes} />
                ) : (
                  <div className="leads-inbox-chat empty">
                    {selected.notes ? (
                      <div className="chat-bubble lead">
                        <div className="chat-sender">Mensaje original</div>
                        <div>{selected.notes}</div>
                      </div>
                    ) : "Sin conversación para este canal"}
                  </div>
                )}

                {suggestError && (
                  <div className="leads-inbox-suggest-error">
                    ⚠ {suggestError}. Plantilla de respaldo a continuación — edítala antes de enviar.
                  </div>
                )}

                <div className="leads-inbox-composer">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                    rows={3}
                    aria-label={`Escribe un mensaje a ${selected.name}`}
                    disabled={sending || suggesting}
                  />
                  <div className="leads-inbox-composer-actions">
                    {suggestLang && <span className="badge xs">{suggestLang === "ca" ? "CA" : "ES"}</span>}
                    <button
                      type="button"
                      className="button secondary xs"
                      onClick={() => void handleSuggest()}
                      disabled={suggesting || sending}
                    >
                      {suggesting ? "Generando..." : "💡 Sugerir"}
                    </button>
                    <button
                      type="button"
                      className="button primary xs"
                      onClick={() => void handleSend()}
                      disabled={!draft.trim() || sending || suggesting}
                      aria-label="Enviar mensaje"
                    >
                      {sending ? "Enviando..." : "➤ Enviar"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {tab === "llamadas" && (
        <div className="leads-inbox-empty-detail">
          <p className="muted">Próximamente: registro de llamadas</p>
        </div>
      )}
    </>
  );
}
