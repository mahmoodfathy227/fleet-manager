-- ====================================================
-- Many-to-many: driver responses <-> vehicle daily checks
-- ====================================================
-- driver_responses: optional follow-up responses from drivers (comments, acknowledgments, etc.)
-- vehicle_pre_check_driver_responses: links responses to vehicle pre-checks so we can
--   query driver responses and show them on the vehicle daily checks view.
-- ====================================================

-- Table: driver_responses (one row per response from a driver)
CREATE TABLE IF NOT EXISTS driver_responses (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  response_type VARCHAR(50) DEFAULT 'comment',  -- e.g. 'comment', 'acknowledged', 'issue_fixed'
  response_text TEXT,
  response_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_responses_employee ON driver_responses(employee_id);
CREATE INDEX IF NOT EXISTS idx_driver_responses_created ON driver_responses(created_at);

COMMENT ON TABLE driver_responses IS 'Driver follow-up responses (comments, acknowledgments) that can be linked to vehicle daily checks';

-- Junction: many-to-many between vehicle_pre_checks and driver_responses
CREATE TABLE IF NOT EXISTS vehicle_pre_check_driver_responses (
  vehicle_pre_check_id INTEGER NOT NULL REFERENCES vehicle_pre_checks(id) ON DELETE CASCADE,
  driver_response_id INTEGER NOT NULL REFERENCES driver_responses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (vehicle_pre_check_id, driver_response_id)
);

CREATE INDEX IF NOT EXISTS idx_vpc_driver_responses_check ON vehicle_pre_check_driver_responses(vehicle_pre_check_id);
CREATE INDEX IF NOT EXISTS idx_vpc_driver_responses_response ON vehicle_pre_check_driver_responses(driver_response_id);

COMMENT ON TABLE vehicle_pre_check_driver_responses IS 'Links driver responses to vehicle daily checks (many-to-many)';

-- RLS
ALTER TABLE driver_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_pre_check_driver_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read driver_responses" ON driver_responses;
CREATE POLICY "Allow authenticated read driver_responses"
  ON driver_responses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert driver_responses" ON driver_responses;
CREATE POLICY "Allow authenticated insert driver_responses"
  ON driver_responses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated update driver_responses" ON driver_responses;
CREATE POLICY "Allow authenticated update driver_responses"
  ON driver_responses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read vpc_driver_responses" ON vehicle_pre_check_driver_responses;
CREATE POLICY "Allow authenticated read vpc_driver_responses"
  ON vehicle_pre_check_driver_responses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated insert vpc_driver_responses" ON vehicle_pre_check_driver_responses;
CREATE POLICY "Allow authenticated insert vpc_driver_responses"
  ON vehicle_pre_check_driver_responses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow authenticated delete vpc_driver_responses" ON vehicle_pre_check_driver_responses;
CREATE POLICY "Allow authenticated delete vpc_driver_responses"
  ON vehicle_pre_check_driver_responses FOR DELETE TO authenticated USING (true);
