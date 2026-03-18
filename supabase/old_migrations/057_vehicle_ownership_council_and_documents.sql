-- Add ownership and council assignment to vehicles
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS ownership_type VARCHAR,
  ADD COLUMN IF NOT EXISTS council_assignment VARCHAR;

-- Documents: support vehicle documents and optional doc_type/file_url
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS doc_type VARCHAR,
  ADD COLUMN IF NOT EXISTS file_url TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_vehicle ON documents(vehicle_id);

