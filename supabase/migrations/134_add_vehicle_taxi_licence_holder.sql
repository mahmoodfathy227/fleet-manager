-- Add taxi_licence_holder_id to vehicles (driver who holds the taxi licence for this vehicle)
-- ====================================================

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS taxi_licence_holder_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_taxi_licence_holder_id ON vehicles(taxi_licence_holder_id);

COMMENT ON COLUMN vehicles.taxi_licence_holder_id IS 'Driver (employee) who holds the taxi licence for this vehicle';
