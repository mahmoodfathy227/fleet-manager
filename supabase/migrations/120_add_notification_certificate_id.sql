-- ====================================================
-- Add certificate_id to notifications
-- ====================================================

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_certificate_id
  ON notifications(certificate_id);

