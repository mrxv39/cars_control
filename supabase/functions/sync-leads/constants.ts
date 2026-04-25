export const COMPANY_ID = 1;
export const DEALER_NAME = "Codina Cars";

// Dominios/strings que identifican un email como originado en coches.net/Adevinta.
// Ojo: no usar "noreply" suelto — matchea noreply@norauto.es y otros remitentes
// no relacionados que Gmail nos devuelva si el query es laxo.
export const COCHES_NET_SENDERS = ["coches.net", "adevinta", "noreply@coches"];

export const MONTH_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4,
  mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
