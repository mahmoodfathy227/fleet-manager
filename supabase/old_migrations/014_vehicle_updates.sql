-- ====================================================
-- Vehicle Updates / Notes Section
-- Create table to track updates and notes for vehicles
-- ====================================================

-- Ensure the updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create vehicle_updates table
CREATE TABLE IF NOT EXISTS vehicle_updates (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  update_text TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_updates_vehicle ON vehicle_updates(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_updates_created ON vehicle_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_updates_user ON vehicle_updates(updated_by);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_vehicle_updates_updated_at ON vehicle_updates;
CREATE TRIGGER trigger_update_vehicle_updates_updated_at
  BEFORE UPDATE ON vehicle_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE vehicle_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON vehicle_updates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON vehicle_updates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON vehicle_updates
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON vehicle_updates
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE vehicle_updates IS 'Stores notes and updates related to vehicles';
COMMENT ON COLUMN vehicle_updates.vehicle_id IS 'References the vehicle this update is about';
COMMENT ON COLUMN vehicle_updates.update_text IS 'The content of the update or note';
COMMENT ON COLUMN vehicle_updates.updated_by IS 'User who created this update';
COMMENT ON COLUMN vehicle_updates.created_at IS 'When the update was created';

