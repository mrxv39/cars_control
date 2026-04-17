/**
 * Genera y descarga un archivo CSV a partir de un array de objetos.
 * Usa BOM para compatibilidad con Excel y separador ; para formato europeo.
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const BOM = "\uFEFF";
  const separator = ";";

  const escapeCell = (value: unknown): string => {
    if (value == null) return "";
    const str = String(value);
    if (str.includes(separator) || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const lines = [
    headers.join(separator),
    ...data.map((row) => headers.map((h) => escapeCell(row[h])).join(separator)),
  ];

  const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
