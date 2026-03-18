-- ====================================================
-- Allow vehicle delete: CASCADE on subject_documents.vehicle_id
-- ====================================================
-- Drop existing FK (try both possible constraint names) and re-add with ON DELETE CASCADE
-- so that deleting a vehicle automatically deletes its subject_documents rows.

ALTER TABLE subject_documents
  DROP CONSTRAINT IF EXISTS subject_documents_vehicle_fk;

ALTER TABLE subject_documents
  DROP CONSTRAINT IF EXISTS subject_documents_vehicle_id_fkey;

ALTER TABLE subject_documents
  ADD CONSTRAINT subject_documents_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
