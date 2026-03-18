-- ====================================================
-- Drop taxi_license column from vehicles
-- ====================================================

ALTER TABLE vehicles DROP COLUMN IF EXISTS taxi_license;
