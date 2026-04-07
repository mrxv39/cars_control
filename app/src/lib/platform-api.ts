// Platform API: registration, OAuth, and company user management via Supabase
import { supabase } from "./supabase";
import { hashPassword } from "./hash";
import type { LoginResult } from "../shared-types";

export interface RegistrationInput {
  trade_name: string;
  legal_name: string;
  cif: string;
  phone: string;
  email: string;
  admin_full_name: string;
  admin_username: string;
  admin_password: string;
}

/** Submit a new company registration request. */
export async function submitRegistration(input: RegistrationInput) {
  const passwordHash = await hashPassword(input.admin_password);
  const { data, error } = await supabase
    .from("registration_requests")
    .insert({
      trade_name: input.trade_name,
      legal_name: input.legal_name,
      cif: input.cif,
      phone: input.phone,
      email: input.email,
      admin_full_name: input.admin_full_name,
      admin_username: input.admin_username,
      admin_password_hash: passwordHash,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Initiate Google OAuth sign-in via Supabase Auth. */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(error.message);
}

/** Sign out from Supabase Auth (OAuth). */
export async function signOutOAuth() {
  await supabase.auth.signOut();
}

/** After OAuth redirect, link the Supabase Auth session to a cars_control user via RPC. */
export async function linkOAuthSession(): Promise<LoginResult | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session?.user) return null;

  const { data, error } = await supabase.rpc("link_oauth_user", {
    p_email: session.user.email,
    p_provider: "google",
    p_provider_id: session.user.id,
    p_full_name: session.user.user_metadata?.full_name ?? "",
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    user: {
      id: row.user_id,
      company_id: row.user_company_id,
      full_name: row.user_full_name,
      username: row.user_username,
      email: row.user_email || "",
      role: row.user_role,
      active: row.user_active,
    },
    company: {
      id: row.user_company_id,
      trade_name: row.company_trade_name,
      legal_name: row.company_legal_name,
      cif: row.company_cif,
      address: row.company_address,
      phone: row.company_phone,
      email: row.company_email,
      created_at: "",
    },
  };
}

/** Create a new user within a company (admin action). */
export async function createCompanyUser(
  companyId: number,
  fullName: string,
  username: string,
  password: string,
  role: string,
) {
  const passwordHash = await hashPassword(password);
  const { data, error } = await supabase
    .from("users")
    .insert({
      company_id: companyId,
      full_name: fullName,
      username,
      password_hash: passwordHash,
      role,
      active: true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
