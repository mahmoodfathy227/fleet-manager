-- ====================================================
-- Add passenger_id to route_points
-- Links pickup points to passengers (except first point which is for PA)
-- ====================================================

-- Add passenger_id column to route_points table
ALTER TABLE route_points 
ADD COLUMN IF NOT EXISTS passenger_id INTEGER REFERENCES passengers(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_route_points_passenger ON route_points(passenger_id);

-- Add helpful comment
COMMENT ON COLUMN route_points.passenger_id IS 'References the passenger for this pickup point. NULL for the first point (which is for PA)';
