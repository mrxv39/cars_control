/**
 * Supabase Edge Function: sync-leads
 *
 * Syncs leads from coches.net email notifications (Gmail) to Supabase.
 *
 * Uses Gmail REST API (not IMAP) because Edge Functions only support HTTP.
 *
 * Required secrets (set via `supabase secrets set`):
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_REFRESH_TOKEN
 *   SUPABASE_URL        (auto-provided by Supabase)
 *   SUPABASE_ANON_KEY   (auto-provided by Supabase)
 *
 * Triggered by pg_cron every 5 minutes via HTTP POST.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const COMPANY_ID = 1; // CodinaCars
const DEALER_NAME = "Codina Cars";
// Dominios/strings que identifican un email como originado en coches.net/Adevinta.
// Ojo: no usar "noreply" suelto — matchea noreply@norauto.es y otros remitentes
// no relacionados que Gmail nos devuelva si el query es laxo.
const COCHES_NET_SENDERS = ["coches.net", "adevinta", "noreply@coches"];

const MONTH_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4,
  mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// ── Gmail API helpers ──────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!,
      client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token error: ${err}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

interface SearchOptions {
  backfillDays?: number;   // if set, queries newer_than:Nd from @contactos.coches.net
  maxResults?: number;     // default 20 (live), 100 (backfill)
  pageToken?: string;      // Gmail API pageToken for pagination
}

interface SearchResult {
  ids: string[];
  nextPageToken: string | null;
}

async function searchLeadEmails(token: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const { backfillDays, maxResults, pageToken } = opts;
  const isBackfill = !!backfillDays && backfillDays > 0;

  // Backfill mode: dominio estricto @contactos.coches.net (solo conversaciones reales
  // con leads, nunca newsletters ni notificaciones de llamada).
  // Live mode: últimas 24h de coches.net independientemente del estado leído/no leído
  // — Ricard puede abrir mails en Gmail y el sync no debe perderlos. El dedupe por
  // phone/email/reply_to_email + el dedupe de lead_messages por (ts, sender, content)
  // hacen que reprocesar mails antiguos no cree duplicados, solo enriquece.
  const queryParts = isBackfill
    ? [`from:contactos.coches.net`, `newer_than:${backfillDays}d`]
    : [`newer_than:1d`, `(from:coches.net OR from:adevinta OR from:noreply@coches.net)`];

  const limit = maxResults ?? (isBackfill ? 100 : 50);
  const query = encodeURIComponent(queryParts.join(" "));
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${limit}`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail search error: ${err}`);
  }
  const data = await res.json();
  return {
    ids: (data.messages ?? []).map((m: { id: string }) => m.id),
    nextPageToken: data.nextPageToken ?? null,
  };
}

interface GmailMessage {
  id: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailPart[];
  };
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

async function fetchMessage(
  token: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail fetch error: ${err}`);
  }
  return res.json();
}

async function markAsRead(token: string, messageId: string): Promise<void> {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    }
  );
}

// ── Email parsing helpers ──────────────────────────────────────────

function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return atob(base64);
  } catch {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function getHeader(msg: GmailMessage, name: string): string {
  return (
    msg.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? ""
  );
}

function extractBody(payload: GmailMessage["payload"]): string {
  const textPart = findPart(payload, "text/plain");
  if (textPart?.body?.data) {
    return base64UrlDecode(textPart.body.data);
  }

  const htmlPart = findPart(payload, "text/html");
  if (htmlPart?.body?.data) {
    const html = base64UrlDecode(htmlPart.body.data);
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }

  if (payload.body?.data) {
    return base64UrlDecode(payload.body.data);
  }

  return "";
}

function findPart(
  payload: GmailMessage["payload"] | GmailPart,
  mimeType: string
): GmailPart | null {
  if ("mimeType" in payload && payload.mimeType === mimeType) {
    return payload as GmailPart;
  }
  for (const part of payload.parts ?? []) {
    const found = findPart(part, mimeType);
    if (found) return found;
  }
  return null;
}

// ── Follow-up detection & conversation parsing ────────────────────

function isFollowupEmail(body: string): boolean {
  return /nuevo mensaje|nuevo De /i.test(body) || body.includes("Mensajes anteriores");
}

function parseSpanishTimestamp(dateStr: string): Date | null {
  const m = dateStr.trim().match(/(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, day, monthName, hour, minute] = m;
  const month = MONTH_MAP[monthName.toLowerCase()];
  if (!month) return null;
  const year = new Date().getFullYear();
  return new Date(year, month - 1, parseInt(day), parseInt(hour), parseInt(minute));
}

interface ConversationMessage {
  sender: "lead" | "dealer";
  sender_name: string;
  content: string;
  timestamp: string;
}

function parseConversationMessages(body: string): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const isDealerName = (name: string) =>
    [DEALER_NAME.toLowerCase(), "codina cars", "codinacars"].includes(name.toLowerCase());

  // 1. Parse the NEW message (after "nuevo De NAME")
  const newMsgMatch = body.match(/nuevo\s+De\s+(.+?)\s*\n(.+?)(?=Mensajes anteriores|Responde|$)/is);
  if (newMsgMatch) {
    const senderName = newMsgMatch[1].trim();
    let content = newMsgMatch[2].trim();
    content = content.replace(/\s*Responde a este email.*/is, "").trim();
    if (content) {
      messages.push({
        sender: isDealerName(senderName) ? "dealer" : "lead",
        sender_name: senderName,
        content,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 2. Parse "Mensajes anteriores"
  const parts = body.split(/Mensajes anteriores/i);
  if (parts.length > 1) {
    const history = parts[1];
    const blocks = history.split(/\n\s*([A-ZÀ-Ú][a-záéíóúñ]*(?:\s+[A-ZÀ-Ú][a-záéíóúñ]*)*|Codina Cars)\s*\n\s*(\d{1,2}\s+\w+,?\s+\d{1,2}:\d{2})\s*\n/);

    let i = 1;
    while (i + 2 < blocks.length) {
      const senderName = blocks[i].trim();
      const dateStr = blocks[i + 1].trim();
      let content = blocks[i + 2].trim();
      i += 3;

      content = content.replace(/\s*Responde a este email.*/is, "").trim();
      content = content.replace(/\s*Ver anuncio.*/is, "").trim();
      if (!content) continue;

      const ts = parseSpanishTimestamp(dateStr);
      if (!ts) continue;

      messages.push({
        sender: isDealerName(senderName) ? "dealer" : "lead",
        sender_name: senderName,
        content,
        timestamp: ts.toISOString(),
      });
    }
  }

  return messages;
}

async function findExistingLead(
  sb: ReturnType<typeof createClient>,
  body: string,
): Promise<number | null> {
  const nameMatch = body.match(/nuevo\s+De\s+(.+)/i);
  const leadName = nameMatch ? nameMatch[1].trim() : null;

  const vehicleMatch = body.match(/coches\.net\/[^\s]*?\/([a-z0-9-]+)-\d+\.htm/i);
  const vehicleHint = vehicleMatch ? vehicleMatch[1].replace(/-/g, " ") : null;

  if (leadName) {
    const { data } = await sb
      .from("leads")
      .select("id")
      .eq("company_id", COMPANY_ID)
      .eq("canal", "coches.net")
      .ilike("name", `%${leadName}%`);
    if (data && data.length > 0) return data[0].id;
  }

  if (vehicleHint) {
    const { data } = await sb
      .from("leads")
      .select("id")
      .eq("company_id", COMPANY_ID)
      .eq("canal", "coches.net")
      .ilike("vehicle_interest", `%${vehicleHint.slice(0, 20)}%`);
    if (data && data.length > 0) return data[0].id;
  }

  return null;
}

async function insertMessages(
  sb: ReturnType<typeof createClient>,
  leadId: number,
  messages: ConversationMessage[],
  gmailMessageId: string,
): Promise<number> {
  if (messages.length === 0) return 0;

  const { data: existing } = await sb
    .from("lead_messages")
    .select("timestamp, sender, content")
    .eq("lead_id", leadId);

  const existingKeys = new Set(
    (existing ?? []).map(
      (e: { timestamp: string; sender: string; content: string }) =>
        `${e.timestamp.slice(0, 16)}|${e.sender}|${e.content.slice(0, 50)}`
    )
  );

  let inserted = 0;
  for (const msg of messages) {
    const key = `${msg.timestamp.slice(0, 16)}|${msg.sender}|${msg.content.slice(0, 50)}`;
    if (existingKeys.has(key)) continue;

    const { error } = await sb.from("lead_messages").insert({
      lead_id: leadId,
      company_id: COMPANY_ID,
      sender: msg.sender,
      sender_name: msg.sender_name,
      content: msg.content,
      timestamp: msg.timestamp,
      source: "coches.net",
      gmail_message_id: gmailMessageId,
    });
    if (!error) inserted++;
  }

  return inserted;
}

// ── Lead parsing (ported from Python) ──────────────────────────────

interface ParsedLead {
  name: string;
  phone: string;
  email_contact: string;
  vehicle_interest: string;
  notes: string;
  canal: string;
  reply_to_email: string;
}

function parseCochesNetLead(subject: string, body: string, fromHeader = ""): ParsedLead {
  const lead: ParsedLead = {
    name: "",
    phone: "",
    email_contact: "",
    vehicle_interest: "",
    notes: "",
    canal: "coches.net",
    reply_to_email: "",
  };

  // Extraer reply_to_email del header From. Patrón típico:
  //   "Jan <acacefea-97e5-4263-b56c-5954116bf0ff@contactos.coches.net>"
  // Contestar a ese UUID propaga la respuesta al chat de coches.net.
  const replyToMatch = fromHeader.match(/<([^>]+@contactos?\.coches\.net)>/i)
    ?? fromHeader.match(/([\w\-.]+@contactos?\.coches\.net)/i);
  if (replyToMatch) {
    lead.reply_to_email = replyToMatch[1].trim();
  }

  // Extract vehicle from subject
  const vehicleMatch = subject.match(
    /(?:sobre|en tu|interesado en)\s+(.+?)(?:\s*[-|]|$)/i
  );
  if (vehicleMatch) {
    lead.vehicle_interest = vehicleMatch[1].trim();
  }

  // Strings tipo `Icon-Answered-Call`, `Logo-Ma-Positive`, `Picto-Llamada-Perdida`
  // provienen de alt-text de imágenes en emails de coches.net PRO — no son nombres reales.
  const isImageAltText = (s: string) =>
    /^(Icon|Logo|Picto|Img|Pic|Btn|Btnbook)([\s\-_]|$)/i.test(s);

  // Palabras que nunca forman parte de un nombre real — si aparecen en la captura es
  // que el regex se ha extendido a trozos de plantilla ("Responde desde la herramienta...").
  const NAME_STOPWORDS = [
    "desde", "responde", "contesta", "herramienta", "profesional",
    "anuncio", "mensaje", "enviar", "gracias", "saludos", "hola",
    "responder", "contactar", "contestar", "email",
  ];
  const sanitizeName = (raw: string): string => {
    const cleaned = raw.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length === 0 || cleaned.length > 60) return "";
    const lower = cleaned.toLowerCase();
    if (NAME_STOPWORDS.some((w) => lower.includes(w))) return "";
    return cleaned;
  };

  // Extract name. Keywords case-insensitive; captura exige mayúscula inicial
  // para evitar absorber plantilla en minúsculas.
  const nameMatch = body.match(
    /(?:[Nn]ombre|[Nn]ame|[Dd]e parte de|[Cc]ontacto)\s*:?\s*([A-ZÁÉÍÓÚÑÀ-Ü][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑÀ-Ü][a-záéíóúñ]+)*)/
  );
  if (nameMatch) {
    lead.name = sanitizeName(nameMatch[1]);
  }
  if (lead.name && isImageAltText(lead.name)) {
    lead.name = "";
  }

  // Extract phone
  const phones = body.match(/\b(?:\+?34?\s*)?(\d{3}[\s.\-]?\d{3}[\s.\-]?\d{3})\b/);
  if (phones) {
    lead.phone = phones[0].replace(/[\s.\-]/g, "");
  }

  // Extract email (filter out coches.net/adevinta y pseudo-emails de assets `@2x.png`)
  const emails = body.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/g) ?? [];
  const contactEmails = emails.filter((e) => {
    const lower = e.toLowerCase();
    if (COCHES_NET_SENDERS.some((s) => lower.includes(s))) return false;
    if (/\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(lower)) return false; // nombre de archivo
    if (/@\dx\./i.test(lower)) return false; // dominios tipo @2x.png
    return true;
  });
  if (contactEmails.length > 0) {
    lead.email_contact = contactEmails[0];
  }

  // Fallback name from email
  if (!lead.name && lead.email_contact) {
    const fallback = lead.email_contact
      .split("@")[0]
      .replace(/\./g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    lead.name = sanitizeName(fallback);
    if (isImageAltText(lead.name)) {
      lead.name = "";
    }
  }

  // Fallback name with timestamp
  if (!lead.name) {
    const now = new Date();
    lead.name = `Lead coches.net (${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")})`;
  }

  // Build notes
  lead.notes = `[coches.net] ${subject}\n\nResponder en coches.net para mantener puntuacion.\n\n---\n${body.slice(0, 500)}`;

  return lead;
}

