import { supabase } from "./supabase";
import type { Lead, Client, SalesRecord, PurchaseRecord, Supplier, LeadMessage } from "./api-types";
import type { LeadNote } from "../shared-types";

function throwIfError(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

// ── Leads ──

export async function listLeads(companyId: number): Promise<Lead[]> {
  // Ordenar por fecha_contacto desc (más nuevos primero); fallback a created_at
  // para leads legacy sin fecha_contacto. nullsLast evita que null suba al top.
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", companyId)
    .order("fecha_contacto", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function createLead(companyId: number, input: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from("leads").insert({ ...input, company_id: companyId }).select().single();
  throwIfError(error);
  return data;
}

export async function updateLead(id: number, input: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from("leads").update(input).eq("id", id).select().single();
  throwIfError(error);
  return data;
}

export async function deleteLead(id: number): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  throwIfError(error);
}

// ── Lead Notes ──

export async function listLeadNotes(leadId: number): Promise<LeadNote[]> {
  const { data, error } = await supabase.from("lead_notes").select("*").eq("lead_id", leadId).order("timestamp", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function createLeadNote(leadId: number, content: string): Promise<LeadNote> {
  const { data, error } = await supabase.from("lead_notes").insert({ lead_id: leadId, content, timestamp: new Date().toISOString() }).select().single();
  throwIfError(error);
  return data;
}

export async function deleteLeadNote(id: number): Promise<void> {
  const { error } = await supabase.from("lead_notes").delete().eq("id", id);
  throwIfError(error);
}

// ── Lead Messages ──

export async function listLeadMessages(leadId: number): Promise<LeadMessage[]> {
  const { data, error } = await supabase.from("lead_messages").select("*").eq("lead_id", leadId).order("timestamp", { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export interface SuggestReplyResult {
  ok: boolean;
  reply: string;
  language?: "es" | "ca";
  error?: string;
  took_ms?: number;
}

export interface SendReplyResult {
  ok: boolean;
  gmail_message_id?: string;
  lead_message_id?: number;
  error?: string;
  canSend?: boolean;
}

export async function sendLeadReply(leadId: number, text: string): Promise<SendReplyResult> {
  const secret = import.meta.env.VITE_SUGGEST_REPLY_SECRET as string | undefined;
  if (!secret) {
    return { ok: false, error: "VITE_SUGGEST_REPLY_SECRET no configurado", canSend: false };
  }
  const { data, error } = await supabase.functions.invoke("send-lead-reply", {
    body: { leadId, text },
    headers: { "x-app-secret": secret },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const payload = (data ?? {}) as {
    ok?: boolean; gmail_message_id?: string; lead_message_id?: number;
    error?: string; can_send?: boolean; warning?: string;
  };
  if (payload.ok) {
    return {
      ok: true,
      gmail_message_id: payload.gmail_message_id,
      lead_message_id: payload.lead_message_id,
    };
  }
  return {
    ok: false,
    error: payload.error ?? "No se pudo enviar",
    canSend: payload.can_send ?? false,
  };
}

export async function suggestLeadReply(leadId: number): Promise<SuggestReplyResult> {
  const secret = import.meta.env.VITE_SUGGEST_REPLY_SECRET as string | undefined;
  if (!secret) {
    return { ok: false, reply: "", error: "VITE_SUGGEST_REPLY_SECRET no configurado" };
  }
  const { data, error } = await supabase.functions.invoke("suggest-reply", {
    body: { leadId },
    headers: { "x-app-secret": secret },
  });
  if (error) {
    return { ok: false, reply: "", error: error.message };
  }
  const payload = (data ?? {}) as {
    ok?: boolean; reply?: string; language?: "es" | "ca";
    error?: string; fallback?: string; took_ms?: number;
  };
  if (payload.ok && payload.reply) {
    return { ok: true, reply: payload.reply, language: payload.language, took_ms: payload.took_ms };
  }
  return {
    ok: false,
    reply: payload.fallback ?? "",
    language: payload.language,
    error: payload.error ?? "No se pudo generar la sugerencia",
    took_ms: payload.took_ms,
  };
}

// ── Clients ──

export async function listClients(companyId: number): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").eq("company_id", companyId).order("name");
  throwIfError(error);
  return data || [];
}

export async function createClient(companyId: number, input: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase.from("clients").insert({ ...input, company_id: companyId }).select().single();
  throwIfError(error);
  return data;
}

export async function updateClient(id: number, input: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase.from("clients").update(input).eq("id", id).select().single();
  throwIfError(error);
  return data;
}

export async function deleteClient(id: number): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  throwIfError(error);
}

// ── Sales Records ──

export async function listSalesRecords(companyId: number): Promise<SalesRecord[]> {
  const { data, error } = await supabase.from("sales_records").select("*").eq("company_id", companyId).order("date", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function addSalesRecord(companyId: number, input: Partial<SalesRecord>): Promise<SalesRecord> {
  const { data, error } = await supabase.from("sales_records").insert({ ...input, company_id: companyId }).select().single();
  throwIfError(error);
  return data;
}

export async function deleteSalesRecord(id: number): Promise<void> {
  const { error } = await supabase.from("sales_records").delete().eq("id", id);
  throwIfError(error);
}

// ── Purchase Records ──

export async function listPurchaseRecords(companyId: number): Promise<PurchaseRecord[]> {
  const { data, error } = await supabase.from("purchase_records").select("*").eq("company_id", companyId).order("purchase_date", { ascending: false });
  throwIfError(error);
  return data || [];
}

export async function addPurchaseRecord(companyId: number, input: Partial<PurchaseRecord>): Promise<PurchaseRecord> {
  const { data, error } = await supabase.from("purchase_records").insert({ ...input, company_id: companyId }).select().single();
  throwIfError(error);
  return data;
}

export async function deletePurchaseRecord(id: number): Promise<void> {
  const { error } = await supabase.from("purchase_records").delete().eq("id", id);
  throwIfError(error);
}

// ── Suppliers ──

export async function listSuppliers(companyId: number): Promise<Supplier[]> {
  const { data, error } = await supabase.from("suppliers").select("*").eq("company_id", companyId).order("name");
  throwIfError(error);
  return data || [];
}

export async function createSupplier(companyId: number, input: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").insert({ ...input, company_id: companyId }).select().single();
  throwIfError(error);
  return data;
}

export async function updateSupplier(id: number, input: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").update(input).eq("id", id).select().single();
  throwIfError(error);
  return data;
}

export async function deleteSupplier(id: number): Promise<void> {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  throwIfError(error);
}
