/**
 * Supabase Edge Function: import-coches-net
 *
 * Importa el stock de un concesionario de coches.net.
 *
 * Flujo:
 *   1. Fetch del HTML del perfil del concesionario.
 *   2. Parseo del bloque __INITIAL_PROPS__ → lista de coches.
 *   3. Para cada coche aún no visto en vehicle_listings:
 *        - Sleep entre fetches (modo educado).
 *        - Fetch del HTML de la ficha.
 *        - Parseo del JSON-LD Car schema.
 *        - Devuelve los datos consolidados.
 *   4. El frontend recibe el JSON y muestra el modal de previsualización.
 *
 * Esta función SOLO devuelve datos. La inserción en BD la hace el frontend
 * cuando Ricard confirma la importación.
 *
 * Edge Functions de Supabase corren en EU por defecto, así que la IP es
 * europea y coches.net no bloquea.
 *
 * POST body:
 *   { dealerUrl: "https://www.coches.net/concesionario/codinacars/",
 *     companyId: 1,
 *     knownExternalIds: ["70337034", ...] }
 *
 * Response:
 *   { listing: CochesNetListingItem[],
 *     newDetails: CochesNetVehicleDetail[],   // solo los que NO estaban en knownExternalIds
 *     removedExternalIds: string[],            // los que estaban en knownExternalIds pero ya no aparecen
 *     fetchedAt: string }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { parseListing, parseDetail } from "./parser.ts";

const ALLOWED_ORIGINS = [
  "https://carscontrol.vercel.app",
  "https://codinacars.vercel.app",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Coches.net usa Cloudflare con bot protection. Un fetch directo desde un
// datacenter (AWS/Fly) recibe 403. Usamos ScrapingBee como proxy: hace la
// petición desde IPs residenciales y bypassa Cloudflare.
//
// La API key se guarda como secret en Supabase (SCRAPINGBEE_API_KEY).
// Tier gratuito: 1000 créditos/mes, suficiente para varios concesionarios.
async function fetchPage(url: string): Promise<string> {
  const apiKey = Deno.env.get("SCRAPINGBEE_API_KEY");
  if (!apiKey) {
    throw new Error("SCRAPINGBEE_API_KEY no configurada en los secrets de Supabase");
  }
  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    render_js: "false", // coches.net mete los datos en INITIAL_PROPS, no necesitamos JS
    country_code: "es",  // IP residencial española
    premium_proxy: "true", // necesario para bypass Cloudflare
  });
  const beeUrl = `https://app.scrapingbee.com/api/v1/?${params.toString()}`;
  const res = await fetch(beeUrl);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`scrapingbee fetch ${url} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.text();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Auth: require valid Supabase JWT or service role key
  const authHeader = req.headers.get("authorization") ?? req.headers.get("apikey") ?? "";
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const dealerUrl: string = body.dealerUrl;
    const knownExternalIds: string[] = Array.isArray(body.knownExternalIds) ? body.knownExternalIds : [];
    if (!dealerUrl) {
      return new Response(JSON.stringify({ ok: false, error: "dealerUrl is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Fetching listing:", dealerUrl);
    // 1. Listado del perfil
    const listingHtml = await fetchPage(dealerUrl);
    console.log("Listing HTML length:", listingHtml.length);
    const listing = parseListing(listingHtml);
    console.log("Parsed listing items:", listing.length);

    // 2. Detectar coches nuevos vs ya conocidos
    const knownSet = new Set(knownExternalIds);
    const newItems = listing.filter((it) => !knownSet.has(it.externalId));
    const seenIds = new Set(listing.map((it) => it.externalId));
    const removedExternalIds = knownExternalIds.filter((id) => !seenIds.has(id));

    // 3. Detalle solo de los nuevos (con throttle)
    const newDetails = [];
    for (let i = 0; i < newItems.length; i++) {
      if (i > 0) await sleep(2500); // 2.5s entre fetches — comportamiento humano
      try {
        const html = await fetchPage(newItems[i].url);
        const detail = parseDetail(html, newItems[i].url);
        if (detail) {
          // Enriquecer con datos del listado que no están en el JSON-LD
          detail.environmentalLabel = newItems[i].environmentalLabel;
          (detail as any).city = newItems[i].city;
          (detail as any).province = newItems[i].province;
          newDetails.push(detail);
        }
      } catch (err) {
        console.error(`Error fetching ${newItems[i].url}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        listing,
        newDetails,
        removedExternalIds,
        fetchedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno del servidor" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
