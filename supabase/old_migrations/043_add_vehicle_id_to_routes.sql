-- Add vehicle_id column to routes table
-- This allows vehicles to be directly assigned to routes, independent of driver assignments

-- Add vehicle_id column to routes table
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_routes_vehicle ON routes(vehicle_id);

-- Add helpful comment
COMMENT ON COLUMN routes.vehicle_id IS 'Assigned vehicle for this route (independent of driver assignment)';

