-- ============================================================
-- Setup pg_cron to call sync-leads Edge Function every 5 minutes
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the cron job that calls the Edge Function every 5 minutes
-- It uses pg_net to make an HTTP POST to the Edge Function URL
SELECT cron.schedule(
  'sync-leads-coches',          -- job name
  '*/5 * * * *',                -- every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://hyydkyhvgcekvtkrnspf.supabase.co/functions/v1/sync-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- Useful commands:
--
-- List all cron jobs:
--   SELECT * FROM cron.job;
--
-- See execution history:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Disable the job:
--   SELECT cron.unschedule('sync-leads-coches');
--
-- Change frequency to every 10 minutes:
--   SELECT cron.alter_job(
--     (SELECT jobid FROM cron.job WHERE jobname = 'sync-leads-coches'),
--     schedule := '*/10 * * * *'
--   );
-- ============================================================
