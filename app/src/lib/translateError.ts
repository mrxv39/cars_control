export function translateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.";
  if (msg.includes("JWT expired") || msg.includes("invalid claim")) return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  if (msg.includes("row-level security") || msg.includes("policy")) return "No tienes permiso para esta acción.";
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) return "Este registro ya existe.";
  if (msg.includes("23503") || msg.includes("foreign key")) return "No se puede eliminar: hay datos vinculados.";
  if (msg.includes("PGRST")) return "Error del servidor. Inténtalo de nuevo en unos minutos.";
  console.error("[translateError] Unhandled:", msg);
  return "Ha ocurrido un error inesperado. Inténtalo de nuevo.";
}
