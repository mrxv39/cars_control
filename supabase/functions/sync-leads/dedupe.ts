import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { COMPANY_ID } from "./constants.ts";
import type { ConversationMessage } from "./parser.ts";

type Sb = ReturnType<typeof createClient>;

export async function findExistingLead(
  sb: Sb,
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

export async function insertMessages(
  sb: Sb,
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
