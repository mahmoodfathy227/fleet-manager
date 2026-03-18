-- ====================================================
-- Add assigned_to field to vehicles table
-- This field represents the driver assigned to follow up on MOTs and services
-- ====================================================

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_to ON vehicles(assigned_to);

COMMENT ON COLUMN vehicles.assigned_to IS 'Driver assigned to follow up on MOTs and services for this vehicle';

