-- ====================================================
-- Passenger Updates / Notes Section
-- Create table to track updates and notes for passengers
-- ====================================================

-- Ensure the updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create passenger_updates table
CREATE TABLE IF NOT EXISTS passenger_updates (
  id SERIAL PRIMARY KEY,
  passenger_id INTEGER NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  update_text TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_passenger_updates_passenger ON passenger_updates(passenger_id);
CREATE INDEX IF NOT EXISTS idx_passenger_updates_created ON passenger_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_updates_user ON passenger_updates(updated_by);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_passenger_updates_updated_at ON passenger_updates;
CREATE TRIGGER trigger_update_passenger_updates_updated_at
  BEFORE UPDATE ON passenger_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE passenger_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON passenger_updates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON passenger_updates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON passenger_updates
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON passenger_updates
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE passenger_updates IS 'Stores notes and updates related to passengers';
COMMENT ON COLUMN passenger_updates.passenger_id IS 'References the passenger this update is about';
COMMENT ON COLUMN passenger_updates.update_text IS 'The content of the update or note';
COMMENT ON COLUMN passenger_updates.updated_by IS 'User who created this update';
COMMENT ON COLUMN passenger_updates.created_at IS 'When the update was created';

