-- Enable pg_cron + pg_net and schedule sync-leads edge function every 5 minutes.
--
-- Applied to prod on 2026-04-21 via Supabase MCP (in this order):
--   1) CREATE EXTENSION pg_cron + pg_net (via Dashboard → Database → Extensions)
--   2) public.set_cron_sync_leads_token(text) helper RPC
--   3) Bootstrap edge function `seed-cron-vault` called once to populate vault
--   4) cron.schedule 'sync-leads-every-5m'
--   5) Bootstrap edge function deleted
--
-- The cron job reads the auth token from vault.decrypted_secrets by name
-- (never embedded in source code). If you rebuild the DB, you must re-seed
-- vault with a valid CRON_SECRET before the cron job can authenticate.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- SECURITY DEFINER RPC so a service_role caller can upsert the token in vault
-- without direct vault access from the client.
CREATE OR REPLACE FUNCTION public.set_cron_sync_leads_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_sync_leads_token';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_token, 'cron_sync_leads_token',
      'Bearer token used by pg_cron to call sync-leads edge function');
  ELSE
    PERFORM vault.update_secret(v_id, p_token);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_cron_sync_leads_token(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_cron_sync_leads_token(text) TO service_role;

-- Schedule sync-leads every 5 minutes.
SELECT cron.schedule(
  'sync-leads-every-5m',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://kpgkcersrfvzncqupkxa.supabase.co/functions/v1/sync-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_sync_leads_token'
      )
    ),
    timeout_milliseconds := 45000
  );
  $cron$
);
