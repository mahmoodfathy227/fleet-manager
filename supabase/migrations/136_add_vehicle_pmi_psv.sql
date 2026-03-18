-- Add PSV (Public Service Vehicle) PMI (Periodic Maintenance Inspection) fields
-- pmi_weeks = interval in weeks between each interim check; next due = last_pmi_date + pmi_weeks
-- ====================================================

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS pmi_weeks INTEGER,
ADD COLUMN IF NOT EXISTS last_pmi_date DATE;

CREATE INDEX IF NOT EXISTS idx_vehicles_last_pmi_date ON vehicles(last_pmi_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type ON vehicles(vehicle_type);

COMMENT ON COLUMN vehicles.pmi_weeks IS 'PSV only: weeks between each PMI interim check';
COMMENT ON COLUMN vehicles.last_pmi_date IS 'PSV only: date of last PMI interim check; next due = last_pmi_date + pmi_weeks';
