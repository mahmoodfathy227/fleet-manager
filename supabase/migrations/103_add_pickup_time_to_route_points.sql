-- ====================================================
-- Add pickup_time_am and pickup_time_pm to route_points
-- Stores the scheduled pickup times for AM and PM routes
-- ====================================================

-- Add pickup_time_am column to route_points table
ALTER TABLE route_points 
ADD COLUMN IF NOT EXISTS pickup_time_am TIME;

-- Add pickup_time_pm column to route_points table
ALTER TABLE route_points 
ADD COLUMN IF NOT EXISTS pickup_time_pm TIME;

-- Create indexes for performance (if needed for queries)
-- CREATE INDEX IF NOT EXISTS idx_route_points_pickup_time_am ON route_points(pickup_time_am);
-- CREATE INDEX IF NOT EXISTS idx_route_points_pickup_time_pm ON route_points(pickup_time_pm);

-- Add helpful comments
COMMENT ON COLUMN route_points.pickup_time_am IS 'Scheduled AM pickup time for this route point (HH:MM format)';
COMMENT ON COLUMN route_points.pickup_time_pm IS 'Scheduled PM pickup time for this route point (HH:MM format)';
