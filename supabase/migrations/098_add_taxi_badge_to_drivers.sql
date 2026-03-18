-- ====================================================
-- Add Taxi Badge Fields to Drivers Table
-- ====================================================
-- Adds taxi_badge_number and taxi_badge_expiry_date columns
-- to the drivers table if they don't already exist.
-- ====================================================

-- Add taxi badge fields to drivers table
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS taxi_badge_number VARCHAR,
ADD COLUMN IF NOT EXISTS taxi_badge_expiry_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN drivers.taxi_badge_number IS 'Taxi badge number for the driver';
COMMENT ON COLUMN drivers.taxi_badge_expiry_date IS 'Taxi badge expiry date for the driver';

-- Create index for faster expiry queries
CREATE INDEX IF NOT EXISTS idx_drivers_taxi_badge_expiry ON drivers(taxi_badge_expiry_date);

