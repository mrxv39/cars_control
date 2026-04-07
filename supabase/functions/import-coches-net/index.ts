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

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`fetch ${url} → ${res.status}`);
  }
  return await res.text();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const dealerUrl: string = body.dealerUrl;
    const knownExternalIds: string[] = Array.isArray(body.knownExternalIds) ? body.knownExternalIds : [];
    if (!dealerUrl) {
      return new Response(JSON.stringify({ error: "dealerUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Listado del perfil
    const listingHtml = await fetchPage(dealerUrl);
    const listing = parseListing(listingHtml);

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
          newDetails.push(detail);
        }
      } catch (err) {
        console.error(`Error fetching ${newItems[i].url}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        listing,
        newDetails,
        removedExternalIds,
        fetchedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
