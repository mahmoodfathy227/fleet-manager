-- ====================================================
-- Incident Relations (Multiple Passengers & Employees)
-- Many-to-many relationships for incidents
-- ====================================================

-- Create incident_passengers junction table
CREATE TABLE IF NOT EXISTS incident_passengers (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
  passenger_id INTEGER REFERENCES passengers(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(incident_id, passenger_id) -- Prevent duplicate links
);

-- Create incident_employees junction table
CREATE TABLE IF NOT EXISTS incident_employees (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(incident_id, employee_id) -- Prevent duplicate links
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incident_passengers_incident ON incident_passengers(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_passengers_passenger ON incident_passengers(passenger_id);
CREATE INDEX IF NOT EXISTS idx_incident_employees_incident ON incident_employees(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_employees_employee ON incident_employees(employee_id);

-- Enable Row Level Security
ALTER TABLE incident_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_employees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON incident_passengers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON incident_passengers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON incident_passengers
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON incident_passengers
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON incident_employees
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON incident_employees
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON incident_employees
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON incident_employees
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE incident_passengers IS 'Junction table linking incidents to passengers (many-to-many)';
COMMENT ON TABLE incident_employees IS 'Junction table linking incidents to employees (many-to-many)';
COMMENT ON COLUMN incident_passengers.incident_id IS 'References the incident';
COMMENT ON COLUMN incident_passengers.passenger_id IS 'References the passenger involved';
COMMENT ON COLUMN incident_employees.incident_id IS 'References the incident';
COMMENT ON COLUMN incident_employees.employee_id IS 'References the employee involved';

