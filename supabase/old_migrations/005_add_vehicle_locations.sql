-- Create vehicle_locations table
CREATE TABLE vehicle_locations (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    location_name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_vehicle_locations_vehicle ON vehicle_locations(vehicle_id);
CREATE INDEX idx_vehicle_locations_updated ON vehicle_locations(last_updated DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vehicle_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vehicle_locations_updated_at
    BEFORE UPDATE ON vehicle_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_locations_updated_at();

-- Add RLS policies (Row Level Security)
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all vehicle locations
CREATE POLICY "Allow authenticated users to read vehicle locations"
    ON vehicle_locations
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert vehicle locations
CREATE POLICY "Allow authenticated users to insert vehicle locations"
    ON vehicle_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update vehicle locations
CREATE POLICY "Allow authenticated users to update vehicle locations"
    ON vehicle_locations
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete vehicle locations
CREATE POLICY "Allow authenticated users to delete vehicle locations"
    ON vehicle_locations
    FOR DELETE
    TO authenticated
    USING (true);

-- Add comment
COMMENT ON TABLE vehicle_locations IS 'Stores current and historical location data for spare vehicles only';

-- Optional: Add function to update location timestamp when vehicle becomes active
CREATE OR REPLACE FUNCTION update_location_on_spare_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If vehicle is no longer a spare, update the last_updated timestamp
  -- This helps track when a vehicle was last considered a spare
  IF OLD.spare_vehicle = TRUE AND NEW.spare_vehicle = FALSE THEN
    UPDATE vehicle_locations 
    SET last_updated = NOW() 
    WHERE vehicle_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_location_on_spare_change
    AFTER UPDATE OF spare_vehicle ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_location_on_spare_status_change();

