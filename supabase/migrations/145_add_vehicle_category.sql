-- ====================================================
-- Add vehicle_category column to vehicles table
-- ====================================================

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS vehicle_category TEXT CHECK (vehicle_category IN ('M1', 'N1'));

COMMENT ON COLUMN vehicles.vehicle_category IS 'Vehicle category: M1 (passenger vehicles) or N1 (goods vehicles)';
