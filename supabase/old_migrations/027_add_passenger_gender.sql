-- Add gender field to passengers
ALTER TABLE passengers
ADD COLUMN IF NOT EXISTS gender VARCHAR;

COMMENT ON COLUMN passengers.gender IS 'Gender of the passenger (e.g., Male, Female, Other, Prefer not to say)';

