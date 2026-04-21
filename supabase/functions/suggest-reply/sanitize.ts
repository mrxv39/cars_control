const RICARD_PHONE = "646131565";

export function redactPhones(input: string): string {
  return input.replace(/\b\d{9}\b/g, (match) => (match === RICARD_PHONE ? match : "[TELEFONO]"));
}

export function redactEmails(input: string): string {
  return input.replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[EMAIL]");
}

export function firstNameOnly(fullName: string): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

export function sanitizeForPrompt(input: string): string {
  return redactEmails(redactPhones(input ?? ""));
}
