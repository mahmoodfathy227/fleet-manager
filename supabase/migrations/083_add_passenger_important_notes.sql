-- ====================================================
-- Add Important Notes Field to Passengers Table
-- ====================================================
-- This migration adds an important_notes field to the passengers table
-- for storing flagged information about passengers that should be visible
-- ====================================================

-- Add important_notes column (nullable TEXT field)
ALTER TABLE passengers 
ADD COLUMN IF NOT EXISTS important_notes TEXT;

-- Add helpful comment
COMMENT ON COLUMN passengers.important_notes IS 'Important flagged notes about the passenger that should be prominently displayed';

