-- ====================================================
-- Add acknowledged_at column and update status handling
-- Tracks when parent cancellations are acknowledged
-- ====================================================

-- Add acknowledged_at column to parent_absence_reports table (if not exists)
ALTER TABLE parent_absence_reports 
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITHOUT TIME ZONE;

-- Create index for performance (to filter unacknowledged reports)
CREATE INDEX IF NOT EXISTS idx_parent_absence_reports_acknowledged_at ON parent_absence_reports(acknowledged_at);

-- Update status column constraint to allow 'acknowledged' value
-- First, drop existing constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'parent_absence_reports_status_check'
  ) THEN
    ALTER TABLE parent_absence_reports DROP CONSTRAINT parent_absence_reports_status_check;
  END IF;
END $$;

-- Add new constraint allowing 'new', 'acknowledged', and potentially other statuses
ALTER TABLE parent_absence_reports 
ADD CONSTRAINT parent_absence_reports_status_check 
CHECK (status IN ('new', 'acknowledged', 'resolved', 'cancelled'));

-- Add helpful comments
COMMENT ON COLUMN parent_absence_reports.acknowledged_at IS 'Timestamp when the parent cancellation was acknowledged by staff';
COMMENT ON COLUMN parent_absence_reports.status IS 'Status of the absence report: new (default), acknowledged, resolved, or cancelled';
