-- ====================================================
-- Update Call Logs Table
-- ====================================================
-- Add support for:
-- 1. Related driver (references drivers.employee_id)
-- 2. Related assistant/PA (references passenger_assistants.employee_id)
-- 3. Call to type (Staff, Parent, Admin) - specifies who the call is to/from
-- ====================================================

-- Add related_driver_id column
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS related_driver_id INTEGER REFERENCES drivers(employee_id) ON DELETE SET NULL;

-- Add related_assistant_id column
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS related_assistant_id INTEGER REFERENCES passenger_assistants(employee_id) ON DELETE SET NULL;

-- Add call_to_type column to specify who the call is to/from
-- This replaces/enhances the caller_type field
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS call_to_type VARCHAR; -- Staff, Parent, Admin

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_call_logs_driver ON call_logs(related_driver_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_assistant ON call_logs(related_assistant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_to_type ON call_logs(call_to_type);

-- Add comments
COMMENT ON COLUMN call_logs.related_driver_id IS 'Related driver for this call log (references drivers.employee_id)';
COMMENT ON COLUMN call_logs.related_assistant_id IS 'Related passenger assistant for this call log (references passenger_assistants.employee_id)';
COMMENT ON COLUMN call_logs.call_to_type IS 'Who the call is to/from: Staff, Parent, or Admin';

-- Note: related_employee_id is kept for backward compatibility but can be used for other employee types
-- related_driver_id and related_assistant_id are more specific and preferred

