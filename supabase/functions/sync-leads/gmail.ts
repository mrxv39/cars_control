import type { GmailMessage } from "./parser.ts";

export async function getAccessToken(): Promise<string> {
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

export interface SearchOptions {
  backfillDays?: number;   // if set, queries newer_than:Nd from @contactos.coches.net
  maxResults?: number;     // default 20 (live), 100 (backfill)
  pageToken?: string;      // Gmail API pageToken for pagination
}

export interface SearchResult {
  ids: string[];
  nextPageToken: string | null;
}

export async function searchLeadEmails(token: string, opts: SearchOptions = {}): Promise<SearchResult> {
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

export async function fetchMessage(
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

export async function markAsRead(token: string, messageId: string): Promise<void> {
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
