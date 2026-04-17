/// <reference types="node" />
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseListing, parseDetail } from "../lib/cochesNetParser";

let listingHtml = "";
let detailHtml = "";

beforeAll(() => {
  const fixturesDir = join(__dirname, "fixtures");
  listingHtml = readFileSync(join(fixturesDir, "coches-net-listing.html"), "utf-8");
  detailHtml = readFileSync(join(fixturesDir, "coches-net-detail.html"), "utf-8");
});

describe("parseListing (coches.net concesionario)", () => {
  it("extrae los 15 coches del perfil de CodinaCars", () => {
    const items = parseListing(listingHtml);
    expect(items.length).toBe(15);
  });

  it("cada item tiene id, url, marca, modelo, año, km y precio", () => {
    const items = parseListing(listingHtml);
    for (const it of items) {
      expect(it.externalId).toMatch(/^\d+$/);
      expect(it.url).toContain("coches.net");
      expect(it.make).toBeTruthy();
      expect(it.model).toBeTruthy();
      expect(typeof it.year).toBe("number");
      expect(typeof it.km).toBe("number");
      expect(typeof it.price).toBe("number");
    }
  });

  it("incluye el SEAT Ibiza Reference Plus 70337034", () => {
    const items = parseListing(listingHtml);
    const seat = items.find((i) => i.externalId === "70337034");
    expect(seat).toBeDefined();
    expect(seat?.make).toBe("SEAT");
    expect(seat?.model).toBe("Ibiza");
    expect(seat?.year).toBe(2022);
    expect(seat?.km).toBe(99000);
    expect(seat?.price).toBe(12990);
    expect(seat?.fuelType).toBe("Gasolina");
    expect(seat?.hp).toBe(80);
    expect(seat?.environmentalLabel).toBe("C");
  });

  it("URLs absolutas (con https://www.coches.net)", () => {
    const items = parseListing(listingHtml);
    for (const it of items) {
      expect(it.url.startsWith("https://www.coches.net/")).toBe(true);
    }
  });
});

describe("parseDetail (ficha SEAT Ibiza)", () => {
  it("parsea el JSON-LD Car correctamente", () => {
    const d = parseDetail(detailHtml);
    expect(d).not.toBeNull();
  });

  it("extrae el external_id 70337034 desde la URL", () => {
    const d = parseDetail(detailHtml)!;
    expect(d.externalId).toBe("70337034");
  });

  it("datos básicos: marca, modelo, año, km, precio, color", () => {
    const d = parseDetail(detailHtml)!;
    expect(d.make).toBe("SEAT");
    expect(d.model).toBe("IBIZA");
    expect(d.year).toBe(2022);
    expect(d.km).toBe(99000);
    expect(d.price).toBe(12990);
    expect(d.color).toBe("Blanco");
    expect(d.fuelType).toBe("Gasolina");
  });

  it("datos técnicos: transmisión, puertas, asientos", () => {
    const d = parseDetail(detailHtml)!;
    expect(d.transmission).toBe("Manual");
    expect(d.doors).toBe(5);
    expect(d.seats).toBeGreaterThanOrEqual(4);
  });

  it("incluye al menos 1 foto en alta resolución", () => {
    const d = parseDetail(detailHtml)!;
    expect(d.photoUrls.length).toBeGreaterThan(0);
    for (const url of d.photoUrls) {
      expect(url.startsWith("http")).toBe(true);
    }
  });

  it("equipment es un array (puede estar vacío si la ficha no lo trae)", () => {
    const d = parseDetail(detailHtml)!;
    expect(Array.isArray(d.equipment)).toBe(true);
  });

  it("description contiene el texto real del anunciante con equipamiento", () => {
    const d = parseDetail(detailHtml)!;
    expect(d.description).toBeTruthy();
    expect(d.description).toContain("EQUIPAMIENTO");
    expect(d.description).toContain("Apple car play");
    expect(d.description).toContain("99.000 km certificados");
  });

  it("emissionsCo2 es un string legible (no [object Object])", () => {
    const d = parseDetail(detailHtml)!;
    expect(d.emissionsCo2).toBeTruthy();
    expect(d.emissionsCo2).not.toContain("object");
    expect(d.emissionsCo2).toMatch(/106/);
  });

  it("warranty extraída del JSON-LD offers.warranty", () => {
    const d = parseDetail(detailHtml)!;
    expect(d.warranty).toBeTruthy();
    expect(d.warranty).toMatch(/12/);
  });

  it("version se extrae del nombre completo", () => {
    const d = parseDetail(detailHtml)!;
    // name = "SEAT Ibiza 1.0 MPI Reference Plus" → version = "1.0 MPI Reference Plus"
    expect(d.version).toContain("MPI");
  });
});
