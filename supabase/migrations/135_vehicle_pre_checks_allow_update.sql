-- Allow authenticated users (e.g. coordinators) to update vehicle pre-checks from the dashboard
-- ====================================================

DROP POLICY IF EXISTS "Allow authenticated users to update vehicle pre checks" ON vehicle_pre_checks;
CREATE POLICY "Allow authenticated users to update vehicle pre checks"
  ON vehicle_pre_checks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow authenticated users to update vehicle pre checks" ON vehicle_pre_checks IS 'Coordinators and staff can edit pre-check records from the dashboard (e.g. notes, issues, checklist items).';
