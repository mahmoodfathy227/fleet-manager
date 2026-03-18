-- Add taxi badge fields to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS taxi_badge_number VARCHAR,
ADD COLUMN IF NOT EXISTS taxi_badge_expiry_date DATE;

COMMENT ON COLUMN vehicles.taxi_badge_number IS 'Taxi badge number for the vehicle';
COMMENT ON COLUMN vehicles.taxi_badge_expiry_date IS 'Taxi badge expiry date';

