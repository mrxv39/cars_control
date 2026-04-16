import { supabase } from "./supabase";
import type { Lead, Client, SalesRecord, PurchaseRecord, Supplier, LeadMessage } from "./api-types";
import type { LeadNote } from "../shared-types";

function throwIfError(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

// ── Leads ──

export async function listLeads(companyId: number): Promise<Lead[]> {
  const { data, error } = await supabase.from("leads").select("*").eq("company_id", companyId).order("name");
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
