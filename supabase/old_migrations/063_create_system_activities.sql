-- ====================================================
-- SYSTEM ACTIVITIES
-- ====================================================
-- Tracks system events like document uploads and appointment bookings
-- for admin visibility in the dashboard

CREATE TABLE IF NOT EXISTS system_activities (
  id SERIAL PRIMARY KEY,
  activity_type VARCHAR NOT NULL, -- 'document_upload', 'appointment_booking'
  notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  entity_type VARCHAR NOT NULL, -- 'vehicle', 'driver', 'assistant'
  entity_id INTEGER NOT NULL,
  entity_name VARCHAR,
  certificate_name VARCHAR,
  recipient_name VARCHAR,
  recipient_email VARCHAR,
  details JSONB, -- Flexible JSON for activity-specific data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  viewed_by_admins BOOLEAN DEFAULT FALSE,
  viewed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_activities_type ON system_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_system_activities_entity ON system_activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_activities_created ON system_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_activities_notification ON system_activities(notification_id);

-- Enable Row Level Security
ALTER TABLE system_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only authenticated users (admins) can see system activities
CREATE POLICY "Allow authenticated users to read system_activities"
  ON system_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert system_activities"
  ON system_activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update system_activities"
  ON system_activities FOR UPDATE
  TO authenticated
  USING (true);

COMMENT ON TABLE system_activities IS 'Tracks system events (document uploads, appointment bookings) for admin dashboard visibility';
COMMENT ON COLUMN system_activities.activity_type IS 'Type of activity: document_upload, appointment_booking';
COMMENT ON COLUMN system_activities.details IS 'JSON object containing activity-specific details (file names, appointment slot, etc.)';

