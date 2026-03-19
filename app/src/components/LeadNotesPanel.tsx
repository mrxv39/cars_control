import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LeadNote } from "../types";

interface Props {
  leadId: number;
  notes: LeadNote[];
  onNotesUpdated: (notes: LeadNote[]) => void;
  submitting: boolean;
}

export function LeadNotesPanel({ leadId, notes, onNotesUpdated, submitting }: Props) {
  const [newNoteContent, setNewNoteContent] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddNote() {
    if (!newNoteContent.trim()) return;

    setLoadingNotes(true);
    setError(null);
    try {
      await invoke("add_lead_note", { leadId, content: newNoteContent });
      setNewNoteContent("");
      // Reload notes
      const updated = await invoke<LeadNote[]>("get_lead_notes", { leadId });
      onNotesUpdated(updated);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingNotes(false);
    }
  }

  async function handleDeleteNote(noteId: number) {
    if (!window.confirm("¿Eliminar esta nota?")) return;

    setLoadingNotes(true);
    setError(null);
    try {
      await invoke("delete_lead_note", { noteId });
      // Reload notes
      const updated = await invoke<LeadNote[]>("get_lead_notes", { leadId });
      onNotesUpdated(updated);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingNotes(false);
    }
  }

  return (
    <section className="panel notes-panel">
      <div className="notes-header">
        <h3>Historial de Notas</h3>
        <p className="muted">{notes.length} nota{notes.length !== 1 ? "s" : ""} registrada{notes.length !== 1 ? "s" : ""}</p>
      </div>

      {error && <p style={{ color: "#d32f2f", marginBottom: "1rem" }}>{error}</p>}

      {/* Add Note Form */}
      <div className="notes-input">
        <textarea
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.currentTarget.value)}
          placeholder="Añade una nota sobre este lead (cómo llegó, seguimiento, etc.)"
          rows={3}
          disabled={loadingNotes || submitting}
          style={{ width: "100%", fontFamily: "inherit" }}
        />
        <button
          type="button"
          className="button primary"
          onClick={() => void handleAddNote()}
          disabled={loadingNotes || submitting || !newNoteContent.trim()}
          style={{ marginTop: "0.5rem" }}
        >
          {loadingNotes ? "Guardando..." : "Añadir nota"}
        </button>
      </div>

      {/* Notes Timeline */}
      <div className="notes-timeline">
        {notes.length > 0 ? (
          notes.map((note) => (
            <div key={note.id} className="note-item">
              <div className="note-header">
                <p className="note-date">{new Date(note.timestamp).toLocaleString("es-ES")}</p>
                <button
                  type="button"
                  className="button small danger"
                  onClick={() => void handleDeleteNote(note.id)}
                  disabled={loadingNotes || submitting}
                >
                  ✕
                </button>
              </div>
              <p className="note-content">{note.content}</p>
            </div>
          ))
        ) : (
          <p className="muted" style={{ textAlign: "center", paddingTop: "1rem" }}>
            Sin notas aún. Añade la primera para empezar el historial.
          </p>
        )}
      </div>
    </section>
  );
}
