-- Add AM/PM start times and days of week to routes
ALTER TABLE routes
ADD COLUMN IF NOT EXISTS am_start_time TIME,
ADD COLUMN IF NOT EXISTS pm_start_time TIME,
ADD COLUMN IF NOT EXISTS days_of_week TEXT[];

COMMENT ON COLUMN routes.am_start_time IS 'Morning/AM route start time';
COMMENT ON COLUMN routes.pm_start_time IS 'Afternoon/PM route start time';
COMMENT ON COLUMN routes.days_of_week IS 'Array of days the route runs (e.g., ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])';

