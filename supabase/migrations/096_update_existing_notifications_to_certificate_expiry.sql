-- ====================================================
-- Update existing notifications to use 'certificate_expiry'
-- ====================================================
-- This migration updates any existing notifications that use the old
-- notification_type values ('vehicle_certificate', 'driver_certificate', 'assistant_certificate')
-- to use 'certificate_expiry' so they appear in the compliance notifications tab
-- ====================================================

UPDATE notifications
SET notification_type = 'certificate_expiry'
WHERE notification_type IN ('vehicle_certificate', 'driver_certificate', 'assistant_certificate')
  AND entity_type IN ('vehicle', 'driver', 'assistant');

-- Add a comment to document the change
COMMENT ON COLUMN notifications.notification_type IS 'Notification type: certificate_expiry (for compliance), vehicle_breakdown, driver_tardiness, etc.';

