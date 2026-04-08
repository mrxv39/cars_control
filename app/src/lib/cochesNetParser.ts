// Parser para coches.net — extrae datos estructurados de:
//  - El listado del concesionario (window.__INITIAL_PROPS__.vehiclesList.items)
//  - La ficha de cada coche (script JSON-LD con @type Car)
//
// Validado con Ricard 2026-04-07. Doc: docs/import_coches_net.md
//
// Aislado de Supabase / DOM para que funcione tanto en Vitest como en
// el runtime Deno de las edge functions.

export interface CochesNetListingItem {
  externalId: string;
  url: string;
  make: string;
  model: string;
  version: string | null;
  year: number | null;
  km: number | null;
  price: number | null;
  fuelType: string | null;
  hp: number | null;
  imgUrl: string | null;
  city: string | null;
  province: string | null;
  creationDate: string | null;
  environmentalLabel: string | null;
}

export interface CochesNetVehicleDetail {
  externalId: string | null;
  url: string;
  name: string;
  make: string;
  model: string;
  version: string | null;
  year: number | null;
  km: number | null;
  price: number | null;
  fuelType: string | null;
  hp: number | null;
  color: string | null;
  transmission: string | null;
  doors: number | null;
  seats: number | null;
  bodyType: string | null;
  displacement: number | null;
  emissionsCo2: string | null;
  environmentalLabel: string | null;
  warranty: string | null;
  description: string | null;
  equipment: string[];
  photoUrls: string[];
  videoUrls: string[];
}

// ============================================================
// Listing parser
// ============================================================
// Extrae y decodifica el bloque window.__INITIAL_PROPS__ = JSON.parse("...")
// del HTML del perfil del concesionario.
function extractInitialProps(html: string): Record<string, unknown> | null {
  // El bloque tiene la forma:
  //   window.__INITIAL_PROPS__ = JSON.parse("<json escapado>");
  // El JSON puede medir 100KB+, así que evitamos regex con backtracking
  // y caminamos a mano respetando los escapes.
  const marker = 'window.__INITIAL_PROPS__';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const parseStart = html.indexOf('JSON.parse("', start);
  if (parseStart < 0) return null;
  const literalStart = parseStart + 'JSON.parse("'.length;
  // Encontrar la comilla de cierre, ignorando las escapadas.
  let i = literalStart;
  while (i < html.length) {
    const ch = html.charCodeAt(i);
    if (ch === 92) { // '\'
      i += 2; // saltar el carácter escapado
      continue;
    }
    if (ch === 34) break; // '"'
    i++;
  }
  if (i >= html.length) return null;
  const jsLiteral = html.slice(literalStart, i);
  // El literal viene escapado al estilo JS. Lo más correcto: meterlo en un
  // JSON.parse usando comillas otra vez (porque las reglas de escape de
  // strings JSON son un superset compatible aquí).
  let unescaped: string;
  try {
    unescaped = JSON.parse(`"${jsLiteral}"`);
  } catch {
    return null;
  }
  try {
    return JSON.parse(unescaped);
  } catch {
    return null;
  }
}

export function parseListing(html: string): CochesNetListingItem[] {
  const props = extractInitialProps(html);
  if (!props) return [];
  const vehiclesList = (props as any).vehiclesList;
  if (!vehiclesList?.items || !Array.isArray(vehiclesList.items)) return [];
  return vehiclesList.items.map((it: any): CochesNetListingItem => {
    const url = typeof it.url === "string"
      ? (it.url.startsWith("http") ? it.url : `https://www.coches.net${it.url}`)
      : "";
    return {
      externalId: String(it.id),
      url,
      make: it.make ?? "",
      model: it.model ?? "",
      version: it.version ?? null,
      year: typeof it.year === "number" ? it.year : null,
      km: typeof it.km === "number" ? it.km : null,
      price: typeof it.price === "number" ? it.price : null,
      fuelType: it.fuelType ?? null,
      hp: typeof it.hp === "number" ? it.hp : null,
      imgUrl: it.imgUrl ?? null,
      city: it.location?.cityLiteral ?? null,
      province: it.location?.mainProvince ?? null,
      creationDate: it.creationDate ?? null,
      environmentalLabel: it.environmentalLabel ?? null,
    };
  });
}

// ============================================================
// Detail parser
// ============================================================
function extractCarJsonLd(html: string): Record<string, any> | null {
  // Hay varios scripts ld+json en la página; buscamos el que tiene @type Car.
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const txt = m[1].trim();
    if (!txt.includes('"Car"')) continue;
    try {
      const data = JSON.parse(txt);
      const type = data["@type"];
      if (type === "Car" || (Array.isArray(type) && type.includes("Car"))) {
        return data;
      }
    } catch {
      // Ignorar bloques mal formados
    }
  }
  return null;
}

function extractCo2(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  if (typeof raw === "object") {
    const o = raw as any;
    if (o.value != null) {
      const unit = o.unitText || o.unitCode || "";
      return `${o.value} ${unit}`.trim();
    }
  }
  return null;
}

