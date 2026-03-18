-- Add spare_driver to drivers and spare_pa to passenger_assistants
-- for clarity when assigning spares to routes/sessions.

ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS spare_driver BOOLEAN DEFAULT FALSE;

ALTER TABLE passenger_assistants
ADD COLUMN IF NOT EXISTS spare_pa BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN drivers.spare_driver IS 'When true, driver is available as a spare (not assigned to a route).';
COMMENT ON COLUMN passenger_assistants.spare_pa IS 'When true, PA is available as a spare (not assigned to a route).';

CREATE INDEX IF NOT EXISTS idx_drivers_spare_driver ON drivers(spare_driver) WHERE spare_driver = TRUE;
CREATE INDEX IF NOT EXISTS idx_passenger_assistants_spare_pa ON passenger_assistants(spare_pa) WHERE spare_pa = TRUE;
