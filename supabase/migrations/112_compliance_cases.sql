-- Compliance cases: track application status, date applied, appointment date per notification
-- A case is opened by admin from the notifications tab and shows all compliance procedure updates.

CREATE TABLE IF NOT EXISTS compliance_cases (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  application_status VARCHAR(20) NOT NULL DEFAULT 'not_applied' CHECK (application_status IN ('applied', 'not_applied')),
  date_applied DATE,
  appointment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notification_id)
);

COMMENT ON TABLE compliance_cases IS 'Compliance tracking case per notification: application status, date applied, appointment date';
COMMENT ON COLUMN compliance_cases.application_status IS 'Whether application has been submitted: applied or not_applied';
COMMENT ON COLUMN compliance_cases.date_applied IS 'Date the compliance application was submitted';
COMMENT ON COLUMN compliance_cases.appointment_date IS 'Scheduled or completed appointment date for the compliance procedure';

CREATE INDEX IF NOT EXISTS idx_compliance_cases_notification ON compliance_cases(notification_id);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_application_status ON compliance_cases(application_status);
CREATE INDEX IF NOT EXISTS idx_compliance_cases_created_at ON compliance_cases(created_at DESC);

-- Updates / timeline for each case
CREATE TABLE IF NOT EXISTS compliance_case_updates (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES compliance_cases(id) ON DELETE CASCADE,
  update_type VARCHAR(50) DEFAULT 'note',
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE compliance_case_updates IS 'Timeline of updates and notes for a compliance case';
COMMENT ON COLUMN compliance_case_updates.update_type IS 'e.g. note, status_change, appointment_scheduled, document_received';

CREATE INDEX IF NOT EXISTS idx_compliance_case_updates_case ON compliance_case_updates(case_id);
CREATE INDEX IF NOT EXISTS idx_compliance_case_updates_created_at ON compliance_case_updates(created_at DESC);

ALTER TABLE compliance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_case_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read compliance_cases" ON compliance_cases;
DROP POLICY IF EXISTS "Authenticated can insert compliance_cases" ON compliance_cases;
DROP POLICY IF EXISTS "Authenticated can update compliance_cases" ON compliance_cases;
DROP POLICY IF EXISTS "Authenticated can read compliance_case_updates" ON compliance_case_updates;
DROP POLICY IF EXISTS "Authenticated can insert compliance_case_updates" ON compliance_case_updates;
DROP POLICY IF EXISTS "Authenticated can update compliance_case_updates" ON compliance_case_updates;

CREATE POLICY "Authenticated can read compliance_cases"
  ON compliance_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert compliance_cases"
  ON compliance_cases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update compliance_cases"
  ON compliance_cases FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can read compliance_case_updates"
  ON compliance_case_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert compliance_case_updates"
  ON compliance_case_updates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update compliance_case_updates"
  ON compliance_case_updates FOR UPDATE TO authenticated USING (true);
