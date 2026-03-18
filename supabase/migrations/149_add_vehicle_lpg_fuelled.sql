-- ====================================================
-- Add lpg_fuelled to vehicles for LPG safety check documents
-- ====================================================

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS lpg_fuelled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN vehicles.lpg_fuelled IS 'If true, vehicle is LPG fuelled and LPG safety check documents apply';
