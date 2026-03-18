-- ====================================================
-- Add Friday PM Start Time to Routes
-- ====================================================
-- Allow routes to have a different PM start time for Friday
-- as Friday schedules often differ from other weekdays
-- ====================================================

-- Add pm_start_time_friday column to routes table
ALTER TABLE routes
ADD COLUMN IF NOT EXISTS pm_start_time_friday TIME;

COMMENT ON COLUMN routes.pm_start_time_friday IS 'Afternoon/PM route start time specifically for Friday (if different from regular pm_start_time)';

