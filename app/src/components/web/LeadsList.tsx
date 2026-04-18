import React, { useState, useMemo } from "react";
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

function LeadChat({ leadId, leadNotes }: { leadId: number; leadNotes?: string }) {
  const [messages, setMessages] = useState<api.LeadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLoading(true);
    api.listLeadMessages(leadId)
      .then((msgs) => setMessages(msgs))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [leadId]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (loading) return <Spinner label="Cargando chat..." />;

  if (messages.length === 0) {
    if (leadNotes) {
      return (
        <div className="chat-container" ref={scrollRef}>
          <div className="chat-bubble lead">
            <div className="chat-sender">Mensaje original</div>
            <div>{leadNotes}</div>
          </div>
        </div>
      );
    }
    return <div className="chat-empty">Sin mensajes de conversación</div>;
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const day = d.getDate();
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const month = months[d.getMonth()];
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${day} ${month}, ${h}:${m}`;
  };

  return (
    <div className="chat-container" ref={scrollRef}>
      {messages.map((msg) => (
        <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
          <div className="chat-sender">{msg.sender_name}</div>
          <div>{msg.content}</div>
          <div className="chat-time">{formatTime(msg.timestamp)}</div>
        </div>
      ))}
    </div>
  );
}

type LeadFilter = "todos" | "sin_contestar" | "activos" | "cerrados";

const CLOSED_ESTADOS = ["cerrado", "perdido", "descartado", "vendido"];

const FILTER_LABELS: Record<LeadFilter, string> = {
  todos: "Todos",
  sin_contestar: "Sin contestar",
  activos: "Activos",
  cerrados: "Cerrados",
};

export function LeadsList({ leads, vehicles: _vehicles, companyId, onReload }: { leads: api.Lead[]; vehicles: api.Vehicle[]; companyId: number; onReload: () => void }) {
  const dialog = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LeadFilter>("todos");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", notes: "", estado: "", canal: "" });
  const [notesLeadId, setNotesLeadId] = useState<number | null>(null);
  const [chatLeadId, setChatLeadId] = useState<number | null>(null);
  const [leadNotes, setLeadNotes] = useState<api.LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);

  async function openNotes(leadId: number) {
    if (notesLeadId === leadId) { setNotesLeadId(null); return; }
    setNotesLeadId(leadId);
    setLoadingNotes(true);
    try { setLeadNotes(await api.listLeadNotes(leadId)); } catch { setLeadNotes([]); }
    finally { setLoadingNotes(false); }
  }

  async function addNote() {
    if (!notesLeadId || !newNote.trim()) return;
    try {
      await api.createLeadNote(notesLeadId, newNote.trim());
      setNewNote("");
      setLeadNotes(await api.listLeadNotes(notesLeadId));
    } catch (err) { showToast(translateError(err), "error"); }
  }

  async function removeNote(noteId: number) {
    try {
      await api.deleteLeadNote(noteId);
      if (notesLeadId) setLeadNotes(await api.listLeadNotes(notesLeadId));
    } catch (err) { showToast(translateError(err), "error"); }
  }
  // Filtros validados con Ricard 2026-04-04 (§6.ter del plan):
  // - sin_contestar: leads en estado nuevo / sin contactar (los más urgentes)
  // - activos: cualquier lead que no esté cerrado/perdido/descartado
  // - cerrados: histórico de leads ya finalizados
  const filtered = useMemo(() => {
    let list = leads;
    if (filter === "sin_contestar") {
      list = list.filter((l) => !l.estado || l.estado === "nuevo");
    } else if (filter === "activos") {
      list = list.filter((l) => !CLOSED_ESTADOS.includes(l.estado || ""));
    } else if (filter === "cerrados") {
      list = list.filter((l) => CLOSED_ESTADOS.includes(l.estado || ""));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => [l.name, l.phone, l.vehicle_interest].some((v) => v.toLowerCase().includes(q)));
    }
    return list;
  }, [leads, search, filter]);

  const counts = useMemo(() => {
    const acc = { todos: leads.length, sin_contestar: 0, activos: 0, cerrados: 0 };
    for (const l of leads) {
      const estado = l.estado || "";
      if (!estado || estado === "nuevo") acc.sin_contestar += 1;
      if (CLOSED_ESTADOS.includes(estado)) acc.cerrados += 1;
      else acc.activos += 1;
    }
    return acc;
  }, [leads]);
  const { paged: pagedLeads, page: leadsPage, totalPages: leadsTotalPages, setPage: setLeadsPage } = usePagination(filtered);

  const phoneDuplicate = useMemo(() => {
    if (!editForm.phone || !editForm.phone.trim()) return null;
    const normalized = editForm.phone.replace(/\s/g, "");
    const dup = leads.find((l) => l.id !== editingId && l.phone.replace(/\s/g, "") === normalized);
    return dup ? `Ya existe un lead con este teléfono: ${dup.name}` : null;
  }, [editForm.phone, editingId, leads]);

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

  return (
    <>
      <ConfirmDialog {...dialog.confirmProps} />
      <header className="hero">
        <div>
          <p className="eyebrow">Interesados</p>
          <h2>Interesados</h2>
          <p className="muted">{leads.length} lead{leads.length !== 1 ? "s" : ""}</p>
        </div>
        {leads.length > 0 && (
          <div className="hero-actions">
            <button type="button" className="button secondary" onClick={() => exportToCSV(leads.map(l => ({ Nombre: l.name, Teléfono: l.phone, Email: l.email, Estado: l.estado, Canal: l.canal, Interés: l.vehicle_interest, Fecha_contacto: l.fecha_contacto, Notas: l.notes })), "leads")}>
              Exportar CSV
            </button>
          </div>
        )}
      </header>
      {leads.length > 0 && (
        <section className="panel filter-panel">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            {(["sin_contestar", "activos", "todos", "cerrados"] as LeadFilter[]).map((key) => {
              const isActive = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`button ${isActive ? "primary" : "secondary"} xs`}
                  onClick={() => setFilter(key)}
                >
                  {FILTER_LABELS[key]} <span style={{ opacity: 0.7, marginLeft: "0.25rem" }}>({counts[key]})</span>
                </button>
              );
            })}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lead..." />
        </section>
      )}
      {leads.length === 0 && (
        <EmptyState icon="📞" title="Sin leads todavía" description="Los leads aparecerán aquí cuando lleguen consultas desde coches.net, WhatsApp o llamadas. También puedes importarlos manualmente." />
      )}
      {filtered.length === 0 && leads.length > 0 && (
        <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
          <p className="muted">No hay interesados que coincidan con el filtro.</p>
          <button type="button" className="button secondary" style={{ marginTop: "0.5rem" }} onClick={() => { setSearch(""); setFilter("todos"); }}>Limpiar filtros</button>
        </div>
      )}
      <PaginationControls page={leadsPage} totalPages={leadsTotalPages} setPage={setLeadsPage} />
      <section className="record-grid" aria-live="polite">
        {pagedLeads.map((lead) => (
          <article key={lead.id} className="record-card panel">
            {editingId === lead.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nombre" className={!editForm.name.trim() && editingId ? "input-error" : ""} />
                {!editForm.name.trim() && <p className="input-error-message" role="alert">El nombre es obligatorio</p>}
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Teléfono" />
                {phoneDuplicate && <p style={{ color: "#b45309", fontSize: "0.78rem", margin: "-0.25rem 0 0" }}>⚠ {phoneDuplicate}</p>}
                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" />
                <select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}>
                  <option value="nuevo">Nuevo</option><option value="contactado">Contactado</option><option value="negociando">Negociando</option><option value="cerrado">Cerrado</option><option value="perdido">Perdido</option>
                </select>
                <select value={editForm.canal} onChange={(e) => setEditForm({ ...editForm, canal: e.target.value })}>
                  <option value="">-- Canal --</option>
                  <option value="coches.net">coches.net</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="llamada">Llamada</option>
                  <option value="walk-in">Visita presencial</option>
                  <option value="otro">Otro</option>
                </select>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notas" rows={2} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="button primary" style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={() => void saveEdit()}>Guardar</button>
                  <button type="button" className="button secondary" style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={cancelLeadEdit}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="record-header">
                  <div>
                    <p className="record-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><span className={`lead-status-dot ${lead.estado || "nuevo"}`} />{lead.name}</p>
                    <p className="muted">{lead.phone || "Sin teléfono"}</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                    {lead.canal === "coches.net" && <span className="badge badge-coches">coches.net</span>}
                    <span className="badge">{lead.estado}</span>
                    <button type="button" className="button secondary xs" onClick={() => startEdit(lead)}>Editar</button>
                    <button type="button" className="button danger xs" onClick={() => void handleDeleteLead(lead.id, lead.name)}>Eliminar</button>
                  </div>
                </div>
                {lead.vehicle_interest && <p className="record-line">Interés: {lead.vehicle_interest}</p>}
                {lead.notes && <p className="record-notes">{lead.notes}</p>}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                  {!lead.converted_client_id && lead.estado !== "perdido" && (
                    <button type="button" className="button primary" style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={() => void convertToClient(lead)}>
                      Convertir a cliente
                    </button>
                  )}
                  {lead.converted_client_id && <span className="badge badge-success">Convertido</span>}
                  <button type="button" className="button secondary" style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={() => void openNotes(lead.id)}>
                    {notesLeadId === lead.id ? "Cerrar notas" : "Notas"}
                  </button>
                  {lead.canal === "coches.net" && (
                    <>
                      <button type="button" className="button secondary" style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={() => setChatLeadId(chatLeadId === lead.id ? null : lead.id)}>
                        {chatLeadId === lead.id ? "Cerrar chat" : "💬 Chat"}
                      </button>
                      <a href="https://www.coches.net/concesionario/codinacars/" target="_blank" rel="noopener"
                        className="button secondary" style={{ textDecoration: "none", textAlign: "center", fontSize: "0.85rem", padding: "0.5rem 0.8rem" }}>
                        Responder en coches.net
                      </a>
                    </>
                  )}
                </div>
                {chatLeadId === lead.id && (
                  <div style={{ marginTop: "0.75rem", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      <span className="badge badge-coches" style={{ fontSize: "0.68rem" }}>coches.net</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>Conversación</span>
                    </div>
                    <LeadChat leadId={lead.id} leadNotes={lead.notes} />
                  </div>
                )}
                {notesLeadId === lead.id && (
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", borderRadius: 10, background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Añadir nota..." style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem 0.75rem" }} />
                      <button type="button" className="button primary" style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }} onClick={() => void addNote()} disabled={!newNote.trim()}>Añadir</button>
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
                              <button type="button" className="button danger xs" aria-label="Eliminar nota" style={{ flexShrink: 0 }} onClick={() => void removeNote(n.id)}>✕</button>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </section>
      <PaginationControls page={leadsPage} totalPages={leadsTotalPages} setPage={setLeadsPage} />
    </>
  );
}
