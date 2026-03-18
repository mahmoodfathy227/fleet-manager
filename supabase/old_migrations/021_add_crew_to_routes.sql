-- ====================================================
-- Add Driver and Passenger Assistant to Routes
-- ====================================================
-- This migration adds driver_id and passenger_assistant_id columns
-- directly to the routes table, eliminating the need for a separate crew table
-- ====================================================

-- Add driver_id column to routes table
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES drivers(employee_id) ON DELETE SET NULL;

-- Add passenger_assistant_id column to routes table
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS passenger_assistant_id INTEGER REFERENCES passenger_assistants(employee_id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_routes_driver ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_passenger_assistant ON routes(passenger_assistant_id);

-- Migrate existing crew assignments to routes table
-- This will populate driver_id and passenger_assistant_id from the crew table
UPDATE routes r
SET 
  driver_id = c.driver_id,
  passenger_assistant_id = c.pa_id
FROM crew c
WHERE c.route_id = r.id
AND (r.driver_id IS NULL OR r.passenger_assistant_id IS NULL);

-- Add helpful comments
COMMENT ON COLUMN routes.driver_id IS 'Assigned driver for this route';
COMMENT ON COLUMN routes.passenger_assistant_id IS 'Assigned passenger assistant for this route';

