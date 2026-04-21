import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const COMPANY_ID = 1;
export const DEALER_NAME = "Codina Cars";
export const CODINACARS_EMAIL = "codinacars@gmail.com";
export const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
export const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-app-secret, apikey, x-client-info",
};

export interface Env {
  SUGGEST_REPLY_SECRET?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface LeadRow {
  id: number;
  name: string;
  reply_to_email: string | null;
  vehicle_interest: string | null;
  estado: string | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// base64url (sin padding). Deno tiene btoa global.
export function base64Url(s: string): string {
  // deno-lint-ignore no-explicit-any
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildRFC822(opts: {
  to: string;
  from: string;
  subject: string;
  body: string;
}): string {
  const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.subject)))}?=`;
  return [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${subjectEncoded}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    opts.body,
  ].join("\r\n");
}

export async function getAccessToken(env: Env): Promise<string> {
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID!,
      client_secret: env.GMAIL_CLIENT_SECRET!,
      refresh_token: env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth token error: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token in response");
  return data.access_token as string;
}

export async function sendGmailMessage(token: string, rfc822: string): Promise<string> {
  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64Url(rfc822) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail send error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data?.id as string) || "";
}

export interface HandleDeps {
  env: Env;
  supabase?: SupabaseClient;
  getTokenFn?: typeof getAccessToken;
  sendFn?: typeof sendGmailMessage;
  now?: () => Date;
}

export async function handleRequest(req: Request, deps: HandleDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method not allowed" }, 405);
  }

  const { env } = deps;
  const provided = req.headers.get("x-app-secret");
  if (!env.SUGGEST_REPLY_SECRET || provided !== env.SUGGEST_REPLY_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  let leadId: number;
  let text: string;
  try {
    const body = await req.json();
    leadId = Number(body?.leadId);
    text = String(body?.text ?? "").trim();
    if (!Number.isInteger(leadId) || leadId <= 0) throw new Error("invalid leadId");
    if (!text) throw new Error("empty text");
  } catch (e) {
    return jsonResponse({ ok: false, error: `bad request: ${e instanceof Error ? e.message : String(e)}` }, 400);
  }

  const sb = deps.supabase ?? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: leadRows, error: leadErr } = await sb
    .from("leads")
    .select("id, name, reply_to_email, vehicle_interest, estado")
    .eq("company_id", COMPANY_ID)
    .eq("id", leadId)
    .limit(1);
  if (leadErr) return jsonResponse({ ok: false, error: `lead query: ${leadErr.message}` });
  const lead = (leadRows?.[0] ?? null) as LeadRow | null;
  if (!lead) return jsonResponse({ ok: false, error: "lead not found" }, 404);

  const oauthReady = !!(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN);
  if (!oauthReady) {
    return jsonResponse({
      ok: false,
      error: "Gmail OAuth no configurado. Copia el texto y responde manualmente en coches.net.",
      can_send: false,
    });
  }
  if (!lead.reply_to_email) {
    return jsonResponse({
      ok: false,
      error: "El lead no tiene reply_to_email guardado (probablemente importado antes del parche). Responde manualmente en coches.net.",
      can_send: false,
    });
  }

  const subject = lead.vehicle_interest
    ? `Re: coches.net - ${lead.vehicle_interest}`
    : "Re: coches.net";
  const rfc822 = buildRFC822({
    to: lead.reply_to_email,
    from: `${DEALER_NAME} <${CODINACARS_EMAIL}>`,
    subject,
    body: text,
  });

  try {
    const getToken = deps.getTokenFn ?? getAccessToken;
    const sendMsg = deps.sendFn ?? sendGmailMessage;
    const token = await getToken(env);
    const gmailId = await sendMsg(token, rfc822);

    const timestamp = (deps.now ?? (() => new Date()))().toISOString();
    const { data: inserted, error: insErr } = await sb
      .from("lead_messages")
      .insert({
        lead_id: leadId,
        company_id: COMPANY_ID,
        sender: "dealer",
        sender_name: DEALER_NAME,
        content: text,
        timestamp,
        source: "coches.net",
        gmail_message_id: gmailId || null,
      })
      .select("id")
      .limit(1);
    if (insErr) {
      // se envió el email pero no se pudo registrar: devolvemos ok parcial
      return jsonResponse({
        ok: true,
        gmail_message_id: gmailId,
        warning: `Email enviado pero no se pudo registrar: ${insErr.message}`,
      });
    }

    return jsonResponse({
      ok: true,
      gmail_message_id: gmailId,
      lead_message_id: inserted?.[0]?.id ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: msg.slice(0, 500), can_send: true });
  }
}
