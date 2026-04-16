import { jsPDF } from "jspdf";

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  type: "REBU" | "IVA";
  // Emisor (empresa)
  companyName: string;
  companyLegalName: string;
  companyCif: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  // Comprador
  buyerName: string;
  buyerDni: string;
  buyerAddress?: string;
  buyerPhone?: string;
  // Vehículo
  vehicleName: string;
  vehiclePlate?: string;
  vehicleVin?: string;
  // Precios
  purchasePrice: number; // Precio compra (solo REBU)
  salePrice: number; // Precio venta final
}

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateInvoicePDF(data: InvoiceData) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = W - margin * 2;
  let y = 20;

  // ── Header: empresa ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(data.companyLegalName, margin, y);
  y += 5;
  doc.text(`CIF: ${data.companyCif}`, margin, y);
  y += 5;
  doc.text(data.companyAddress, margin, y);
  y += 5;
  doc.text(`Tel: ${data.companyPhone} · ${data.companyEmail}`, margin, y);
  y += 10;

  // ── Línea separadora ──
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ── Factura info ──
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA", margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const rightCol = W - margin;
  doc.text(`N.º: ${data.invoiceNumber}`, rightCol, y - 4, { align: "right" });
  doc.text(`Fecha: ${data.date}`, rightCol, y + 2, { align: "right" });

  const typeLabel = data.type === "REBU"
    ? "Régimen especial de bienes usados (REBU)"
    : "IVA general 21%";
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(typeLabel, margin, y + 6);
  y += 16;

  // ── Datos del comprador ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("DATOS DEL COMPRADOR", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nombre: ${data.buyerName}`, margin + 4, y);
  y += 5;
  doc.text(`DNI/NIE: ${data.buyerDni}`, margin + 4, y);
  y += 5;
  if (data.buyerAddress) {
    doc.text(`Dirección: ${data.buyerAddress}`, margin + 4, y);
    y += 5;
  }
  if (data.buyerPhone) {
    doc.text(`Teléfono: ${data.buyerPhone}`, margin + 4, y);
    y += 5;
  }
  y += 6;

  // ── Concepto ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CONCEPTO", margin, y);
  y += 8;

  // Tabla de concepto
  const col1 = margin;
  const col2 = margin + contentWidth * 0.55;
  const col3 = margin + contentWidth * 0.75;
  const col4 = W - margin;

  // Header tabla
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 5, contentWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Descripción", col1 + 2, y);
  if (data.type === "REBU") {
    doc.text("P. Compra", col2, y, { align: "right" });
  }
  doc.text("Base", col3, y, { align: "right" });
  doc.text("Total", col4, y, { align: "right" });
  y += 6;

  // Fila del vehículo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const vehicleDesc = [
    `Vehículo: ${data.vehicleName}`,
    data.vehiclePlate ? `Matrícula: ${data.vehiclePlate}` : null,
    data.vehicleVin ? `VIN: ${data.vehicleVin}` : null,
  ].filter(Boolean).join(" · ");

  doc.text(vehicleDesc, col1 + 2, y, { maxWidth: contentWidth * 0.5 });

  if (data.type === "REBU") {
    // REBU: IVA sobre margen
    const margen = data.salePrice - data.purchasePrice;
    const baseImponible = margen / 1.21;
    const iva = margen - baseImponible;

    doc.text(`${fmt(data.purchasePrice)} €`, col2, y, { align: "right" });
    doc.text(`${fmt(data.salePrice)} €`, col3, y, { align: "right" });
    doc.text(`${fmt(data.salePrice)} €`, col4, y, { align: "right" });
    y += 12;

    // Desglose REBU
    doc.setDrawColor(220);
    doc.line(margin, y, W - margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.text("Precio de compra:", margin + 4, y);
    doc.text(`${fmt(data.purchasePrice)} €`, col4, y, { align: "right" });
    y += 6;
    doc.text("Precio de venta:", margin + 4, y);
    doc.text(`${fmt(data.salePrice)} €`, col4, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Margen bruto:", margin + 4, y);
    doc.text(`${fmt(margen)} €`, col4, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text("Base imponible (margen / 1,21):", margin + 4, y);
    doc.text(`${fmt(baseImponible)} €`, col4, y, { align: "right" });
    y += 6;
    doc.text("IVA 21% (sobre base margen):", margin + 4, y);
    doc.text(`${fmt(iva)} €`, col4, y, { align: "right" });
    y += 10;

    doc.setFillColor(230, 240, 255);
    doc.rect(margin, y - 5, contentWidth, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL FACTURA:", margin + 4, y + 1);
    doc.text(`${fmt(data.salePrice)} €`, col4, y + 1, { align: "right" });
    y += 14;

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text(
      "Factura acogida al Régimen Especial de Bienes Usados (Art. 135-139 Ley 37/1992 del IVA).",
      margin,
      y,
    );
    doc.text(
      "El IVA repercutido se calcula sobre el margen de beneficio, no sobre el precio total.",
      margin,
      y + 4,
    );
  } else {
    // IVA normal 21%
    const baseImponible = data.salePrice / 1.21;
    const iva = data.salePrice - baseImponible;

    doc.text(`${fmt(baseImponible)} €`, col3, y, { align: "right" });
    doc.text(`${fmt(data.salePrice)} €`, col4, y, { align: "right" });
    y += 12;

    doc.setDrawColor(220);
    doc.line(margin, y, W - margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.text("Base imponible:", margin + 4, y);
    doc.text(`${fmt(baseImponible)} €`, col4, y, { align: "right" });
    y += 6;
    doc.text("IVA 21%:", margin + 4, y);
    doc.text(`${fmt(iva)} €`, col4, y, { align: "right" });
    y += 10;

    doc.setFillColor(230, 240, 255);
    doc.rect(margin, y - 5, contentWidth, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL FACTURA:", margin + 4, y + 1);
    doc.text(`${fmt(data.salePrice)} €`, col4, y + 1, { align: "right" });
  }

  // Guardar
  const filename = `Factura_${data.invoiceNumber.replace(/\//g, "-")}.pdf`;
  doc.save(filename);
}
