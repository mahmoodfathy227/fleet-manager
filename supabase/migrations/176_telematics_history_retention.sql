-- =====================================================================
-- Migration 176: telematics history data retention
-- =====================================================================
-- vehicle_telematics_history grows at ~52 MB/day at full load (120 vehicles,
-- 10-second webhook interval, 8 active hours/day).
-- This pg_cron job deletes rows older than 90 days daily at 02:00 UTC.
-- 90 days covers all compliance/mileage reporting windows.
-- =====================================================================

-- Schedule daily cleanup at 02:00 UTC
SELECT cron.schedule(
  'telematics-history-retention',
  '0 2 * * *',
  $$
    DELETE FROM public.vehicle_telematics_history
    WHERE telematics_timestamp < now() - INTERVAL '90 days';
  $$
);
