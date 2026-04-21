/**
 * Supabase Edge Function: send-lead-reply
 *
 * Envía un email desde codinacars@gmail.com al `reply_to_email` del lead
 * (UUID@contactos.coches.net). Coches.net reenvía la respuesta al chat
 * del portal automáticamente.
 *
 * Si el envío es exitoso, registra el mensaje en lead_messages (sender=dealer).
 *
 * Secretos requeridos:
 *   SUGGEST_REPLY_SECRET     — shared secret en header x-app-secret (reusa el de suggest-reply)
 *   GMAIL_CLIENT_ID          — OAuth client id (compartido con sync-leads)
 *   GMAIL_CLIENT_SECRET      — OAuth client secret
 *   GMAIL_REFRESH_TOKEN      — refresh token con scope gmail.modify
 *   SUPABASE_URL             — auto-provided
 *   SUPABASE_SERVICE_ROLE_KEY — auto-provided
 *
 * Desplegar: supabase functions deploy send-lead-reply --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleRequest } from "./handler.ts";

serve((req) =>
  handleRequest(req, {
    env: {
      SUGGEST_REPLY_SECRET: Deno.env.get("SUGGEST_REPLY_SECRET"),
      GMAIL_CLIENT_ID: Deno.env.get("GMAIL_CLIENT_ID"),
      GMAIL_CLIENT_SECRET: Deno.env.get("GMAIL_CLIENT_SECRET"),
      GMAIL_REFRESH_TOKEN: Deno.env.get("GMAIL_REFRESH_TOKEN"),
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    },
  })
);
