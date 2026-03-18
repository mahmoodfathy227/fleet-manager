-- ====================================================
-- Add off_the_road_auto flag to vehicles
-- ====================================================

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS off_the_road_auto BOOLEAN DEFAULT FALSE;

