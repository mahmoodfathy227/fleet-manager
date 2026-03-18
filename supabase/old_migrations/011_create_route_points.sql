-- ====================================================
-- Route Points (Stops)
-- Track pickup/dropoff points for each route
-- ====================================================

-- Create route_points table
CREATE TABLE IF NOT EXISTS route_points (
  id SERIAL PRIMARY KEY,
  route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
  point_name VARCHAR NOT NULL,
  address TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  stop_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_route_points_route_id ON route_points(route_id);
CREATE INDEX IF NOT EXISTS idx_route_points_stop_order ON route_points(route_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_route_points_coords ON route_points(latitude, longitude);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_route_points_updated_at ON route_points;
CREATE TRIGGER trigger_update_route_points_updated_at
  BEFORE UPDATE ON route_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE route_points ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON route_points
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON route_points
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON route_points
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON route_points
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE route_points IS 'Stores pickup/dropoff points (stops) for routes';
COMMENT ON COLUMN route_points.route_id IS 'References the route this point belongs to';
COMMENT ON COLUMN route_points.point_name IS 'Name of the stop (e.g., "School Gate", "Home Pickup")';
COMMENT ON COLUMN route_points.stop_order IS 'Order of stops in the route sequence (1 = first stop)';
COMMENT ON COLUMN route_points.latitude IS 'GPS latitude coordinate';
COMMENT ON COLUMN route_points.longitude IS 'GPS longitude coordinate';

