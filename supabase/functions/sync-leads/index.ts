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
const COCHES_NET_SENDERS = ["coches.net", "adevinta", "noreply"];

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

async function searchUnreadFromCoches(token: string): Promise<string[]> {
  const query = encodeURIComponent(
    "is:unread (from:coches.net OR from:adevinta OR from:noreply)"
  );
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail search error: ${err}`);
  }
  const data = await res.json();
  return (data.messages ?? []).map((m: { id: string }) => m.id);
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
}

function parseCochesNetLead(subject: string, body: string): ParsedLead {
  const lead: ParsedLead = {
    name: "",
    phone: "",
    email_contact: "",
    vehicle_interest: "",
    notes: "",
    canal: "coches.net",
  };

  // Extract vehicle from subject
  const vehicleMatch = subject.match(
    /(?:sobre|en tu|interesado en)\s+(.+?)(?:\s*[-|]|$)/i
  );
  if (vehicleMatch) {
    lead.vehicle_interest = vehicleMatch[1].trim();
  }

  // Extract name
  const nameMatch = body.match(
    /(?:nombre|name|de parte de|contacto)\s*:?\s*([A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)*)/i
  );
  if (nameMatch) {
    lead.name = nameMatch[1].trim();
  }

  // Extract phone
  const phones = body.match(/\b(?:\+?34?\s*)?(\d{3}[\s.\-]?\d{3}[\s.\-]?\d{3})\b/);
  if (phones) {
    lead.phone = phones[0].replace(/[\s.\-]/g, "");
  }

  // Extract email (filter out coches.net/adevinta)
  const emails = body.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/g) ?? [];
  const contactEmails = emails.filter(
    (e) =>
      !COCHES_NET_SENDERS.some((s) => e.toLowerCase().includes(s))
  );
  if (contactEmails.length > 0) {
    lead.email_contact = contactEmails[0];
  }

  // Fallback name from email
  if (!lead.name && lead.email_contact) {
    lead.name = lead.email_contact
      .split("@")[0]
      .replace(/\./g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
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

  try {
    const token = await getAccessToken();
    const messageIds = await searchUnreadFromCoches(token);

    if (messageIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new coches.net emails", created: 0, messages_inserted: 0 }),
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

    for (const msgId of messageIds) {
      const msg = await fetchMessage(token, msgId);
      const subject = getHeader(msg, "Subject");
      const from = getHeader(msg, "From");
      const body = extractBody(msg.payload);

      logs.push(`Email: ${subject.slice(0, 40)}... | From: [redacted]`);

      // Verify sender is from coches.net
      if (!COCHES_NET_SENDERS.some((s) => from.toLowerCase().includes(s))) {
        logs.push("  SKIP: not from coches.net");
        await markAsRead(token, msgId);
        continue;
      }

      // Detect email type
      if (isFollowupEmail(body)) {
        logs.push("  TYPE: follow-up conversation");
        const leadId = await findExistingLead(sb, body);
        if (!leadId) {
          logs.push("  SKIP: could not find existing lead for follow-up");
          await markAsRead(token, msgId);
          continue;
        }

        const convMessages = parseConversationMessages(body);
        logs.push(`  Parsed ${convMessages.length} messages from conversation`);
        const n = await insertMessages(sb, leadId, convMessages, msgId);
        messagesInserted += n;
        logs.push(`  Inserted ${n} new messages (deduped)`);
        await markAsRead(token, msgId);
        continue;
      }

      // Type 1: New lead
      logs.push("  TYPE: new lead");
      const lead = parseCochesNetLead(subject, body);
      logs.push(`  Lead: ${redactName(lead.name)} | ${redactPhone(lead.phone)} | ${lead.vehicle_interest}`);

      // Check if lead already exists by phone
      if (lead.phone) {
        const { data: existing } = await sb
          .from("leads")
          .select("id")
          .eq("company_id", COMPANY_ID)
          .eq("phone", lead.phone);
        if (existing && existing.length > 0) {
          logs.push(`  SKIP: lead with phone ${redactPhone(lead.phone)} already exists`);
          await markAsRead(token, msgId);
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

      await markAsRead(token, msgId);
    }

    return new Response(
      JSON.stringify({
        message: `Done. Created ${created} new leads, inserted ${messagesInserted} messages from ${messageIds.length} emails.`,
        created,
        messages_inserted: messagesInserted,
        total_emails: messageIds.length,
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
