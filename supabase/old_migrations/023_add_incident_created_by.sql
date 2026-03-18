-- ====================================================
-- Add created_by field to incidents table
-- ====================================================
-- This migration adds created_by column to track which user created each incident
-- ====================================================

-- Add created_by column to incidents table
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_incidents_created_by ON incidents(created_by);

-- Add helpful comment
COMMENT ON COLUMN incidents.created_by IS 'User ID of the person who created this incident';

