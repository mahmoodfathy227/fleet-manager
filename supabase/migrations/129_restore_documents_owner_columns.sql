-- ====================================================
-- Restore owner_type and owner_id on documents for incidents
-- ====================================================
-- TR5/TR6/TR7 and IncidentDocuments use these for incident-linked docs.
-- Link tables cover driver/pa/vehicle/subject_document; incidents stay on documents.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS owner_type VARCHAR,
  ADD COLUMN IF NOT EXISTS owner_id INTEGER;

COMMENT ON COLUMN documents.owner_type IS 'Generic owner type e.g. incident (for TR5/TR6/TR7 form storage and incident uploads)';
COMMENT ON COLUMN documents.owner_id IS 'Generic owner ID (e.g. incident.id when owner_type=incident)';

CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_type, owner_id)
  WHERE owner_type IS NOT NULL AND owner_id IS NOT NULL;
