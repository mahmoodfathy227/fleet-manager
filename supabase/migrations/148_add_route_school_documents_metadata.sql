-- Add optional title/notes metadata for documents
-- and support linking documents generically to routes and schools

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN documents.title IS 'Short title or label for the document';
COMMENT ON COLUMN documents.notes IS 'Optional free-text notes or description for the document';

