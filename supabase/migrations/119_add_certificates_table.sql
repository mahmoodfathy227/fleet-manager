-- ====================================================
-- Add Dynamic Certificates Table
-- ====================================================

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_type_id UUID NOT NULL REFERENCES certificate_types(id) ON DELETE CASCADE,
  subject_type certificate_subject_type NOT NULL,
  driver_employee_id INTEGER REFERENCES drivers(employee_id) ON DELETE CASCADE,
  pa_employee_id INTEGER REFERENCES passenger_assistants(employee_id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  certificate_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'valid',
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_driver_unique
  ON certificates(certificate_type_id, driver_employee_id)
  WHERE driver_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_pa_unique
  ON certificates(certificate_type_id, pa_employee_id)
  WHERE pa_employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_vehicle_unique
  ON certificates(certificate_type_id, vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_employee_unique
  ON certificates(certificate_type_id, employee_id)
  WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_expiry_date
  ON certificates(expiry_date)
  WHERE expiry_date IS NOT NULL;

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read certificates" ON certificates;
DROP POLICY IF EXISTS "Allow authenticated users to insert certificates" ON certificates;
DROP POLICY IF EXISTS "Allow authenticated users to update certificates" ON certificates;
DROP POLICY IF EXISTS "Allow authenticated users to delete certificates" ON certificates;

CREATE POLICY "Allow authenticated users to read certificates"
  ON certificates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert certificates"
  ON certificates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update certificates"
  ON certificates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete certificates"
  ON certificates FOR DELETE TO authenticated USING (true);

