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
const COCHES_NET_SENDERS = ["coches.net", "adevinta", "noreply"];

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
    // Handle non-latin characters
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
  // Try plain text first, then HTML
  const textPart = findPart(payload, "text/plain");
  if (textPart?.body?.data) {
    return base64UrlDecode(textPart.body.data);
  }

  const htmlPart = findPart(payload, "text/html");
  if (htmlPart?.body?.data) {
    const html = base64UrlDecode(htmlPart.body.data);
    // Strip HTML tags
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }

  // Fallback: top-level body
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

serve(async (req) => {
  // Allow cron trigger via POST or manual via GET
  // Verify authorization for non-Supabase callers
  const authHeader = req.headers.get("Authorization");
  const expectedKey = Deno.env.get("CRON_SECRET");
  if (expectedKey && req.method === "POST") {
    if (authHeader !== `Bearer ${expectedKey}`) {
      // Allow Supabase service role calls (pg_cron uses service_role key)
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseServiceKey || authHeader !== `Bearer ${supabaseServiceKey}`) {
        return new Response("Unauthorized", { status: 401 });
      }
    }
  }

  try {
    const token = await getAccessToken();
    const messageIds = await searchUnreadFromCoches(token);

    if (messageIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new coches.net emails", created: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let created = 0;
    const logs: string[] = [];

    for (const msgId of messageIds) {
      const msg = await fetchMessage(token, msgId);
      const subject = getHeader(msg, "Subject");
      const from = getHeader(msg, "From");
      const body = extractBody(msg.payload);

      logs.push(`Email: ${subject} | From: ${from}`);

      // Verify sender is from coches.net
      if (!COCHES_NET_SENDERS.some((s) => from.toLowerCase().includes(s))) {
        logs.push("  SKIP: not from coches.net");
        await markAsRead(token, msgId);
        continue;
      }

      const lead = parseCochesNetLead(subject, body);
      logs.push(`  Lead: ${lead.name} | ${lead.phone} | ${lead.vehicle_interest}`);

      // Check if lead already exists by phone
      if (lead.phone) {
        const { data: existing } = await sb
          .from("leads")
          .select("id")
          .eq("company_id", COMPANY_ID)
          .eq("phone", lead.phone);
        if (existing && existing.length > 0) {
          logs.push(`  SKIP: lead with phone ${lead.phone} already exists`);
          await markAsRead(token, msgId);
          continue;
        }
      }

      // Try to match vehicle in stock
      let vehicle_id: number | null = null;
      if (lead.vehicle_interest) {
        const { data: vehicles } = await sb
          .from("vehicles")
          .select("id, name")
          .eq("company_id", COMPANY_ID)
          .eq("estado", "disponible");

        if (vehicles) {
          const words = lead.vehicle_interest.split(/\s+/);
          const firstTwoWords = words.slice(0, 2);
          for (const v of vehicles) {
            const vNameLower = v.name.toLowerCase();
            if (
              firstTwoWords.every((w: string) =>
                vNameLower.includes(w.toLowerCase())
              )
            ) {
              vehicle_id = v.id;
              logs.push(`  MATCHED vehicle: ${v.name} (id=${vehicle_id})`);
              break;
            }
          }
        }
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

      const { error } = await sb.from("leads").insert(leadData);
      if (error) {
        logs.push(`  ERROR inserting lead: ${error.message}`);
      } else {
        logs.push(`  CREATED lead: ${lead.name}`);
        created++;
      }

      // Mark email as read
      await markAsRead(token, msgId);
    }

    return new Response(
      JSON.stringify({
        message: `Done. Created ${created} new leads from ${messageIds.length} emails.`,
        created,
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
