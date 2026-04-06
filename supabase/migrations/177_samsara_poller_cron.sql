-- Migration 177: Schedule Samsara location poller every 30 seconds
--
-- Uses two pg_cron jobs:
--   Job 1  fires at :00 of every minute
--   Job 2  sleeps 30 seconds then fires at :30 of every minute
--
-- Requires: pg_cron, pg_net (both enabled on all Supabase projects)
-- Edge Function URL: https://ilpfknjpfmgvzjafqtls.supabase.co/functions/v1/samsara-location-webhook

-- Remove any previous versions of these jobs (safe to re-run)
SELECT cron.unschedule('samsara-poll-on-minute')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'samsara-poll-on-minute');
SELECT cron.unschedule('samsara-poll-half-minute') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'samsara-poll-half-minute');

-- Job 1: fires at :00 of every minute
SELECT cron.schedule(
  'samsara-poll-on-minute',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://ilpfknjpfmgvzjafqtls.supabase.co/functions/v1/samsara-location-webhook',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

-- Job 2: fires at :30 of every minute (pg_sleep delays the HTTP call by 30 s)
SELECT cron.schedule(
  'samsara-poll-half-minute',
  '* * * * *',
  $$
    SELECT pg_sleep(30);
    SELECT net.http_post(
      url     := 'https://ilpfknjpfmgvzjafqtls.supabase.co/functions/v1/samsara-location-webhook',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
