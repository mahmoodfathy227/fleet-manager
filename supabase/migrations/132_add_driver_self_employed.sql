-- Add self_employed (yes/no) to driver profile.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS self_employed BOOLEAN DEFAULT false;
COMMENT ON COLUMN drivers.self_employed IS 'Whether the driver is self-employed (yes/no).';
