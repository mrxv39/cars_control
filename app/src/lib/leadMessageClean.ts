// Limpieza del contenido de lead_messages que fue guardado con el template
// completo del email reenviado por coches.net (incluyendo JSON payload).
// Los emails de coches.net tienen esta estructura:
//
//   Hola buenas
//   Contesta a este email para mandar una respuesta a <NAME>
//   ¡Gracias por confiar en Coches.net!
//   {"client":{...},"sales_lead":{..., "inquiry":"<mensaje real>", ...}}
//
// El mensaje real del lead está en `inquiry` del JSON. Extraerlo da una
// experiencia mucho mejor que mostrar el template.

const INQUIRY_RE = /"inquiry"\s*:\s*"((?:[^"\\]|\\.)*)"/;
const TEMPLATE_MARKERS = /Contesta a este email|Gracias por confiar en Coches\.net|\{"client"\s*:/i;

function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export function cleanLeadMessage(content: string | null | undefined): string {
  if (!content) return "";
  const trimmed = content.trim();

  if (!TEMPLATE_MARKERS.test(trimmed)) return trimmed;

  const match = trimmed.match(INQUIRY_RE);
  if (match && match[1]) {
    const inquiry = unescapeJsonString(match[1]).trim();
    if (inquiry) return inquiry;
  }

  // Template sin `inquiry` — probablemente un click-to-contact sin mensaje.
  // Mostrar una etiqueta corta en vez del template completo.
  return "Nuevo contacto desde coches.net";
}
