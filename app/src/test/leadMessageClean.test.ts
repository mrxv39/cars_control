import { describe, it, expect } from "vitest";
import { cleanLeadMessage } from "../lib/leadMessageClean";

describe("cleanLeadMessage", () => {
  it("returns clean user message when no template markers", () => {
    expect(cleanLeadMessage("Solo el 3")).toBe("Solo el 3");
    expect(cleanLeadMessage("  Buenas Ricard  ")).toBe("Buenas Ricard");
  });

  it("returns empty string for nullish input", () => {
    expect(cleanLeadMessage(null)).toBe("");
    expect(cleanLeadMessage(undefined)).toBe("");
    expect(cleanLeadMessage("")).toBe("");
  });

  it("extracts inquiry from coches.net template with JSON payload", () => {
    const content = 'Hola buenas\r\n\r\nContesta a este email para mandar una respuesta a Javi\r\n\r\n¡Gracias por confiar en Coches.net!\r\n\r\n{"client":{"first_name":"Javi","email":"javi@example.com"},"sales_lead":{"inquiry":"Solo el 3","version":"1.0.0"}}';
    expect(cleanLeadMessage(content)).toBe("Solo el 3");
  });

  it("extracts inquiry with escaped quotes", () => {
    const content = 'Contesta a este email\n{"sales_lead":{"inquiry":"Me interesa el coche, ¿podemos hablar?"}}';
    expect(cleanLeadMessage(content)).toBe("Me interesa el coche, ¿podemos hablar?");
  });

  it("unescapes \\n and \\r inside inquiry", () => {
    const content = 'Contesta a este email\n{"sales_lead":{"inquiry":"Hola\\r\\nMe interesa"}}';
    expect(cleanLeadMessage(content)).toBe("Hola\nMe interesa");
  });

  it("falls back to short label when template has no inquiry", () => {
    const content = 'Hola buenas\nContesta a este email para mandar una respuesta a Javi\n¡Gracias por confiar en Coches.net!';
    expect(cleanLeadMessage(content)).toBe("Nuevo contacto desde coches.net");
  });

  it("leaves subject-only content untouched when no template markers", () => {
    const content = "coches.net: Hay una persona interesada en tu anuncio MAZDA Mazda2\n\nResponder en coches.net para mantener puntuacion.";
    expect(cleanLeadMessage(content)).toBe(content.trim());
  });
});
