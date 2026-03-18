-- ====================================================
-- Link uploads and notifications to subject_documents
-- ====================================================

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS subject_document_id UUID REFERENCES subject_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_subject_document_id
  ON documents(subject_document_id);

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS subject_document_id UUID REFERENCES subject_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_subject_document_id
  ON notifications(subject_document_id);

