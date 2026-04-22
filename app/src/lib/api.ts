import { supabase } from "./supabase";
import type { LoginResult, Company as _Company, User as _User } from "../shared-types";

// ── Re-exports: types ──
export type { Company, User, LoginResult } from "../shared-types";
export type { LeadNote } from "../shared-types";
export type {
  Vehicle, VehicleDocument, VehiclePhoto, VehicleListing, VehicleInspection,
  ImportPreview, Lead, Client, SalesRecord, PurchaseRecord, Supplier,
  LeadMessage, BankAccount, BankTransaction, BankCategoryRule, BankTransactionFilters,
} from "./api-types";

// ── Re-exports: domain modules ──
export {
  listPublicVehicles, listVehicles, listAllVehicles, getVehicle,
  createVehicle, updateVehicle, deleteVehicle,
  setPrimaryPhoto, listPrimaryPhotos, listVehiclePhotos, uploadVehiclePhoto, deleteVehiclePhoto,
  listVehicleDocuments, uploadVehicleDocument, deleteVehicleDocument,
  listVehicleInspections, deleteVehicleInspection,
  getStockPhotoSummary, getStockDocSummary,
  listVehicleListings, mergeVehicles,
  listKnownExternalIds, fetchCochesNetPreview, importCochesNetVehicles, markVehiclesNeedsReview,
} from "./api-vehicles";

export {
  listLeads, createLead, updateLead, deleteLead,
  listLeadNotes, createLeadNote, deleteLeadNote,
  listLeadMessages, suggestLeadReply, sendLeadReply,
  listClients, createClient, updateClient, deleteClient,
  listSalesRecords, addSalesRecord, deleteSalesRecord,
  listPurchaseRecords, addPurchaseRecord, deletePurchaseRecord,
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
} from "./api-records";
export type { SuggestReplyResult, SendReplyResult } from "./api-records";

export {
  listBankAccounts, listBankTransactions,
  updateBankTransactionCategory, linkTransactionToPurchase, linkTransactionToSale,
  listBankCategoryRules, createBankCategoryRule, suggestPurchasesForTransaction, suggestSalesForTransaction,
  listPurchaseIdsWithBankLink, createPurchaseFromTransaction,
  countUncategorizedMatching, applyCategoryToUncategorizedMatching,
} from "./api-bank";

// ── Tauri detection ──

export function isTauri(): boolean {
  return !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export { hashPassword } from "./hash";

// ── Auth ──

export async function login(username: string, password: string): Promise<LoginResult> {
  const email = username.includes("@") ? username : await resolveUsername(username);
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) throw new Error("Usuario o contraseña incorrectos.");

  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, company_id, full_name, username, email, role, active")
    .eq("email", email).eq("active", true).single();
  if (userErr || !user) throw new Error("Usuario no encontrado en la aplicación.");

  const { data: company, error: compErr } = await supabase
    .from("companies").select("*").eq("id", user.company_id).single();
  if (compErr || !company) throw new Error("Empresa no encontrada.");

  return {
    user: { id: user.id, company_id: user.company_id, full_name: user.full_name, username: user.username, email: user.email || "", role: user.role, active: user.active },
    company,
  };
}

async function resolveUsername(username: string): Promise<string> {
  const { data, error } = await supabase.rpc("resolve_login", { p_username: username });
  if (error || !data || data.error) throw new Error("Usuario o contraseña incorrectos.");
  return data.email;
}

// ── Profile / Company ──

export async function updateUser(userId: number, fields: { full_name?: string; username?: string; email?: string }): Promise<void> {
  const { error } = await supabase.from("users").update(fields).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function updateUserPassword(userId: number, newPassword: string): Promise<void> {
  const { hashPassword } = await import("./hash");
  const password_hash = await hashPassword(newPassword);
  const { error } = await supabase.from("users").update({ password_hash }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function getCompany(companyId: number): Promise<_Company | null> {
  const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).single();
  if (error) return null;
  return data as _Company;
}

export async function getUser(userId: number): Promise<_User | null> {
  const { data, error } = await supabase.from("users").select("id, company_id, full_name, username, email, role, active").eq("id", userId).single();
  if (error) return null;
  return data as _User;
}

export async function updateCompany(companyId: number, fields: Partial<{
  trade_name: string; legal_name: string; cif: string; address: string; phone: string; email: string; website: string;
}>): Promise<void> {
  const { error } = await supabase.from("companies").update(fields).eq("id", companyId);
  if (error) throw new Error(error.message);
}
