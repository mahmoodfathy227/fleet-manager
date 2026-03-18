-- Add DBS number field to passenger_assistants table
ALTER TABLE passenger_assistants
ADD COLUMN IF NOT EXISTS dbs_number VARCHAR;

COMMENT ON COLUMN passenger_assistants.dbs_number IS 'DBS certificate number';

