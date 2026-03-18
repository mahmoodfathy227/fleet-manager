-- ====================================================================
-- Setup Script: Automatic VOR Flagging
-- ====================================================================
-- Run this script AFTER applying migration 006_certificate_expiry_tracking.sql
-- This will:
--   1. Enable the daily cron job for automatic certificate checking
--   2. Run an initial check on all existing vehicles to flag any with expired certificates
-- ====================================================================

-- Step 1: Enable pg_cron extension (if not already enabled)
-- Note: In Supabase, pg_cron is pre-enabled. This is just a safety check.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Schedule the daily cron job
-- This will run update_expiry_flags() every day at midnight UTC
SELECT cron.schedule(
  'update-expiry-flags',           -- Job name
  '0 0 * * *',                      -- Cron schedule: Daily at 00:00 UTC
  $$SELECT update_expiry_flags();$$ -- SQL command to run
);

-- Step 3: Verify the cron job was scheduled
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'update-expiry-flags';

-- Expected output:
-- jobid | schedule  | command                           | ... | active | jobname
-- ------|-----------|-----------------------------------|-----|--------|-------------------
-- 1     | 0 0 * * * | SELECT update_expiry_flags();     | ... | t      | update-expiry-flags

-- Step 4: Run an INITIAL check on all existing vehicles
-- This will flag any vehicles that already have expired certificates
SELECT update_expiry_flags();

-- Step 5: View summary of VOR vehicles
SELECT 
  vehicle_identifier,
  registration,
  make,
  model,
  CASE 
    WHEN plate_expiry_date < CURRENT_DATE THEN 'Plate Expired'
    WHEN insurance_expiry_date < CURRENT_DATE THEN 'Insurance Expired'
    WHEN mot_date < CURRENT_DATE THEN 'MOT Expired'
    WHEN tax_date < CURRENT_DATE THEN 'Tax Expired'
    WHEN loler_expiry_date < CURRENT_DATE THEN 'LOLER Expired'
    WHEN first_aid_expiry < CURRENT_DATE THEN 'First Aid Expired'
    WHEN fire_extinguisher_expiry < CURRENT_DATE THEN 'Fire Extinguisher Expired'
    ELSE 'Unknown reason'
  END AS vor_reason,
  off_the_road
FROM vehicles
WHERE off_the_road = TRUE
ORDER BY vehicle_identifier;

-- Step 6: View summary of flagged employees (can't work)
SELECT 
  e.id,
  e.first_name,
  e.last_name,
  e.can_work,
  COALESCE(d.tas_badge_expiry_date, pa.tas_badge_expiry_date) AS tas_badge_expiry,
  d.taxi_badge_expiry_date AS taxi_badge_expiry,
  COALESCE(d.dbs_expiry_date, pa.dbs_expiry_date) AS dbs_expiry
FROM employees e
LEFT JOIN drivers d ON d.employee_id = e.id
LEFT JOIN passenger_assistants pa ON pa.employee_id = e.id
WHERE e.can_work = FALSE
ORDER BY e.last_name, e.first_name;

-- ====================================================================
-- OPTIONAL: Unschedule the cron job (if you need to stop it)
-- ====================================================================
-- SELECT cron.unschedule('update-expiry-flags');

-- ====================================================================
-- OPTIONAL: Manually trigger the function (for testing)
-- ====================================================================
-- SELECT update_expiry_flags();

-- ====================================================================
-- Setup complete! ✅
-- ====================================================================
-- The system will now automatically:
--   - Flag vehicles as VOR when certificates expire (instant via triggers)
--   - Run daily checks at midnight UTC to catch time-based expirations
--   - Re-enable vehicles when all certificates are renewed
-- ====================================================================

