-- ====================================================
-- Drop taxi_registration_driver column from vehicles
-- ====================================================

ALTER TABLE vehicles DROP COLUMN IF EXISTS taxi_registration_driver;
