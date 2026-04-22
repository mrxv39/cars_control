export const CATEGORY_LABELS: Record<string, string> = {
  SIN_CATEGORIZAR: "Sin categorizar",
  COMPRA_VEHICULO: "Compra vehículo",
  VENTA_VEHICULO: "Venta vehículo",
  COBRO_FINANCIERA: "Cobro financiera",
  REPARACION: "Reparación",
  PINTURA: "Pintura",
  GESTORIA: "Gestoría",
  IMPUESTO_303: "Modelo 303 (IVA)",
  IMPUESTO_130: "Modelo 130 (IRPF)",
  IMPUESTO_OTRO: "Otro impuesto",
  AUTONOMO_CUOTA: "Cuota autónomo",
  SEGURO: "Seguro",
  POLIZA_CAIXA: "Póliza CaixaBank",
  ITV: "ITV",
  COMBUSTIBLE: "Combustible",
  TRANSPORTE: "Transporte",
  PARKING: "Parking",
  RECAMBIOS: "Recambios",
  NEUMATICOS: "Neumáticos",
  PUBLICIDAD: "Publicidad",
  SOFTWARE: "Software",
  FORMACION: "Formación",
  LIMPIEZA: "Limpieza",
  ALQUILER_LOCAL: "Alquiler local",
  COMISION_BANCO: "Comisión banco",
  TRASPASO_INTERNO: "Traspaso interno",
  RETIRO_PERSONAL: "Retiro personal",
  IGNORAR: "Ignorar",
  OTRO: "Otro",
};

export const CATEGORY_COLOR: Record<string, string> = {
  COMPRA_VEHICULO: "#1d4ed8",
  VENTA_VEHICULO: "#16a34a",
  COBRO_FINANCIERA: "#0891b2",
  GESTORIA: "#7c3aed",
  REPARACION: "#ea580c",
  PINTURA: "#c2410c",
  IMPUESTO_303: "#dc2626",
  IMPUESTO_130: "#b91c1c",
  IMPUESTO_OTRO: "#991b1b",
  AUTONOMO_CUOTA: "#9333ea",
  SEGURO: "#0d9488",
  POLIZA_CAIXA: "#be185d",
  ITV: "#65a30d",
  COMBUSTIBLE: "#f59e0b",
  RECAMBIOS: "#ca8a04",
  NEUMATICOS: "#a16207",
  TRANSPORTE: "#0369a1",
  PARKING: "#0284c7",
  PUBLICIDAD: "#db2777",
  FORMACION: "#059669",
  LIMPIEZA: "#06b6d4",
  ALQUILER_LOCAL: "#6d28d9",
  COMISION_BANCO: "#475569",
  TRASPASO_INTERNO: "#64748b",
  SIN_CATEGORIZAR: "#fbbf24",
  IGNORAR: "#cbd5e1",
  OTRO: "#94a3b8",
};

// Grupos para mostrar el <select> con <optgroup> — reduce fricción al
// elegir entre 29 categorías. Orden pensado para coincidir con el flujo
// diario de Ricard (primero lo más habitual).
export const CATEGORY_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: "Sin clasificar", keys: ["SIN_CATEGORIZAR"] },
  { label: "Operaciones vehículo", keys: ["COMPRA_VEHICULO", "VENTA_VEHICULO", "COBRO_FINANCIERA"] },
  { label: "Reparaciones y piezas", keys: ["REPARACION", "PINTURA", "RECAMBIOS", "NEUMATICOS", "ITV"] },
  { label: "Trámites", keys: ["GESTORIA", "SEGURO"] },
  { label: "Logística y local", keys: ["TRANSPORTE", "PARKING", "COMBUSTIBLE", "ALQUILER_LOCAL"] },
  { label: "Operativo", keys: ["PUBLICIDAD", "SOFTWARE", "FORMACION", "LIMPIEZA"] },
  { label: "Fiscal", keys: ["IMPUESTO_303", "IMPUESTO_130", "IMPUESTO_OTRO", "AUTONOMO_CUOTA"] },
  { label: "Banco", keys: ["POLIZA_CAIXA", "COMISION_BANCO"] },
  { label: "Otros", keys: ["TRASPASO_INTERNO", "RETIRO_PERSONAL", "IGNORAR", "OTRO"] },
];

// Categorías que NO deberían aparecer como "pendientes de revisar" en los
// contadores del dashboard bancario. IGNORAR es opt-in: el usuario marca
// manualmente movimientos triviales (comisiones, redondeos, ...) para sacarlos
// del contador de "sin categorizar" sin tener que inventar una categoría fiscal.
export const REVIEW_DONE_CATEGORIES = new Set(["IGNORAR"]);

// Patrón sugerido para reglas automáticas y propagación inline.
// Prioriza counterparty_name (si lo hay) sobre la primera palabra ≥3 chars
// de la descripción, cortando por el primer separador fuerte (| / o ≥3 dígitos).
// Audit 2026-04-20: evita patrones como "eess molins fecha" que no existían
// literalmente en la descripción.
const STOP_WORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "en", "por", "para", "a", "al",
  "com", "sl", "sa", "slu", "cb", "sas", "s.l.", "s.a.",
  "transferencia", "recibo", "bizum", "traspaso", "pago",
]);

export type PeriodKey = "all" | "this_month" | "this_quarter" | "this_year";

// Devuelve el rango inclusivo (YYYY-MM-DD) correspondiente al preset temporal.
// "all" devuelve null — la API sólo filtra si se pasan fromDate/toDate.
export function periodRange(key: PeriodKey, now: Date = new Date()): { from: string; to: string } | null {
  if (key === "all") return null;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (key === "this_month") {
    return {
      from: fmt(new Date(Date.UTC(y, m, 1))),
      to: fmt(new Date(Date.UTC(y, m + 1, 0))),
    };
  }
  if (key === "this_quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return {
      from: fmt(new Date(Date.UTC(y, qStart, 1))),
      to: fmt(new Date(Date.UTC(y, qStart + 3, 0))),
    };
  }
  // this_year
  return {
    from: fmt(new Date(Date.UTC(y, 0, 1))),
    to: fmt(new Date(Date.UTC(y, 11, 31))),
  };
}

export function suggestPatternFromTx(counterpartyName: string | null | undefined, description: string | null | undefined): string {
  const counterparty = (counterpartyName || "").trim();
  if (counterparty.length >= 3) return counterparty;

  const desc = (description || "").trim();
  if (!desc) return "";

  const cutMatch = desc.match(/^(.+?)(?=\s*(?:[|/]|\d{3,}))/);
  const head = (cutMatch ? cutMatch[1] : desc).trim();
  if (head.length >= 3) return head;

  const words = desc
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 3).join(" ") || "";
}

export function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}

export function categoryColor(c: string): string {
  return CATEGORY_COLOR[c] ?? "#94a3b8";
}

export function formatEur(amount: number): string {
  return amount.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function monthOf(d: string): string {
  return d.slice(0, 7);
}

export function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}