// ── Main handler ───────────────────────────────────────────────────

function redactPhone(phone: string): string {
  if (!phone || phone.length < 4) return "***";
  return "***" + phone.slice(-3);
}

function redactName(name: string): string {
  if (!name) return "***";
  return name.charAt(0) + "***";
}

serve(async (req) => {
  // Auth: ALWAYS require CRON_SECRET or SERVICE_ROLE_KEY
  const authHeader = req.headers.get("Authorization");
  const expectedKey = Deno.env.get("CRON_SECRET");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (req.method === "POST") {
    const isValidCron = expectedKey && authHeader === `Bearer ${expectedKey}`;
    const isValidService = supabaseServiceKey && authHeader === `Bearer ${supabaseServiceKey}`;
    if (!isValidCron && !isValidService) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // Backfill mode: ?backfill_days=180 activa un catch-up one-shot que
  //  - usa Gmail query `from:contactos.coches.net newer_than:Nd`
  //  - NO marca como leído
  //  - dedupe reforzado (phone OR email OR reply_to_email)
  const url = new URL(req.url);
  const backfillDays = Math.max(0, parseInt(url.searchParams.get("backfill_days") ?? "0", 10) || 0);
  const maxResultsParam = Math.max(0, parseInt(url.searchParams.get("max") ?? "0", 10) || 0);
  const pageTokenParam = url.searchParams.get("page_token") ?? undefined;
  const isBackfill = backfillDays > 0;

  try {
    const token = await getAccessToken();
    // No-op: ya no marcamos como leído ni en live ni en backfill. Ricard gestiona
    // el estado leído/no leído de su bandeja sin que el sync lo pise. El dedupe
    // hace que reprocesar emails sea idempotente.
    // Firma mantenida para no rehacer llamadas; `markAsRead` sigue disponible para
    // una futura invocación manual si hace falta.
    const maybeMarkRead = async (_msgId: string) => {
      // intentionally left blank
    };

    const { ids: messageIds, nextPageToken } = await searchLeadEmails(token, {
      backfillDays: isBackfill ? backfillDays : undefined,
      maxResults: maxResultsParam || undefined,
      pageToken: pageTokenParam,
    });

    if (messageIds.length === 0) {
      return new Response(
        JSON.stringify({
          message: isBackfill
            ? `Backfill ${backfillDays}d: no @contactos.coches.net emails found`
            : "No new coches.net emails",
          created: 0,
          messages_inserted: 0,
          mode: isBackfill ? "backfill" : "live",
          next_page_token: nextPageToken,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let created = 0;
    let messagesInserted = 0;
    const logs: string[] = [];
    logs.push(`MODE: ${isBackfill ? `backfill ${backfillDays}d` : "live"} | ${messageIds.length} emails`);

    for (const msgId of messageIds) {
      const msg = await fetchMessage(token, msgId);
      const subject = getHeader(msg, "Subject");
      const from = getHeader(msg, "From");
      const body = extractBody(msg.payload);

      logs.push(`Email: ${subject.slice(0, 40)}... | From: [redacted]`);

      // Verify sender is from coches.net
      if (!COCHES_NET_SENDERS.some((s) => from.toLowerCase().includes(s))) {
        logs.push("  SKIP: not from coches.net");
        await maybeMarkRead(msgId);
        continue;
      }

      // Skip promotional/notification emails that should not create leads.
      // Las llamadas van a otro canal (futuro); las newsletters/ofertas son ruido.
      const subjLower = subject.toLowerCase();
      const SKIP_SUBJECT_PATTERNS = [
        "contacto de llamada",
        "llamada atendida",
        "llamada perdida",
        "llamada no atendida",
        "te pueden interesar",
        "próxima aventura",
        "proxima aventura",
        "newsletter",
        "oferta",
        "comunicación comercial",
        "comunicacion comercial",
        "comunicación publicitaria",
        "comunicacion publicitaria",
        "estos coches",
      ];
      if (SKIP_SUBJECT_PATTERNS.some((p) => subjLower.includes(p))) {
        logs.push(`  SKIP: promo/notification subject: ${subject.slice(0, 40)}`);
        await maybeMarkRead(msgId);
        continue;
      }

      const fromLower = from.toLowerCase();
      if (
        fromLower.includes("sugerencias.coches.net") ||
        fromLower.includes("email.coches.net") ||
        fromLower.includes("no-reply@") ||
        fromLower.includes("noreply@coches")
      ) {
        logs.push("  SKIP: promo sender");
        await maybeMarkRead(msgId);
        continue;
      }

      // Detect email type
      if (isFollowupEmail(body)) {
        logs.push("  TYPE: follow-up conversation");
        const leadId = await findExistingLead(sb, body);
        if (!leadId) {
          logs.push("  SKIP: could not find existing lead for follow-up");
          await maybeMarkRead(msgId);
          continue;
        }

        const convMessages = parseConversationMessages(body);
        logs.push(`  Parsed ${convMessages.length} messages from conversation`);
        const n = await insertMessages(sb, leadId, convMessages, msgId);
        messagesInserted += n;
        logs.push(`  Inserted ${n} new messages (deduped)`);
        await maybeMarkRead(msgId);
        continue;
      }

      // Type 1: New lead
      logs.push("  TYPE: new lead");
      const lead = parseCochesNetLead(subject, body, from);
      logs.push(`  Lead: ${redactName(lead.name)} | ${redactPhone(lead.phone)} | ${lead.vehicle_interest}`);

      // Descartar emails sin señal real: sin teléfono ni email_contact ni reply_to_email.
      // El parser ya intenta fallback de nombre por email; si todo vino vacío, es newsletter/ruido.
      if (!lead.phone && !lead.email_contact && !lead.reply_to_email) {
        logs.push("  SKIP: email sin datos de contacto (probable newsletter)");
        await maybeMarkRead(msgId);
        continue;
      }

      // Match lead existente por phone OR email OR reply_to_email. Si existe:
      //  - añadir el body del email como un mensaje nuevo (conversa)
      //  - enriquecer campos que estaban vacíos (reply_to_email, phone, vehicle_id)
      //  - NO crear un lead duplicado.
      const orParts: string[] = [];
      if (lead.phone) orParts.push(`phone.eq.${lead.phone}`);
      if (lead.email_contact) orParts.push(`email.eq.${lead.email_contact}`);
      if (lead.reply_to_email) orParts.push(`reply_to_email.eq.${lead.reply_to_email}`);
      if (orParts.length > 0) {
        const { data: existing } = await sb
          .from("leads")
          .select("id, phone, reply_to_email, vehicle_id")
          .eq("company_id", COMPANY_ID)
          .or(orParts.join(","))
          .limit(1);
        if (existing && existing.length > 0) {
          const existingLead = existing[0];
          const existingLeadId = existingLead.id as number;
          logs.push(`  MATCH: existing lead id=${existingLeadId} — appending message + enrich`);

          const msgContent = lead.notes.split("\n\n---\n")[0].replace("[coches.net] ", "");
          const n = await insertMessages(sb, existingLeadId, [{
            sender: "lead",
            sender_name: lead.name,
            content: msgContent,
            timestamp: new Date().toISOString(),
          }], msgId);
          messagesInserted += n;

          // Rellenar campos vacíos del lead previo con los datos del email nuevo
          const patch: Record<string, unknown> = {};
          if (!existingLead.phone && lead.phone) patch.phone = lead.phone;
          if (!existingLead.reply_to_email && lead.reply_to_email) patch.reply_to_email = lead.reply_to_email;
          if (!existingLead.vehicle_id) {
            // Re-ejecutar match de vehículo (ad ID o fuzzy) para el email nuevo
            const adIdMatch = (body + " " + subject).match(/coches\.net\/[^\s]*?-?(\d{7,9})/i);
            if (adIdMatch) {
              const { data: listings } = await sb
                .from("vehicle_listings")
                .select("vehicle_id")
                .eq("external_source", "coches_net")
                .ilike("external_url", `%${adIdMatch[1]}%`)
                .limit(1);
              if (listings && listings.length > 0) patch.vehicle_id = listings[0].vehicle_id;
            }
          }
          if (Object.keys(patch).length > 0) {
            await sb.from("leads").update(patch).eq("id", existingLeadId);
            logs.push(`  ENRICHED lead id=${existingLeadId}: ${Object.keys(patch).join(",")}`);
          }

          await maybeMarkRead(msgId);
          continue;
        }
      }

      // Match vehicle by coches.net ad URL, then by name
      let vehicle_id: number | null = null;

      // Strategy 1: Extract coches.net ad ID from email body/subject
      const adIdMatch = (body + " " + subject).match(/coches\.net\/[^\s]*?-?(\d{7,9})/i);
      if (adIdMatch) {
        const adId = adIdMatch[1];
        const { data: listings } = await sb
          .from("vehicle_listings")
          .select("vehicle_id")
          .eq("external_source", "coches_net")
          .ilike("external_url", `%${adId}%`);
        if (listings && listings.length > 0) {
          vehicle_id = listings[0].vehicle_id;
          logs.push(`  MATCHED vehicle by ad ID ${adId} → vehicle_id=${vehicle_id}`);
        }
      }

      // Strategy 2: Fuzzy name match (all estados)
      if (!vehicle_id && lead.vehicle_interest) {
        const { data: vehicles } = await sb
          .from("vehicles")
          .select("id, name")
          .eq("company_id", COMPANY_ID);

        if (vehicles) {
          const words = lead.vehicle_interest.toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);
          let bestMatch: { id: number; name: string } | null = null;
          let bestScore = 0;
          for (const v of vehicles) {
            const vLower = v.name.toLowerCase();
            const score = words.filter((w: string) => vLower.includes(w)).length;
            if (score > bestScore && score >= Math.min(2, words.length)) {
              bestScore = score;
              bestMatch = v;
            }
          }
          if (bestMatch) {
            vehicle_id = bestMatch.id;
            logs.push(`  MATCHED vehicle by name: ${bestMatch.name} (id=${vehicle_id}, score=${bestScore}/${words.length})`);
          }
        }
      }

      if (!vehicle_id) {
        logs.push("  NO vehicle match found");
      }

      // Insert lead
      const leadData: Record<string, unknown> = {
        company_id: COMPANY_ID,
        name: lead.name,
        phone: lead.phone,
        email: lead.email_contact,
        notes: lead.notes,
        vehicle_interest: lead.vehicle_interest,
        estado: "nuevo",
        canal: "coches.net",
        fecha_contacto: new Date().toISOString(),
      };
      if (lead.reply_to_email) {
        leadData.reply_to_email = lead.reply_to_email;
      }
      if (vehicle_id) {
        leadData.vehicle_id = vehicle_id;
      }

      const { data: insertedData, error } = await sb.from("leads").insert(leadData).select("id");
      if (error) {
        logs.push(`  ERROR inserting lead: ${error.message}`);
      } else {
        logs.push(`  CREATED lead: ${lead.name}`);
        created++;

        // Insert first message into lead_messages
        const newLeadId = insertedData?.[0]?.id;
        if (newLeadId && lead.notes) {
          const n = await insertMessages(sb, newLeadId, [{
            sender: "lead",
            sender_name: lead.name,
            content: lead.notes.split("\n\n---\n")[0].replace("[coches.net] ", ""),
            timestamp: new Date().toISOString(),
          }], msgId);
          messagesInserted += n;
        }
      }

      await maybeMarkRead(msgId);
    }

    return new Response(
      JSON.stringify({
        message: `Done. Created ${created} new leads, inserted ${messagesInserted} messages from ${messageIds.length} emails.`,
        created,
        messages_inserted: messagesInserted,
        total_emails: messageIds.length,
        mode: isBackfill ? "backfill" : "live",
        next_page_token: nextPageToken,
        logs,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
