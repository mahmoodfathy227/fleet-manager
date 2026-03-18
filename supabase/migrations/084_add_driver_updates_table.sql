-- ====================================================
-- Driver Updates / Notes Section
-- Create table to track updates and notes for drivers
-- ====================================================

-- Ensure the updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create driver_updates table
CREATE TABLE IF NOT EXISTS driver_updates (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(employee_id) ON DELETE CASCADE,
  update_text TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_updates_driver ON driver_updates(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_updates_created ON driver_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_updates_user ON driver_updates(updated_by);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_driver_updates_updated_at ON driver_updates;
CREATE TRIGGER trigger_update_driver_updates_updated_at
  BEFORE UPDATE ON driver_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE driver_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON driver_updates;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON driver_updates;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON driver_updates;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON driver_updates;

CREATE POLICY "Enable read access for authenticated users" ON driver_updates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON driver_updates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON driver_updates
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON driver_updates
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE driver_updates IS 'Stores notes and updates related to drivers';
COMMENT ON COLUMN driver_updates.driver_id IS 'References the driver (employee_id) this update is about';
COMMENT ON COLUMN driver_updates.update_text IS 'The content of the update or note';
COMMENT ON COLUMN driver_updates.updated_by IS 'User who created this update';
COMMENT ON COLUMN driver_updates.created_at IS 'When the update was created';

