-- ====================================================
-- Drop taxi_badge_number and taxi_badge_expiry_date from vehicles
-- ====================================================

ALTER TABLE vehicles DROP COLUMN IF EXISTS taxi_badge_number;
ALTER TABLE vehicles DROP COLUMN IF EXISTS taxi_badge_expiry_date;
