import React, { useEffect, useMemo, useState } from "react";
import * as api from "../../lib/api";
import { usePagination } from "../../hooks/usePagination";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { exportToCSV } from "../../lib/csv-export";
import { showToast } from "../../lib/toast";
import { translateError } from "../../lib/translateError";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import Spinner from "./Spinner";
import { PaginationControls } from "./PaginationControls";
import { cleanLeadMessage } from "../../lib/leadMessageClean";

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

function InboxChat({ leadId, leadNotes }: { leadId: number; leadNotes?: string }) {
  const [messages, setMessages] = useState<api.LeadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api.listLeadMessages(leadId)
      .then((msgs) => setMessages(msgs))
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

type LeadFilter = "todos" | "sin_contestar" | "activos" | "cerrados";
type Tab = "mensajes" | "llamadas";

const CLOSED_ESTADOS = ["cerrado", "perdido", "descartado", "vendido"];

const FILTER_LABELS: Record<LeadFilter, string> = {
  todos: "Todos",
  sin_contestar: "Sin contestar",
  activos: "Activos",
  cerrados: "Cerrados",
};

export function LeadsList({ leads, vehicles: _vehicles, companyId, onReload }: { leads: api.Lead[]; vehicles: api.Vehicle[]; companyId: number; onReload: () => void }) {
  const dialog = useConfirmDialog();
  const [tab, setTab] = useState<Tab>("mensajes");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LeadFilter>("todos");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", notes: "", estado: "", canal: "" });
  const [notesOpen, setNotesOpen] = useState(false);
  const [leadNotes, setLeadNotes] = useState<api.LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestLang, setSuggestLang] = useState<"es" | "ca" | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Particiones disjuntas: sin_contestar + activos + cerrados = todos.
  // Antes "activos" incluía también "nuevo/sin_contestar" → counts sumaban más que el total
  // y Ricard dudaba si los números eran correctos (audit 2026-04-22).
  const filtered = useMemo(() => {
    let list = leads;
    if (filter === "sin_contestar") list = list.filter((l) => !l.estado || l.estado === "nuevo");
    else if (filter === "activos") list = list.filter((l) => {
      const e = l.estado || "";
      return e && e !== "nuevo" && !CLOSED_ESTADOS.includes(e);
    });
    else if (filter === "cerrados") list = list.filter((l) => CLOSED_ESTADOS.includes(l.estado || ""));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => [l.name, l.phone, l.email, l.vehicle_interest].some((v) => (v ?? "").toLowerCase().includes(q)));
    }
    return list;
  }, [leads, search, filter]);

  const counts = useMemo(() => {
    const acc = { todos: leads.length, sin_contestar: 0, activos: 0, cerrados: 0 };
    for (const l of leads) {
      const estado = l.estado || "";
      if (!estado || estado === "nuevo") acc.sin_contestar += 1;
      else if (CLOSED_ESTADOS.includes(estado)) acc.cerrados += 1;
      else acc.activos += 1;
    }
    return acc;
  }, [leads]);

  const { paged: pagedLeads, page: leadsPage, totalPages: leadsTotalPages, setPage: setLeadsPage } = usePagination(filtered);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  const phoneDuplicate = useMemo(() => {
    if (!editForm.phone || !editForm.phone.trim()) return null;
    const normalized = editForm.phone.replace(/\s/g, "");
    const dup = leads.find((l) => l.id !== editingId && l.phone.replace(/\s/g, "") === normalized);
    return dup ? `Ya existe un lead con este teléfono: ${dup.name}` : null;
  }, [editForm.phone, editingId, leads]);

  // Reset panels when switching selection
  useEffect(() => {
    setEditingId(null);
    setNotesOpen(false);
    setDraft("");
    setSuggestLang(null);
    setSuggestError(null);
  }, [selectedId]);

  // Load notes on demand
  useEffect(() => {
    if (!notesOpen || !selectedId) return;
    let cancelled = false;
    setLoadingNotes(true);
    api.listLeadNotes(selectedId)
      .then((ns) => { if (!cancelled) setLeadNotes(ns); })
      .catch(() => { if (!cancelled) setLeadNotes([]); })
      .finally(() => { if (!cancelled) setLoadingNotes(false); });
    return () => { cancelled = true; };
  }, [notesOpen, selectedId]);

  async function addNote() {
    if (!selectedId || !newNote.trim()) return;
    try {
      await api.createLeadNote(selectedId, newNote.trim());
      setNewNote("");
      setLeadNotes(await api.listLeadNotes(selectedId));
    } catch (err) { showToast(translateError(err), "error"); }
  }

  async function removeNote(noteId: number) {
    try {
      await api.deleteLeadNote(noteId);
      if (selectedId) setLeadNotes(await api.listLeadNotes(selectedId));
    } catch (err) { showToast(translateError(err), "error"); }
  }

  const leadOriginal = React.useRef<typeof editForm | null>(null);
  function startEdit(lead: api.Lead) {
    setEditingId(lead.id);
    const form = { name: lead.name, phone: lead.phone, email: lead.email, notes: lead.notes, estado: lead.estado, canal: lead.canal };
    setEditForm(form);
    leadOriginal.current = { ...form };
  }
  function cancelLeadEdit() {
    if (leadOriginal.current && JSON.stringify(editForm) !== JSON.stringify(leadOriginal.current)) {
      dialog.requestConfirm("Cambios sin guardar", "Tienes cambios sin guardar. ¿Salir sin guardar?", () => setEditingId(null));
      return;
    }
    setEditingId(null);
  }

  async function saveEdit() {
    if (editingId == null) return;
    try {
      await api.updateLead(editingId, editForm as Partial<api.Lead>);
      setEditingId(null);
      onReload();
      showToast("Lead guardado");
    } catch (err) { showToast(translateError(err), "error"); }
  }

  function handleDeleteLead(id: number, name: string) {
    dialog.requestConfirm("Eliminar lead", `¿Eliminar lead "${name}"? Esta acción no se puede deshacer.`, async () => {
      try {
        await api.deleteLead(id);
        if (selectedId === id) setSelectedId(null);
        onReload();
        showToast("Lead eliminado");
      } catch (err) { showToast(translateError(err), "error"); }
    });
  }

  function convertToClient(lead: api.Lead) {
    dialog.requestConfirm("Convertir a cliente", `¿Convertir "${lead.name}" en cliente?`, async () => {
      try {
        const client = await api.createClient(companyId, {
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          notes: lead.notes,
        } as Partial<api.Client>);
        await api.updateLead(lead.id, { converted_client_id: client.id, estado: "cerrado" } as Partial<api.Lead>);
        onReload();
        showToast("Lead convertido a cliente", "success");
      } catch (err) { showToast(translateError(err), "error"); }
    });
  }

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

  const hasLeads = leads.length > 0;
  const hasFilteredLeads = filtered.length > 0;

  return (
    <>
      <ConfirmDialog {...dialog.confirmProps} />
      <header className="hero">
        <div>
          <p className="eyebrow">Interesados</p>
          <h2>Interesados</h2>
          <p className="muted">{leads.length} lead{leads.length !== 1 ? "s" : ""}</p>
        </div>
        {hasLeads && (
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={() => exportToCSV(leads.map(l => ({ Nombre: l.name, Teléfono: l.phone, Email: l.email, Estado: l.estado, Canal: l.canal, Interés: l.vehicle_interest, Fecha_contacto: l.fecha_contacto, Notas: l.notes })), "leads")}>
              Exportar CSV
            </button>
          </div>
        )}
      </header>

      {/* Tabs al estilo coches.net */}
      <div className="leads-inbox-tabs">
        <button
          type="button"
          className={`leads-inbox-tab ${tab === "mensajes" ? "active" : ""}`}
          onClick={() => setTab("mensajes")}
        >
          Mensajes <span className="leads-inbox-badge">{leads.length}</span>
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

      {!hasLeads ? (
        <EmptyState icon="📞" title="Sin leads todavía" description="Aquí aparecerán las consultas que llegan desde coches.net. Los contactos por WhatsApp o llamada los gestionas directamente desde tu móvil." />
      ) : (
        <div className="leads-inbox">
          {/* Columna izquierda: filtros + búsqueda + lista */}
          <aside className="leads-inbox-col-list">
            <div className="leads-inbox-filters">
              {(["sin_contestar", "activos", "todos", "cerrados"] as LeadFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`button ${filter === key ? "primary" : "secondary"} xs`}
                  onClick={() => setFilter(key)}
                >
                  {FILTER_LABELS[key]} <span style={{ opacity: 0.7, marginLeft: "0.2rem" }}>({counts[key]})</span>
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lead..."
              className="leads-inbox-search"
            />
            {!hasFilteredLeads ? (
              <div className="leads-inbox-empty">
                <p className="muted">No hay interesados que coincidan con el filtro.</p>
                <button type="button" className="button secondary xs" onClick={() => { setSearch(""); setFilter("todos"); }}>Limpiar filtros</button>
              </div>
            ) : (
              <ul className="leads-inbox-list" role="listbox">
                {pagedLeads.map((lead) => {
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
            )}
            {hasFilteredLeads && leadsTotalPages > 1 && (
              <PaginationControls page={leadsPage} totalPages={leadsTotalPages} setPage={setLeadsPage} />
            )}
          </aside>

          {/* Columna derecha: detalle del mensaje */}
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

                {editingId === selected.id ? (
                  <div className="leads-inbox-edit">
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nombre" className={!editForm.name.trim() && editingId ? "input-error" : ""} />
                    {!editForm.name.trim() && <p className="input-error-message" role="alert">El nombre es obligatorio</p>}
                    <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Teléfono" />
                    {phoneDuplicate && <p style={{ color: "#b45309", fontSize: "0.78rem", margin: "-0.25rem 0 0" }}>⚠ {phoneDuplicate}</p>}
                    <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" />
                    <select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}>
                      <option value="nuevo">Nuevo</option><option value="contactado">Contactado</option><option value="negociando">Negociando</option><option value="cerrado">Cerrado</option><option value="perdido">Perdido</option>
                    </select>
                    <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notas" rows={2} />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" className="button primary" onClick={() => void saveEdit()}>Guardar</button>
                      <button type="button" className="button secondary" onClick={cancelLeadEdit}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
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
                      <div className="leads-inbox-detail-actions">
                        <button type="button" className="button secondary xs" onClick={() => startEdit(selected)}>Editar</button>
                        <button type="button" className="button secondary xs" onClick={() => setNotesOpen((v) => !v)}>{notesOpen ? "Cerrar notas" : "Notas"}</button>
                        {!selected.converted_client_id && selected.estado !== "perdido" && (
                          <button type="button" className="button primary xs" onClick={() => void convertToClient(selected)}>Convertir a cliente</button>
                        )}
                        <button type="button" className="button danger xs" onClick={() => void handleDeleteLead(selected.id, selected.name)}>Eliminar</button>
                      </div>
                    </div>

                    {selected.canal === "coches.net" ? (
                      <InboxChat leadId={selected.id} leadNotes={selected.notes} />
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

                    {notesOpen && (
                      <div className="leads-inbox-notes">
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Añadir nota..." style={{ flex: 1 }} />
                          <button type="button" className="button primary xs" onClick={() => void addNote()} disabled={!newNote.trim()}>Añadir</button>
                        </div>
                        {loadingNotes ? <Spinner label="Cargando..." /> : (
                          leadNotes.length === 0 ? <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>Sin notas</p> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                              {leadNotes.map((n) => (
                                <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", padding: "0.35rem 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                                  <div>
                                    <p style={{ margin: 0, fontSize: "0.82rem" }}>{n.content}</p>
                                    <p className="muted" style={{ margin: "0.1rem 0 0", fontSize: "0.72rem" }}>{new Date(n.timestamp).toLocaleString("es-ES")}</p>
                                  </div>
                                  <button type="button" className="button danger xs" aria-label="Eliminar nota" onClick={() => void removeNote(n.id)}>✕</button>
                                </div>
                              ))}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </>
  );
}
