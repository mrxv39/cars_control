import { jsPDF } from "jspdf";
import { SalesRecord, StockVehicle } from "../types";

export function generateSalesReportPDF(
  records: SalesRecord[],
  stock: StockVehicle[],
  title: string = "Reporte de Ventas"
) {
  if (records.length === 0) return;

  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let yPosition = 20;

  // Título
  doc.setFontSize(16);
  doc.text(title, margin, yPosition);
  yPosition += 10;

  // Fecha de generación
  doc.setFontSize(10);
  doc.setTextColor(100);
  const today = new Date().toLocaleDateString("es-ES");
  doc.text(`Generado: ${today}`, margin, yPosition);
  yPosition += 10;

  // Crear mapa de vehículos
  const vehicleMap = new Map(stock.map((v) => [v.folder_path, v]));

  // Resumen financiero
  const totalVentas = records.length;
  const totalBeneficio = records.reduce((sum, r) => sum + r.price_final, 0);
  const promedioBeneficio = totalVentas > 0 ? totalBeneficio / totalVentas : 0;

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Resumen Financiero", margin, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.text(`Total de ventas: ${totalVentas}`, margin + 5, yPosition);
  yPosition += 6;
  doc.text(`Beneficio total: €${totalBeneficio.toLocaleString("es-ES", { maximumFractionDigits: 2 })}`, margin + 5, yPosition);
  yPosition += 6;
  doc.text(`Promedio por venta: €${promedioBeneficio.toLocaleString("es-ES", { maximumFractionDigits: 2 })}`, margin + 5, yPosition);
  yPosition += 12;

  // Tabla de ventas
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Detalle de Ventas", margin, yPosition);
  yPosition += 8;

  // Headers de tabla
  const headers = ["Vehículo", "Fecha", "Precio", "Notas"];
  const colWidths = [60, 30, 30, 40];
  const cellHeight = 6;

  // Dibujar header
  doc.setFillColor(200, 200, 200);
  doc.setFontSize(9);
  let xPos = margin;
  for (let i = 0; i < headers.length; i++) {
    doc.rect(xPos, yPosition - 5, colWidths[i], cellHeight, "F");
    doc.text(headers[i], xPos + 2, yPosition, { maxWidth: colWidths[i] - 4 });
    xPos += colWidths[i];
  }
  yPosition += cellHeight;

  // Datos de tabla
  doc.setFontSize(8);
  doc.setTextColor(0);
  for (const record of records) {
    // Verificar si necesitamos nueva página
    if (yPosition > pageHeight - 20) {
      doc.addPage();
      yPosition = margin;
    }

    const vehicle = vehicleMap.get(record.vehicle_folder_path);
    const vehicleName = vehicle?.name || "Desconocido";
    const fecha = new Date(record.date).toLocaleDateString("es-ES");
    const precio = `€${record.price_final.toLocaleString("es-ES", { maximumFractionDigits: 2 })}`;
    const notas = record.notes || "-";

    xPos = margin;
    doc.setFillColor(240, 240, 240);

    // Dibujar celdas
    doc.rect(xPos, yPosition, colWidths[0], cellHeight, "F");
    doc.text(vehicleName, xPos + 2, yPosition + 4, { maxWidth: colWidths[0] - 4 });

    xPos += colWidths[0];
    doc.rect(xPos, yPosition, colWidths[1], cellHeight, "F");
    doc.text(fecha, xPos + 2, yPosition + 4, { maxWidth: colWidths[1] - 4 });

    xPos += colWidths[1];
    doc.rect(xPos, yPosition, colWidths[2], cellHeight, "F");
    doc.text(precio, xPos + 2, yPosition + 4, { maxWidth: colWidths[2] - 4 });

    xPos += colWidths[2];
    doc.rect(xPos, yPosition, colWidths[3], cellHeight, "F");
    doc.text(notas, xPos + 2, yPosition + 4, { maxWidth: colWidths[3] - 4 });

    yPosition += cellHeight;
  }

  // Footer
  yPosition += 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Codina Cars - Gestión de Ventas", margin, yPosition);

  // Guardar
  try {
    const filename = `Reporte_Ventas_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error("Error guardando PDF:", err);
    throw new Error("No se pudo generar el PDF. Inténtelo de nuevo.");
  }
}

/**
 * Genera PDF de ventas filtrado por mes.
 * @param month — 1-indexed (1=Enero, 12=Diciembre), se convierte internamente a 0-indexed para Date.
 */
export function generateMonthlyReportPDF(
  records: SalesRecord[],
  stock: StockVehicle[],
  month: number,
  year: number
) {
  const monthIndex = month - 1;
  const monthRecords = records.filter((r) => {
    const date = new Date(r.date);
    return date.getMonth() === monthIndex && date.getFullYear() === year;
  });

  const monthName = new Date(year, monthIndex).toLocaleString("es-ES", { month: "long", year: "numeric" });
  generateSalesReportPDF(monthRecords, stock, `Reporte de Ventas - ${monthName}`);
}
