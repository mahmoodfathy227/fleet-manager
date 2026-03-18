-- Incident party entries: each related employee (driver, PA, etc.) can submit their detailed view of the incident
-- ====================================================

CREATE TABLE IF NOT EXISTS incident_party_entries (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entry_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(incident_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_party_entries_incident ON incident_party_entries(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_party_entries_employee ON incident_party_entries(employee_id);

COMMENT ON TABLE incident_party_entries IS 'Detailed account from each party (driver, PA) related to an incident; one entry per incident per employee';

ALTER TABLE incident_party_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read incident party entries"
  ON incident_party_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert incident party entries"
  ON incident_party_entries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update incident party entries"
  ON incident_party_entries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete incident party entries"
  ON incident_party_entries FOR DELETE TO authenticated USING (true);

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION set_incident_party_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incident_party_entries_updated_at ON incident_party_entries;
CREATE TRIGGER incident_party_entries_updated_at
  BEFORE UPDATE ON incident_party_entries
  FOR EACH ROW EXECUTE FUNCTION set_incident_party_entry_updated_at();
