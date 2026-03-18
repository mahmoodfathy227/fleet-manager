-- ====================================================
-- Add acknowledged_by column to parent_absence_reports table
-- Tracks which user acknowledged the parent cancellation
-- ====================================================

-- Add acknowledged_by column to parent_absence_reports table (if not exists)
ALTER TABLE parent_absence_reports 
ADD COLUMN IF NOT EXISTS acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_parent_absence_reports_acknowledged_by ON parent_absence_reports(acknowledged_by);

-- Add helpful comment
COMMENT ON COLUMN parent_absence_reports.acknowledged_by IS 'ID of the user who acknowledged this parent cancellation';
