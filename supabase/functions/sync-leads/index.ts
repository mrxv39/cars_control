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
 *
 * Module layout (split 2026-04-26):
 *   constants.ts — COMPANY_ID, DEALER_NAME, COCHES_NET_SENDERS, MONTH_MAP
 *   gmail.ts     — Gmail API I/O (token, search, fetch, mark read)
 *   parser.ts    — pure parsing (body decode, lead extraction, conversation parsing)
 *   dedupe.ts    — DB matching (find existing lead, insert messages with dedup)
 *   index.ts     — entrypoint + orchestration
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { COMPANY_ID, COCHES_NET_SENDERS } from "./constants.ts";
import { fetchMessage, getAccessToken, searchLeadEmails } from "./gmail.ts";
import {
  extractBody,
  getHeader,
  isFollowupEmail,
  parseCochesNetLead,
  parseConversationMessages,
  redactName,
  redactPhone,
} from "./parser.ts";
import { findExistingLead, insertMessages } from "./dedupe.ts";

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
    // Firma mantenida para no rehacer llamadas; `markAsRead` (en gmail.ts) sigue
    // disponible para una futura invocación manual si hace falta.
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

    // Pre-cargar gmail_message_ids ya procesados para evitar reprocesamiento
    // cuando el cron re-ejecuta cada 5 min y encuentra los mismos emails.
    // Un email ya tiene lead_messages → saltar sin tocar nada más (ya enriqueció
    // la primera vez; re-enriquecer solo pisaría fecha_contacto con la hora actual).
    const { data: processedRows } = await sb
      .from("lead_messages")
      .select("gmail_message_id")
      .in("gmail_message_id", messageIds);
    const processedIds = new Set(
      (processedRows ?? []).map((r: { gmail_message_id: string }) => r.gmail_message_id)
    );

    for (const msgId of messageIds) {
      if (processedIds.has(msgId)) {
        logs.push(`Email ${msgId}: SKIP (already processed)`);
        continue;
      }
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

          const n = await insertMessages(sb, existingLeadId, [{
            sender: "lead",
            sender_name: lead.name,
            content: lead.message,
            timestamp: new Date().toISOString(),
          }], msgId);
          messagesInserted += n;

          // Rellenar campos vacíos del lead previo con los datos del email nuevo.
          // fecha_contacto siempre se actualiza a ahora: representa "última actividad"
          // para que al llegar un mensaje nuevo el lead suba al top de la bandeja.
          const patch: Record<string, unknown> = { fecha_contacto: new Date().toISOString() };
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
          await sb.from("leads").update(patch).eq("id", existingLeadId);
          logs.push(`  ENRICHED lead id=${existingLeadId}: ${Object.keys(patch).join(",")}`);

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
        if (newLeadId && lead.message) {
          const n = await insertMessages(sb, newLeadId, [{
            sender: "lead",
            sender_name: lead.name,
            content: lead.message,
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
