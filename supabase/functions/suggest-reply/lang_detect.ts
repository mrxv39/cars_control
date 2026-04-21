export type Lang = "es" | "ca";

const CATALAN_MARKERS = /\b(bona|bones|gràcies|gracies|aixo|això|vostè|podria|podrieu|tinc|tens|sóc|soc|salutacions|estic|tardes?|nits?|diumenge|dissabte|dimarts|dimecres|dijous|divendres|teniu|tenim|escriure'm|et|ets|voste|endavant|endemà|demà)\b/i;

export function detectLanguage(message: string | null | undefined): Lang {
  if (!message) return "es";
  return CATALAN_MARKERS.test(message) ? "ca" : "es";
}
