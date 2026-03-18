-- ====================================================
-- Add indexes for vehicle search and filtering
-- ====================================================

-- Index for case-insensitive registration search
CREATE INDEX IF NOT EXISTS idx_vehicles_registration_lower 
ON vehicles (LOWER(registration));

-- Index for spare_vehicle boolean filter
CREATE INDEX IF NOT EXISTS idx_vehicles_spare_vehicle 
ON vehicles (spare_vehicle) 
WHERE spare_vehicle IS NOT NULL;

-- Index for off_the_road boolean filter
CREATE INDEX IF NOT EXISTS idx_vehicles_off_the_road 
ON vehicles (off_the_road) 
WHERE off_the_road IS NOT NULL;

-- Index for tail_lift boolean filter
CREATE INDEX IF NOT EXISTS idx_vehicles_tail_lift 
ON vehicles (tail_lift) 
WHERE tail_lift IS NOT NULL;

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_vehicles_status_filters 
ON vehicles (spare_vehicle, off_the_road, tail_lift);

