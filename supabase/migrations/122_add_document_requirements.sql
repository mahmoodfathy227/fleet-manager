-- ====================================================
-- Document requirements (templates)
-- ====================================================

CREATE TABLE IF NOT EXISTS document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  subject_type certificate_subject_type NOT NULL,
  requires_expiry BOOLEAN DEFAULT FALSE,
  requires_upload BOOLEAN DEFAULT FALSE,
  requires_number BOOLEAN DEFAULT FALSE,
  criticality certificate_criticality DEFAULT 'recommended',
  default_validity_days INTEGER,
  renewal_notice_days INTEGER DEFAULT 30,
  is_required BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  icon_path TEXT,
  color TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read document_requirements" ON document_requirements;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_requirements" ON document_requirements;
DROP POLICY IF EXISTS "Allow authenticated users to update document_requirements" ON document_requirements;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_requirements" ON document_requirements;

CREATE POLICY "Allow authenticated users to read document_requirements"
  ON document_requirements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert document_requirements"
  ON document_requirements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update document_requirements"
  ON document_requirements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete document_requirements"
  ON document_requirements FOR DELETE TO authenticated USING (true);

