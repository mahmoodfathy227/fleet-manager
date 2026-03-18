-- ====================================================
-- Add Latitude/Longitude Columns to Schools Table
-- (Optional Enhancement for Google Maps Performance)
-- ====================================================

-- Add coordinates columns to schools table
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add index for geo queries (useful for future proximity searches)
CREATE INDEX IF NOT EXISTS idx_schools_coordinates 
ON schools(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comments
COMMENT ON COLUMN schools.latitude IS 'Latitude coordinate for Google Maps display (-90 to 90)';
COMMENT ON COLUMN schools.longitude IS 'Longitude coordinate for Google Maps display (-180 to 180)';

-- ====================================================
-- Benefits of storing coordinates:
-- ====================================================
-- 1. Faster map loading (no real-time geocoding needed)
-- 2. Reduced Google Geocoding API calls
-- 3. Consistent positioning (addresses can be ambiguous)
-- 4. Enables proximity/distance queries in the future
-- ====================================================

-- Example: Update existing schools with coordinates
-- You can manually update coordinates for existing schools like this:
-- 
-- UPDATE schools SET latitude = 51.5074, longitude = -0.1278 WHERE name = 'Example School';
--
-- Or use a geocoding service to batch-update all schools

-- ====================================================
-- Usage in Application:
-- ====================================================
-- The SchoolsMap component will:
-- 1. First check if lat/lng exists in database
-- 2. If exists, use stored coordinates (fast!)
-- 3. If not exists, geocode the address on-the-fly (slower, uses API quota)
--
-- Recommendation: Geocode and store coordinates when:
-- - Creating a new school
-- - Updating a school's address
-- ====================================================

