/**
 * Supabase Edge Function: suggest-reply
 *
 * Genera un borrador de respuesta a un lead de coches.net usando Claude API.
 * Ricard revisa, edita y copia manualmente a coches.net (no enviamos nada).
 *
 * Secretos requeridos (supabase secrets set):
 *   ANTHROPIC_API_KEY         — clave Claude API
 *   SUGGEST_REPLY_SECRET      — shared secret validado en header x-app-secret
 *   SUPABASE_URL              — auto-provided
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided
 *
 * Desplegar: supabase functions deploy suggest-reply --no-verify-jwt
 * (necesario por JWT ES256 custom del proyecto.)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleRequest } from "./handler.ts";

serve((req) =>
  handleRequest(req, {
    env: {
      SUGGEST_REPLY_SECRET: Deno.env.get("SUGGEST_REPLY_SECRET"),
      ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY"),
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    },
  })
);
