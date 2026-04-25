import { COCHES_NET_SENDERS, DEALER_NAME, MONTH_MAP } from "./constants.ts";

// ── Gmail message types ────────────────────────────────────────────

export interface GmailMessage {
  id: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailPart[];
  };
}

export interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

// ── Email body decoding ────────────────────────────────────────────

export function base64UrlDecode(data: string): string {
  // Gmail API entrega el body como base64url UTF-8. `atob` devuelve una cadena
  // donde cada byte está en un code point (Latin-1 efectivo), rompiendo acentos
  // y el símbolo € (E2 82 AC). Hay que decodificar como UTF-8 explícitamente.
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function getHeader(msg: GmailMessage, name: string): string {
  return (
    msg.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? ""
  );
}

export function extractBody(payload: GmailMessage["payload"]): string {
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

export function isFollowupEmail(body: string): boolean {
  return /nuevo mensaje|nuevo De /i.test(body) || body.includes("Mensajes anteriores");
}

export function parseSpanishTimestamp(dateStr: string): Date | null {
  const m = dateStr.trim().match(/(\d{1,2})\s+(\w+),?\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, day, monthName, hour, minute] = m;
  const month = MONTH_MAP[monthName.toLowerCase()];
  if (!month) return null;
  const year = new Date().getFullYear();
  return new Date(year, month - 1, parseInt(day), parseInt(hour), parseInt(minute));
}

export interface ConversationMessage {
  sender: "lead" | "dealer";
  sender_name: string;
  content: string;
  timestamp: string;
}

export function parseConversationMessages(body: string): ConversationMessage[] {
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

// ── Lead parsing (ported from Python) ──────────────────────────────

export interface ParsedLead {
  name: string;
  phone: string;
  email_contact: string;
  vehicle_interest: string;
  notes: string;
  canal: string;
  reply_to_email: string;
  message: string;
}

// Extrae el mensaje real del lead del JSON que coches.net embebe en el email.
// El payload tiene la forma: ..."inquiry":"<mensaje>"...
// Si no hay inquiry, devuelve "" (el caller usará un fallback más corto).
export function extractInquiry(body: string): string {
  const m = body.match(/"inquiry"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return "";
  return m[1]
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

export function parseCochesNetLead(subject: string, body: string, fromHeader = ""): ParsedLead {
  const lead: ParsedLead = {
    name: "",
    phone: "",
    email_contact: "",
    vehicle_interest: "",
    notes: "",
    canal: "coches.net",
    reply_to_email: "",
    message: "",
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
    "responder", "contactar", "contestar", "contacto", "email",
  ];
  const sanitizeName = (raw: string): string => {
    const cleaned = raw.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length === 0 || cleaned.length > 60) return "";
    const lower = cleaned.toLowerCase();
    if (NAME_STOPWORDS.some((w) => lower.includes(w))) return "";
    // Coches.net manda nombres en minúscula ("cristian"); aplicamos Title Case.
    return cleaned
      .split(" ")
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(" ");
  };

  // Extract name. Primero patrón específico de coches.net (estructura fija):
  //   "Tienes un nuevo contacto\ncontacto\n<NAME>\n\n<email> <phone>"
  // Si no matchea, caer en el patrón genérico por keyword.
  // Aceptamos minúscula al inicio porque coches.net suele enviar el nombre tal cual lo
  // tecleó el usuario (frecuentemente todo en minúsculas, ej: "cristian").
  const cochesNetMatch = body.match(
    /Tienes un nuevo(?:\s+contacto)+\s+([A-Za-záéíóúñÁÉÍÓÚÑÀ-Üà-ü][a-záéíóúñà-ü]+(?:[ \t]+[A-Za-záéíóúñÁÉÍÓÚÑÀ-Üà-ü][a-záéíóúñà-ü]+)*)/
  );
  if (cochesNetMatch) {
    lead.name = sanitizeName(cochesNetMatch[1]);
  }
  if (!lead.name) {
    const nameMatch = body.match(
      /(?:[Nn]ombre|[Nn]ame|[Dd]e parte de|[Cc]ontacto)\s*:?\s*([A-Za-záéíóúñÁÉÍÓÚÑÀ-Üà-ü][a-záéíóúñà-ü]+(?:[ \t]+[A-Za-záéíóúñÁÉÍÓÚÑÀ-Üà-ü][a-záéíóúñà-ü]+)*)/
    );
    if (nameMatch) {
      lead.name = sanitizeName(nameMatch[1]);
    }
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

  // Extraer el mensaje real del lead del JSON embebido. Si no hay inquiry,
  // `lead.message` queda vacío y NO se inserta mensaje — Ricard solo quiere
  // ver el mensaje original del lead, no notificaciones de "hay un interesado".
  lead.message = extractInquiry(body);

  return lead;
}

// ── Redaction helpers (logging) ───────────────────────────────────

export function redactPhone(phone: string): string {
  if (!phone || phone.length < 4) return "***";
  return "***" + phone.slice(-3);
}

export function redactName(name: string): string {
  if (!name) return "***";
  return name.charAt(0) + "***";
}
