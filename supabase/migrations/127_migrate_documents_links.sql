-- ====================================================
-- Backfill document links and drop direct columns
-- ====================================================

-- Backfill driver links
INSERT INTO document_driver_links (document_id, driver_employee_id)
SELECT d.id, d.employee_id
FROM documents d
WHERE d.employee_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM drivers dr WHERE dr.employee_id = d.employee_id)
ON CONFLICT DO NOTHING;

-- Backfill PA links
INSERT INTO document_pa_links (document_id, pa_employee_id)
SELECT d.id, d.employee_id
FROM documents d
WHERE d.employee_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM passenger_assistants pa WHERE pa.employee_id = d.employee_id)
ON CONFLICT DO NOTHING;

-- Backfill vehicle links
INSERT INTO document_vehicle_links (document_id, vehicle_id)
SELECT d.id, d.vehicle_id
FROM documents d
WHERE d.vehicle_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill subject document links
INSERT INTO document_subject_document_links (document_id, subject_document_id)
SELECT d.id, d.subject_document_id
FROM documents d
WHERE d.subject_document_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Enable RLS and allow authenticated access to link tables
ALTER TABLE document_driver_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pa_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_vehicle_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_subject_document_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read document_driver_links" ON document_driver_links;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_driver_links" ON document_driver_links;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_driver_links" ON document_driver_links;
CREATE POLICY "Allow authenticated users to read document_driver_links"
  ON document_driver_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert document_driver_links"
  ON document_driver_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete document_driver_links"
  ON document_driver_links FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to read document_pa_links" ON document_pa_links;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_pa_links" ON document_pa_links;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_pa_links" ON document_pa_links;
CREATE POLICY "Allow authenticated users to read document_pa_links"
  ON document_pa_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert document_pa_links"
  ON document_pa_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete document_pa_links"
  ON document_pa_links FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to read document_vehicle_links" ON document_vehicle_links;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_vehicle_links" ON document_vehicle_links;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_vehicle_links" ON document_vehicle_links;
CREATE POLICY "Allow authenticated users to read document_vehicle_links"
  ON document_vehicle_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert document_vehicle_links"
  ON document_vehicle_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete document_vehicle_links"
  ON document_vehicle_links FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to read document_subject_document_links" ON document_subject_document_links;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_subject_document_links" ON document_subject_document_links;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_subject_document_links" ON document_subject_document_links;
CREATE POLICY "Allow authenticated users to read document_subject_document_links"
  ON document_subject_document_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert document_subject_document_links"
  ON document_subject_document_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete document_subject_document_links"
  ON document_subject_document_links FOR DELETE TO authenticated USING (true);

-- Drop direct ownership columns (migrated away)
ALTER TABLE documents
  DROP COLUMN IF EXISTS employee_id,
  DROP COLUMN IF EXISTS vehicle_id,
  DROP COLUMN IF EXISTS subject_document_id,
  DROP COLUMN IF EXISTS owner_type,
  DROP COLUMN IF EXISTS owner_id;

