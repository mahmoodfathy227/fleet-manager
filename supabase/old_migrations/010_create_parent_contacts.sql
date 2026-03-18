-- ====================================================
-- Parent Contacts & Passenger Associations
-- Many-to-many relationship between passengers and parent contacts
-- ====================================================

-- Create parent_contacts table
CREATE TABLE IF NOT EXISTS parent_contacts (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR NOT NULL,
  relationship VARCHAR,
  phone_number VARCHAR,
  email VARCHAR,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS passenger_parent_contacts (
  id SERIAL PRIMARY KEY,
  passenger_id INTEGER REFERENCES passengers(id) ON DELETE CASCADE,
  parent_contact_id INTEGER REFERENCES parent_contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(passenger_id, parent_contact_id) -- Prevent duplicate links
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_passenger_parent_passenger ON passenger_parent_contacts(passenger_id);
CREATE INDEX IF NOT EXISTS idx_passenger_parent_contact ON passenger_parent_contacts(parent_contact_id);
CREATE INDEX IF NOT EXISTS idx_parent_contacts_name ON parent_contacts(full_name);
CREATE INDEX IF NOT EXISTS idx_parent_contacts_email ON parent_contacts(email);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to parent_contacts
DROP TRIGGER IF EXISTS trigger_update_parent_contacts_updated_at ON parent_contacts;
CREATE TRIGGER trigger_update_parent_contacts_updated_at
  BEFORE UPDATE ON parent_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger to passenger_parent_contacts
DROP TRIGGER IF EXISTS trigger_update_passenger_parent_contacts_updated_at ON passenger_parent_contacts;
CREATE TRIGGER trigger_update_passenger_parent_contacts_updated_at
  BEFORE UPDATE ON passenger_parent_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE parent_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE passenger_parent_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing authenticated users to perform all operations)
-- Adjust these policies based on your security requirements
CREATE POLICY "Enable read access for authenticated users" ON parent_contacts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON parent_contacts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON parent_contacts
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON parent_contacts
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON passenger_parent_contacts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON passenger_parent_contacts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON passenger_parent_contacts
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON passenger_parent_contacts
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE parent_contacts IS 'Stores parent/guardian contact information';
COMMENT ON TABLE passenger_parent_contacts IS 'Junction table linking passengers with their parent contacts (many-to-many)';
COMMENT ON COLUMN parent_contacts.full_name IS 'Full name of the parent/guardian';
COMMENT ON COLUMN parent_contacts.relationship IS 'Relationship to passenger (e.g., Mother, Father, Guardian)';
COMMENT ON COLUMN passenger_parent_contacts.passenger_id IS 'References the passenger';
COMMENT ON COLUMN passenger_parent_contacts.parent_contact_id IS 'References the parent contact';