function extractDescription(html: string): string | null {
  // El texto real del anuncio (Comentarios del anunciante) está en un div con
  // data-testid="mt-PanelAdDetails-description". Es el campo libre que escribe
  // el vendedor — incluye habitualmente la lista de equipamiento.
  const m = html.match(/<div[^>]*data-testid="mt-PanelAdDetails-description"[^>]*>([\s\S]*?)<\/div>/);
  if (m) {
    // Quitar HTML interno y normalizar espacios pero respetar saltos de línea.
    const text = m[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r\n/g, "\n");
    return decodeHtml(text).trim() || null;
  }
  // Fallback: meta description (peor calidad pero mejor que nada).
  const meta = html.match(/<meta\s+name="description"\s+content="([^"]*)"/);
  if (meta && meta[1]) return decodeHtml(meta[1]).trim();
  return null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractVideoUrls(html: string): string[] {
  const videos = new Set<string>();
  // YouTube embeds o links
  const ytRe = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{6,})/g;
  for (const m of html.matchAll(ytRe)) videos.add(m[1]);
  // mp4 directos
  const mp4Re = /(https?:\/\/[^\s"'<>]+\.mp4)/g;
  for (const m of html.matchAll(mp4Re)) videos.add(m[1]);
  return Array.from(videos);
}

export function parseDetail(html: string, fallbackUrl = ""): CochesNetVehicleDetail | null {
  const car = extractCarJsonLd(html);
  if (!car) return null;

  const url = (car["@id"] as string) || (car.url as string) || fallbackUrl;
  // El external_id está al final de la URL: ...-70337034-covo.aspx
  const idMatch = url.match(/-(\d{6,})-covo\.aspx/);
  const externalId = idMatch ? idMatch[1] : null;

  const make = (car.brand?.name as string) || "";
  const model = (car.model as string) || "";
  // name suele ser "SEAT Ibiza 1.0 MPI Reference Plus"
  const fullName = (car.name as string) || `${make} ${model}`.trim();
  // version = lo que queda al quitar "MAKE MODEL " del principio
  let version: string | null = null;
  const prefix = `${make} ${model}`.trim();
  if (prefix && fullName.toLowerCase().startsWith(prefix.toLowerCase())) {
    version = fullName.slice(prefix.length).trim() || null;
  }

  const km = car.mileageFromOdometer?.value != null ? Number(car.mileageFromOdometer.value) : null;
  const year = car.vehicleModelDate ? Number(car.vehicleModelDate) : null;

  const offers = car.offers as any;
  let price: number | null = null;
  let warranty: string | null = null;
  if (offers) {
    const raw = offers.price ?? offers[0]?.price;
    if (raw != null) {
      // Coches.net devuelve "12.990" (separador de miles "."). Quitar puntos.
      const s = String(raw).replace(/\./g, "").replace(",", ".");
      const n = parseFloat(s);
      if (!Number.isNaN(n)) price = n;
    }
    // Garantía: offers.warranty.durationOfWarranty.value + unitText
    const w = offers.warranty?.durationOfWarranty;
    if (w?.value != null) {
      warranty = `${w.value} ${w.unitText || "meses"}`.trim();
    }
  }

  const engine = car.vehicleEngine as any;
  const hpProp = engine?.power?.value ?? engine?.enginePower?.value ?? null;
  const hp = hpProp != null ? Number(hpProp) : null;
  const displacement = engine?.engineDisplacement?.value != null
    ? Math.round(Number(engine.engineDisplacement.value))
    : null;

  const equipment: string[] = [];
  const ap = car.additionalProperty;
  if (Array.isArray(ap)) {
    for (const p of ap) {
      const name = (p?.name as string) || "";
      const value = (p?.value as string) || "";
      if (name && value) equipment.push(`${name}: ${value}`);
      else if (name) equipment.push(name);
      else if (value) equipment.push(value);
    }
  }

  const images = car.image as any;
  const photoUrls: string[] = [];
  if (Array.isArray(images)) {
    for (const img of images) {
      if (typeof img === "string") photoUrls.push(img);
      else if (img?.url) photoUrls.push(String(img.url));
    }
  } else if (typeof images === "string") {
    photoUrls.push(images);
  }

  return {
    externalId,
    url,
    name: fullName,
    make,
    model,
    version,
    year,
    km,
    price,
    fuelType: (car.fuelType as string) || null,
    hp,
    color: (car.color as string) || null,
    transmission: (car.vehicleTransmission as string) || null,
    doors: car.numberOfDoors != null ? Number(car.numberOfDoors) : null,
    seats: car.seatingCapacity != null ? Number(car.seatingCapacity) : null,
    bodyType: (car.bodyType as string) || null,
    displacement,
    // emissionsCO2 es un objeto QuantitativeValue: { value: 106, unitText: "g/km" }
    emissionsCo2: extractCo2(car.emissionsCO2),
    environmentalLabel: null, // No está en el JSON-LD, viene del listado
    warranty,
    description: extractDescription(html),
    equipment,
    photoUrls,
    videoUrls: extractVideoUrls(html),
  };
}
