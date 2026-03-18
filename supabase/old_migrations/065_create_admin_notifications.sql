-- ====================================================
-- ADMIN NOTIFICATIONS
-- ====================================================
-- Notifications for admins when employees respond to emails
-- (document uploads, appointment bookings, etc.)
-- ====================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id SERIAL PRIMARY KEY,
  notification_type VARCHAR NOT NULL, -- 'document_uploaded', 'appointment_booked', 'form_submitted'
  related_notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL, -- Link to original compliance notification
  related_activity_id INTEGER REFERENCES system_activities(id) ON DELETE SET NULL, -- Link to system activity
  entity_type VARCHAR NOT NULL, -- 'vehicle', 'driver', 'assistant'
  entity_id INTEGER NOT NULL,
  entity_name VARCHAR,
  certificate_name VARCHAR,
  recipient_name VARCHAR,
  recipient_email VARCHAR,
  message TEXT, -- Custom message for the admin
  details JSONB, -- Additional details (file names, appointment date, etc.)
  status VARCHAR DEFAULT 'unread', -- 'unread', 'read', 'dismissed'
  read_at TIMESTAMP,
  read_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Which admin read it
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_entity ON admin_notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_related_notification ON admin_notifications(related_notification_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only authenticated users (admins) can see admin notifications
CREATE POLICY "Allow authenticated users to read admin_notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert admin_notifications"
  ON admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update admin_notifications"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete admin_notifications"
  ON admin_notifications FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE admin_notifications IS 'Notifications for admins when employees respond to compliance emails (document uploads, appointments, etc.)';
COMMENT ON COLUMN admin_notifications.notification_type IS 'Type: document_uploaded, appointment_booked, form_submitted';
COMMENT ON COLUMN admin_notifications.status IS 'unread, read, or dismissed';
COMMENT ON COLUMN admin_notifications.details IS 'JSON object with activity-specific details';

