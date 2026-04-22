import { supabase } from "./supabase";
import type { BankAccount, BankTransaction, BankCategoryRule, BankTransactionFilters, PurchaseRecord, SalesRecord } from "./api-types";

function throwIfError(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export async function listBankAccounts(companyId: number): Promise<BankAccount[]> {
  const { data, error } = await supabase.from("bank_accounts").select("*").eq("company_id", companyId).order("id");
  throwIfError(error);
  return data || [];
}

export async function listBankTransactions(bankAccountId: number, filters: BankTransactionFilters = {}, limit = 500): Promise<BankTransaction[]> {
  let q = supabase.from("bank_transactions").select("*").eq("bank_account_id", bankAccountId)
    .order("booking_date", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (filters.fromDate) q = q.gte("booking_date", filters.fromDate);
  if (filters.toDate) q = q.lte("booking_date", filters.toDate);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.onlyUnlinked) q = q.is("linked_sale_id", null).is("linked_purchase_id", null);
  if (filters.onlyUnreviewed) q = q.eq("reviewed_by_user", false);
  if (filters.search) q = q.ilike("description", `%${filters.search}%`);
  const { data, error } = await q;
  throwIfError(error);
  return data || [];
}

export async function updateBankTransactionCategory(id: number, category: string, reviewed = true): Promise<void> {
  const { error } = await supabase.from("bank_transactions").update({ category, reviewed_by_user: reviewed }).eq("id", id);
  throwIfError(error);
}

export async function linkTransactionToPurchase(transactionId: number, purchaseId: number | null): Promise<void> {
  const { error } = await supabase.from("bank_transactions").update({ linked_purchase_id: purchaseId, reviewed_by_user: true }).eq("id", transactionId);
  throwIfError(error);
}

export async function linkTransactionToSale(transactionId: number, saleId: number | null): Promise<void> {
  const { error } = await supabase.from("bank_transactions").update({ linked_sale_id: saleId, reviewed_by_user: true }).eq("id", transactionId);
  throwIfError(error);
}

export async function listBankCategoryRules(companyId: number): Promise<BankCategoryRule[]> {
  const { data, error } = await supabase.from("bank_category_rules").select("*").eq("company_id", companyId).order("priority");
  throwIfError(error);
  return data || [];
}

export async function createBankCategoryRule(
  companyId: number,
  pattern: string,
  category: string,
  defaultExpenseType: string | null = null,
  priority = 100,
): Promise<number> {
  const cleanPattern = pattern.trim();
  if (!cleanPattern) throw new Error("El patrón no puede estar vacío");
  const { data, error } = await supabase.from("bank_category_rules").insert({
    company_id: companyId,
    pattern: cleanPattern,
    category,
    default_expense_type: defaultExpenseType,
    priority,
    active: true,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message || "no se pudo crear la regla");
  return data.id;
}

// ilike usa % y _ como comodines. Escapar para que un patrón literal no dispare
// coincidencias accidentales. Los paréntesis/comas no hace falta porque no usamos
// .or() aquí — solo un filtro ilike sobre description.
function escapeIlike(pattern: string): string {
  return pattern.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function accountIdsForCompany(companyId: number): Promise<number[]> {
  const { data, error } = await supabase.from("bank_accounts").select("id").eq("company_id", companyId);
  throwIfError(error);
  return (data || []).map((a) => a.id);
}

export async function countUncategorizedMatching(companyId: number, pattern: string): Promise<number> {
  const cleanPattern = pattern.trim();
  if (cleanPattern.length < 3) return 0;
  const accountIds = await accountIdsForCompany(companyId);
  if (accountIds.length === 0) return 0;
  const { count, error } = await supabase
    .from("bank_transactions")
    .select("id", { count: "exact", head: true })
    .in("bank_account_id", accountIds)
    .eq("category", "SIN_CATEGORIZAR")
    .ilike("description", `%${escapeIlike(cleanPattern)}%`);
  throwIfError(error);
  return count ?? 0;
}

// Recategoriza en bulk los SIN_CATEGORIZAR cuyo description coincida con el patrón.
// 🔴 Seguridad: solo toca filas SIN_CATEGORIZAR — nunca pisa categorías ya asignadas
// manualmente. Scope limitado a cuentas de la misma company (RLS lo refuerza).
export async function applyCategoryToUncategorizedMatching(
  companyId: number,
  pattern: string,
  category: string,
): Promise<number> {
  const cleanPattern = pattern.trim();
  if (!cleanPattern) return 0;
  const accountIds = await accountIdsForCompany(companyId);
  if (accountIds.length === 0) return 0;
  const { data, error } = await supabase
    .from("bank_transactions")
    .update({ category, reviewed_by_user: true })
    .in("bank_account_id", accountIds)
    .eq("category", "SIN_CATEGORIZAR")
    .ilike("description", `%${escapeIlike(cleanPattern)}%`)
    .select("id");
  throwIfError(error);
  return (data || []).length;
}

export async function suggestSalesForTransaction(companyId: number, amount: number, bookingDate: string): Promise<SalesRecord[]> {
  const target = Math.abs(amount);
  const lo = target - 5;
  const hi = target + 5;
  const dateObj = new Date(bookingDate);
  const fromDate = new Date(dateObj.getTime() - 21 * 86400000).toISOString().slice(0, 10);
  const toDate = new Date(dateObj.getTime() + 21 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from("sales_records").select("*").eq("company_id", companyId)
    .gte("price_final", lo).lte("price_final", hi).gte("date", fromDate).lte("date", toDate)
    .order("date", { ascending: false }).limit(10);
  throwIfError(error);
  return data || [];
}

export async function suggestPurchasesForTransaction(companyId: number, amount: number, bookingDate: string): Promise<PurchaseRecord[]> {
  const target = Math.abs(amount);
  const lo = target - 5;
  const hi = target + 5;
  const dateObj = new Date(bookingDate);
  const fromDate = new Date(dateObj.getTime() - 21 * 86400000).toISOString().slice(0, 10);
  const toDate = new Date(dateObj.getTime() + 21 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from("purchase_records").select("*").eq("company_id", companyId)
    .gte("purchase_price", lo).lte("purchase_price", hi).gte("purchase_date", fromDate).lte("purchase_date", toDate)
    .order("purchase_date", { ascending: false }).limit(10);
  throwIfError(error);
  return data || [];
}

export async function listPurchaseIdsWithBankLink(companyId: number): Promise<Set<number>> {
  // Filter by company: join through bank_account_id → bank_accounts.company_id
  const { data: accounts, error: accErr } = await supabase.from("bank_accounts").select("id").eq("company_id", companyId);
  throwIfError(accErr);
  const accountIds = (accounts || []).map((a) => a.id);
  if (accountIds.length === 0) return new Set<number>();

  const { data, error } = await supabase.from("bank_transactions").select("linked_purchase_id")
    .not("linked_purchase_id", "is", null).in("bank_account_id", accountIds);
  throwIfError(error);
  const ids = new Set<number>();
  for (const row of data || []) { if (row.linked_purchase_id != null) ids.add(row.linked_purchase_id); }
  return ids;
}

export async function createPurchaseFromTransaction(companyId: number, transactionId: number, expenseType: string, supplierName: string, vehicleId: number | null): Promise<number> {
  const { data: tx, error: txErr } = await supabase.from("bank_transactions").select("*").eq("id", transactionId).single();
  if (txErr || !tx) throw new Error(txErr?.message || "movimiento no encontrado");
  const { data: created, error: createErr } = await supabase.from("purchase_records").insert({
    company_id: companyId, expense_type: expenseType, vehicle_id: vehicleId, supplier_name: supplierName,
    purchase_date: tx.booking_date, purchase_price: Math.abs(Number(tx.amount)),
    invoice_number: "(desde banco)", payment_method: "transferencia", notes: tx.description,
    source_file: `bank_tx_${transactionId}`,
  }).select("id").single();
  if (createErr || !created) throw new Error(createErr?.message || "no se pudo crear compra");
  await linkTransactionToPurchase(transactionId, created.id);
  return created.id;
}
