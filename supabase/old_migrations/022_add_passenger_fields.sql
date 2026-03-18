-- ====================================================
-- Add Personal Item and Supervision Type to Passengers
-- ====================================================
-- This migration adds personal_item and supervision_type columns
-- to the passengers table
-- ====================================================

-- Add personal_item column (nullable)
ALTER TABLE passengers 
ADD COLUMN IF NOT EXISTS personal_item TEXT;

-- Add supervision_type column (text)
ALTER TABLE passengers 
ADD COLUMN IF NOT EXISTS supervision_type TEXT;

-- Add helpful comments
COMMENT ON COLUMN passengers.personal_item IS 'Personal items carried by the passenger (nullable)';
COMMENT ON COLUMN passengers.supervision_type IS 'Type of supervision required for the passenger';

