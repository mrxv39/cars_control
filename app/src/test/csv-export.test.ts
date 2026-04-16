import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DOM APIs used by exportToCSV (Blob, URL, createElement, click)
let capturedBlobContent = "";


beforeEach(() => {
  capturedBlobContent = "";

  // Mock Blob to capture content
  vi.stubGlobal(
    "Blob",
    class MockBlob {
      parts: string[];
      constructor(parts: string[], _opts?: any) {
        this.parts = parts;
        capturedBlobContent = parts.join("");
      }
    }
  );

  // Mock URL.createObjectURL / revokeObjectURL
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  });

  // Mock document.createElement to capture the download filename
  const mockLink = { href: "", download: "", click: vi.fn() };
  vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);
});

import { exportToCSV } from "../lib/csv-export";

describe("exportToCSV", () => {
  it("genera CSV con BOM, separador ; y headers correctos", () => {
    const data = [
      { nombre: "Coche A", precio: 10000 },
      { nombre: "Coche B", precio: 15000 },
    ];

    exportToCSV(data, "test.csv");

    // BOM UTF-8
    expect(capturedBlobContent.charCodeAt(0)).toBe(0xfeff);

    const lines = capturedBlobContent.slice(1).split("\r\n");
    expect(lines[0]).toBe("nombre;precio");
    expect(lines[1]).toBe("Coche A;10000");
    expect(lines[2]).toBe("Coche B;15000");
  });

  it("escapa celdas con separador, comillas y saltos de línea", () => {
    const data = [
      { concepto: 'Factura "REBU"', detalle: "linea1\nlinea2" },
      { concepto: "valor;con;separador", detalle: "normal" },
    ];

    exportToCSV(data, "escape-test");

    const lines = capturedBlobContent.slice(1).split("\r\n");
    // Header
    expect(lines[0]).toBe("concepto;detalle");
    // Comillas dobles escapadas
    expect(lines[1]).toBe('"Factura ""REBU""";"linea1\nlinea2"');
    // Separador dentro del valor
    expect(lines[2]).toBe('"valor;con;separador";normal');
  });

  it("no genera nada con array vacío", () => {
    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickSpy,
    } as any);

    exportToCSV([], "empty.csv");

    // No debería haber creado blob ni hecho click
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("trata null y undefined como string vacío", () => {
    const data = [{ a: null, b: undefined, c: 0 }];

    exportToCSV(data as any, "nulls.csv");

    const lines = capturedBlobContent.slice(1).split("\r\n");
    expect(lines[1]).toBe(";;0");
  });

  it("añade extensión .csv si no la tiene el filename", () => {
    const mockLink = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);

    exportToCSV([{ x: 1 }], "mi-export");
    expect(mockLink.download).toBe("mi-export.csv");

    exportToCSV([{ x: 1 }], "ya-tiene.csv");
    expect(mockLink.download).toBe("ya-tiene.csv");
  });
});
