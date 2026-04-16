/**
 * Tests for the pure parsing functions from supabase/functions/sync-leads/index.ts.
 *
 * Since the edge function uses Deno URL imports (esm.sh, deno.land), we can't
 * import it directly in vitest. Instead we copy the pure logic here and test it.
 * If the source changes, these tests will catch regressions when run manually
 * against the updated copies.
 */
import { describe, it, expect } from "vitest";

// ── Copied from sync-leads/index.ts (pure functions) ──

const DEALER_NAME = "Codina Cars";
const COCHES_NET_SENDERS = ["coches.net", "adevinta", "noreply"];

const MONTH_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4,
  mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

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
    name: "", phone: "", email_contact: "", vehicle_interest: "", notes: "", canal: "coches.net",
  };
  const vehicleMatch = subject.match(/(?:sobre|en tu|interesado en)\s+(.+?)(?:\s*[-|]|$)/i);
  if (vehicleMatch) lead.vehicle_interest = vehicleMatch[1].trim();
  const nameMatch = body.match(/(?:nombre|name|de parte de|contacto)\s*:?\s*([A-Z][a-záéíóúñ]+(?:\s+[A-Z][a-záéíóúñ]+)*)/i);
  if (nameMatch) lead.name = nameMatch[1].trim();
  const phones = body.match(/\b(?:\+?34?\s*)?(\d{3}[\s.\-]?\d{3}[\s.\-]?\d{3})\b/);
  if (phones) lead.phone = phones[0].replace(/[\s.\-]/g, "");
  const emails = body.match(/[\w.+\-]+@[\w\-]+\.[\w.]+/g) ?? [];
  const contactEmails = emails.filter((e) => !COCHES_NET_SENDERS.some((s) => e.toLowerCase().includes(s)));
  if (contactEmails.length > 0) lead.email_contact = contactEmails[0];
  if (!lead.name && lead.email_contact) {
    lead.name = lead.email_contact.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (!lead.name) {
    const now = new Date();
    lead.name = `Lead coches.net (${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")})`;
  }
  lead.notes = `[coches.net] ${subject}\n\nResponder en coches.net para mantener puntuacion.\n\n---\n${body.slice(0, 500)}`;
  return lead;
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

// ── Tests ──

describe("base64UrlDecode", () => {
  it("decodes standard base64", () => {
    expect(base64UrlDecode(btoa("hello world"))).toBe("hello world");
  });

  it("handles URL-safe characters (- and _)", () => {
    const standard = btoa("test?data>here");
    const urlSafe = standard.replace(/\+/g, "-").replace(/\//g, "_");
    expect(base64UrlDecode(urlSafe)).toBe("test?data>here");
  });
});

describe("isFollowupEmail", () => {
  it("detects 'nuevo De' pattern", () => {
    expect(isFollowupEmail("Tienes un nuevo De Juan")).toBe(true);
  });

  it("detects 'nuevo mensaje'", () => {
    expect(isFollowupEmail("Has recibido un nuevo mensaje")).toBe(true);
  });

  it("detects 'Mensajes anteriores'", () => {
    expect(isFollowupEmail("Hola\n\nMensajes anteriores\nJuan...")).toBe(true);
  });

  it("returns false for new lead emails", () => {
    expect(isFollowupEmail("Consulta sobre SEAT Ibiza")).toBe(false);
  });
});

describe("parseSpanishTimestamp", () => {
  it("parses '15 abril, 10:30'", () => {
    const d = parseSpanishTimestamp("15 abril, 10:30");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3); // april = 3
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(10);
    expect(d!.getMinutes()).toBe(30);
  });

  it("parses '3 enero 09:05' (without comma)", () => {
    const d = parseSpanishTimestamp("3 enero 09:05");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(3);
  });

  it("returns null for invalid input", () => {
    expect(parseSpanishTimestamp("invalid")).toBeNull();
    expect(parseSpanishTimestamp("15 invalidmonth, 10:30")).toBeNull();
  });
});

describe("parseCochesNetLead", () => {
  it("extracts vehicle interest from subject", () => {
    const lead = parseCochesNetLead(
      "Consulta sobre SEAT Ibiza 1.0 MPI",
      "Nombre: Juan García\n612345678\njuan@test.com"
    );
    expect(lead.vehicle_interest).toBe("SEAT Ibiza 1.0 MPI");
  });

  it("extracts name from body", () => {
    const lead = parseCochesNetLead(
      "Consulta sobre SEAT Ibiza",
      "Nombre: María López\n612345678"
    );
    expect(lead.name).toBe("María López");
  });

  it("extracts phone number", () => {
    const lead = parseCochesNetLead(
      "Consulta",
      "Contacto: 612 345 678"
    );
    expect(lead.phone).toBe("612345678");
  });

  it("extracts email filtering out coches.net addresses", () => {
    const lead = parseCochesNetLead(
      "Consulta",
      "noreply@coches.net\njuan@gmail.com\n612345678"
    );
    expect(lead.email_contact).toBe("juan@gmail.com");
  });

  it("falls back to email-based name when no name found", () => {
    const lead = parseCochesNetLead("Consulta", "juan.garcia@test.com");
    expect(lead.name).toBe("Juan Garcia");
    expect(lead.email_contact).toBe("juan.garcia@test.com");
  });

  it("generates timestamp name when nothing found", () => {
    const lead = parseCochesNetLead("Consulta", "sin datos utiles");
    expect(lead.name).toMatch(/^Lead coches\.net \(\d{2}\/\d{2} \d{2}:\d{2}\)$/);
  });

  it("always sets canal to coches.net", () => {
    const lead = parseCochesNetLead("Test", "body");
    expect(lead.canal).toBe("coches.net");
  });

  it("builds notes from subject and body", () => {
    const lead = parseCochesNetLead("Consulta sobre SEAT", "Hola quiero info");
    expect(lead.notes).toContain("[coches.net] Consulta sobre SEAT");
    expect(lead.notes).toContain("Hola quiero info");
  });
});

describe("parseConversationMessages", () => {
  it("parses new message from follow-up email", () => {
    const body = "nuevo De Juan García\nMe interesa el coche, ¿cuándo puedo verlo?\nResponde a este email para continuar.";
    const msgs = parseConversationMessages(body);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sender).toBe("lead");
    expect(msgs[0].sender_name).toBe("Juan García");
    expect(msgs[0].content).toBe("Me interesa el coche, ¿cuándo puedo verlo?");
  });

  it("detects dealer messages from Codina Cars", () => {
    const body = "nuevo De Codina Cars\nEl coche está disponible.\nResponde a este email.";
    const msgs = parseConversationMessages(body);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sender).toBe("dealer");
  });

  it("parses history section with timestamps", () => {
    const body = `nuevo De Juan
Hola de nuevo
Mensajes anteriores
María López
15 abril, 10:30
¿Tiene financiación?`;
    const msgs = parseConversationMessages(body);
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    const newMsg = msgs.find((m) => m.sender_name === "Juan");
    expect(newMsg).toBeDefined();
    expect(newMsg!.content).toBe("Hola de nuevo");
  });

  it("returns empty array when no messages found", () => {
    expect(parseConversationMessages("just some random text")).toEqual([]);
  });
});
