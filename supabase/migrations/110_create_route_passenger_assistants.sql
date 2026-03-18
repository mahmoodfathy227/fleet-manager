-- ====================================================
-- Route Passenger Assistants (many-to-many)
-- Routes can have multiple PAs assigned.
-- routes.passenger_assistant_id is kept as "primary" PA for backward compatibility
-- (route_sessions, APA pickup logic, etc.).
-- ====================================================

CREATE TABLE IF NOT EXISTS route_passenger_assistants (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_route_passenger_assistants_route ON route_passenger_assistants(route_id);
CREATE INDEX IF NOT EXISTS idx_route_passenger_assistants_employee ON route_passenger_assistants(employee_id);

COMMENT ON TABLE route_passenger_assistants IS 'Links routes to passenger assistants. A route can have multiple PAs; keeps routes.passenger_assistant_id as primary (first) for sessions and APA logic.';

-- Backfill from existing routes.passenger_assistant_id
INSERT INTO route_passenger_assistants (route_id, employee_id, sort_order)
  SELECT id, passenger_assistant_id, 1
  FROM routes
  WHERE passenger_assistant_id IS NOT NULL
  ON CONFLICT (route_id, employee_id) DO NOTHING;

-- RLS
ALTER TABLE route_passenger_assistants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to read route passenger assistants" ON route_passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated to insert route passenger assistants" ON route_passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated to update route passenger assistants" ON route_passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated to delete route passenger assistants" ON route_passenger_assistants;

CREATE POLICY "Allow authenticated to read route passenger assistants"
  ON route_passenger_assistants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert route passenger assistants"
  ON route_passenger_assistants FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update route passenger assistants"
  ON route_passenger_assistants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete route passenger assistants"
  ON route_passenger_assistants FOR DELETE TO authenticated USING (true);
