-- ====================================================
-- ADD EMPLOYEE RESPONSE TRACKING TO NOTIFICATIONS
-- ====================================================
-- Track when employees respond to notifications (upload documents, book appointments)
-- ====================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS employee_response_type VARCHAR, -- 'document_uploaded', 'appointment_booked', null if no response
  ADD COLUMN IF NOT EXISTS employee_response_details JSONB, -- Details about the response (file names, appointment date, etc.)
  ADD COLUMN IF NOT EXISTS employee_response_received_at TIMESTAMP, -- When the employee responded
  ADD COLUMN IF NOT EXISTS admin_response_required BOOLEAN DEFAULT FALSE, -- Flag to indicate admin needs to review/approve
  ADD COLUMN IF NOT EXISTS admin_response_notes TEXT; -- Admin notes about the response

-- Create index for filtering notifications that need admin response
CREATE INDEX IF NOT EXISTS idx_notifications_admin_response_required ON notifications(admin_response_required) WHERE admin_response_required = TRUE;
CREATE INDEX IF NOT EXISTS idx_notifications_employee_response ON notifications(employee_response_type) WHERE employee_response_type IS NOT NULL;

COMMENT ON COLUMN notifications.employee_response_type IS 'Type of employee response: document_uploaded, appointment_booked, or null if no response yet';
COMMENT ON COLUMN notifications.employee_response_details IS 'JSON details about the response (file names, appointment date/time, etc.)';
COMMENT ON COLUMN notifications.employee_response_received_at IS 'Timestamp when employee responded';
COMMENT ON COLUMN notifications.admin_response_required IS 'Flag indicating admin needs to review and resolve this notification';
COMMENT ON COLUMN notifications.admin_response_notes IS 'Admin notes about reviewing the employee response';

