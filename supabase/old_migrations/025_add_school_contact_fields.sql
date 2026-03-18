-- Add school contact fields
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS phone_number VARCHAR,
ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
ADD COLUMN IF NOT EXISTS contact_email VARCHAR;

COMMENT ON COLUMN schools.phone_number IS 'Main school phone number';
COMMENT ON COLUMN schools.contact_name IS 'Name of the school contact person';
COMMENT ON COLUMN schools.contact_phone IS 'Direct phone number for the school contact';
COMMENT ON COLUMN schools.contact_email IS 'Email address for the school contact';

