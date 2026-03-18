-- ====================================================
-- Subject documents (checklist items per subject)
-- ====================================================

CREATE TABLE IF NOT EXISTS subject_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES document_requirements(id) ON DELETE CASCADE,
  subject_type certificate_subject_type NOT NULL,
  driver_employee_id INTEGER REFERENCES drivers(employee_id) ON DELETE CASCADE,
  pa_employee_id INTEGER REFERENCES passenger_assistants(employee_id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'missing',
  certificate_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  CHECK (
    (subject_type = 'driver' AND driver_employee_id IS NOT NULL AND pa_employee_id IS NULL AND vehicle_id IS NULL AND employee_id IS NULL) OR
    (subject_type = 'pa' AND pa_employee_id IS NOT NULL AND driver_employee_id IS NULL AND vehicle_id IS NULL AND employee_id IS NULL) OR
    (subject_type = 'vehicle' AND vehicle_id IS NOT NULL AND driver_employee_id IS NULL AND pa_employee_id IS NULL AND employee_id IS NULL) OR
    (subject_type = 'employee' AND employee_id IS NOT NULL AND driver_employee_id IS NULL AND pa_employee_id IS NULL AND vehicle_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_documents_driver_unique
  ON subject_documents(requirement_id, driver_employee_id)
  WHERE driver_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_documents_pa_unique
  ON subject_documents(requirement_id, pa_employee_id)
  WHERE pa_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_documents_vehicle_unique
  ON subject_documents(requirement_id, vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_documents_employee_unique
  ON subject_documents(requirement_id, employee_id)
  WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subject_documents_expiry_date
  ON subject_documents(expiry_date)
  WHERE expiry_date IS NOT NULL;

ALTER TABLE subject_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read subject_documents" ON subject_documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert subject_documents" ON subject_documents;
DROP POLICY IF EXISTS "Allow authenticated users to update subject_documents" ON subject_documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete subject_documents" ON subject_documents;

CREATE POLICY "Allow authenticated users to read subject_documents"
  ON subject_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert subject_documents"
  ON subject_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update subject_documents"
  ON subject_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete subject_documents"
  ON subject_documents FOR DELETE TO authenticated USING (true);

