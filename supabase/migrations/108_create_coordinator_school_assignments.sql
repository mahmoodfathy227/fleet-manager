-- ====================================================
-- Coordinator-School Assignments (many-to-many)
-- Coordinators can be assigned to one or more schools.
-- A school can have multiple coordinators.
-- ====================================================

CREATE TABLE IF NOT EXISTS coordinator_school_assignments (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_coordinator_school_assignments_employee ON coordinator_school_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_coordinator_school_assignments_school ON coordinator_school_assignments(school_id);

COMMENT ON TABLE coordinator_school_assignments IS 'Links coordinators (employees with role Coordinator) to schools. A coordinator can be assigned to multiple schools; a school can have multiple coordinators.';

-- RLS
ALTER TABLE coordinator_school_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to read coordinator school assignments" ON coordinator_school_assignments;
DROP POLICY IF EXISTS "Allow authenticated to insert coordinator school assignments" ON coordinator_school_assignments;
DROP POLICY IF EXISTS "Allow authenticated to update coordinator school assignments" ON coordinator_school_assignments;
DROP POLICY IF EXISTS "Allow authenticated to delete coordinator school assignments" ON coordinator_school_assignments;

CREATE POLICY "Allow authenticated to read coordinator school assignments"
  ON coordinator_school_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert coordinator school assignments"
  ON coordinator_school_assignments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated to update coordinator school assignments"
  ON coordinator_school_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete coordinator school assignments"
  ON coordinator_school_assignments FOR DELETE TO authenticated USING (true);
