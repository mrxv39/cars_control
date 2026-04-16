export const CATEGORY_LABELS: Record<string, string> = {
  SIN_CATEGORIZAR: "Sin categorizar",
  COMPRA_VEHICULO: "Compra vehículo",
  VENTA_VEHICULO: "Venta vehículo",
  COBRO_FINANCIERA: "Cobro financiera",
  REPARACION: "Reparación",
  GESTORIA: "Gestoría",
  IMPUESTO_303: "Modelo 303 (IVA)",
  IMPUESTO_130: "Modelo 130 (IRPF)",
  IMPUESTO_OTRO: "Otro impuesto",
  AUTONOMO_CUOTA: "Cuota autónomo",
  SEGURO: "Seguro",
  ITV: "ITV",
  COMBUSTIBLE: "Combustible",
  TRANSPORTE: "Transporte",
  RECAMBIOS: "Recambios",
  NEUMATICOS: "Neumáticos",
  PUBLICIDAD: "Publicidad",
  SOFTWARE: "Software",
  COMISION_BANCO: "Comisión banco",
  TRASPASO_INTERNO: "Traspaso interno",
  RETIRO_PERSONAL: "Retiro personal",
  OTRO: "Otro",
};

export const CATEGORY_COLOR: Record<string, string> = {
  COMPRA_VEHICULO: "#1d4ed8",
  VENTA_VEHICULO: "#16a34a",
  COBRO_FINANCIERA: "#0891b2",
  GESTORIA: "#7c3aed",
  REPARACION: "#ea580c",
  IMPUESTO_303: "#dc2626",
  IMPUESTO_130: "#b91c1c",
  IMPUESTO_OTRO: "#991b1b",
  AUTONOMO_CUOTA: "#9333ea",
  SEGURO: "#0d9488",
  ITV: "#65a30d",
  COMBUSTIBLE: "#f59e0b",
  RECAMBIOS: "#ca8a04",
  NEUMATICOS: "#a16207",
  TRANSPORTE: "#0369a1",
  PUBLICIDAD: "#db2777",
  COMISION_BANCO: "#475569",
  TRASPASO_INTERNO: "#64748b",
  SIN_CATEGORIZAR: "#fbbf24",
  OTRO: "#94a3b8",
};

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
