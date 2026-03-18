-- Add ref_number column to schools table
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS ref_number VARCHAR;

COMMENT ON COLUMN schools.ref_number IS 'Reference number for the school';

