-- Add DBS number field to drivers table
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS dbs_number VARCHAR;

COMMENT ON COLUMN drivers.dbs_number IS 'DBS certificate number';

