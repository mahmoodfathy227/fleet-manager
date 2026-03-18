-- Add on-hold flags for entities and appointment booking support
-- Requires pgcrypto for UUID/token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ================================
-- On-hold columns
-- ================================

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS on_hold BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS on_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS on_hold_notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_hold_set_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_hold_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS on_hold_cleared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_drivers_on_hold ON drivers(on_hold);

ALTER TABLE passenger_assistants
  ADD COLUMN IF NOT EXISTS on_hold BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS on_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS on_hold_notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_hold_set_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_hold_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS on_hold_cleared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_passenger_assistants_on_hold ON passenger_assistants(on_hold);

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS on_hold BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS on_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS on_hold_notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_hold_set_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_hold_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS on_hold_cleared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vehicles_on_hold ON vehicles(on_hold);

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS on_hold BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS on_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS on_hold_notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_hold_set_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_hold_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS on_hold_cleared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_routes_on_hold ON routes(on_hold);

-- ================================
-- Appointments
-- ================================

CREATE TABLE IF NOT EXISTS appointment_slots (
  id BIGSERIAL PRIMARY KEY,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_start ON appointment_slots(slot_start);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_end ON appointment_slots(slot_end);

CREATE TABLE IF NOT EXISTS appointment_bookings (
  id BIGSERIAL PRIMARY KEY,
  appointment_slot_id BIGINT REFERENCES appointment_slots(id) ON DELETE CASCADE,
  notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,
  booked_by_email TEXT,
  booked_by_name TEXT,
  status VARCHAR(32) DEFAULT 'booked',
  token UUID DEFAULT gen_random_uuid(),
  booked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_bookings_slot_unique ON appointment_bookings(appointment_slot_id);
CREATE INDEX IF NOT EXISTS idx_appointment_bookings_notification ON appointment_bookings(notification_id);

COMMENT ON TABLE appointment_slots IS 'Admin-created available appointment slots (date/time)';
COMMENT ON TABLE appointment_bookings IS 'Recipient-selected appointment bookings linked to notifications';

-- Enable RLS
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_bookings ENABLE ROW LEVEL SECURITY;

-- Drop then create (CREATE POLICY has no IF NOT EXISTS)
DROP POLICY IF EXISTS "Allow authenticated read appointment slots" ON appointment_slots;
DROP POLICY IF EXISTS "Allow public read appointment slots" ON appointment_slots;
DROP POLICY IF EXISTS "Allow authenticated insert appointment slots" ON appointment_slots;
DROP POLICY IF EXISTS "Allow authenticated update appointment slots" ON appointment_slots;
DROP POLICY IF EXISTS "Allow authenticated delete appointment slots" ON appointment_slots;

DROP POLICY IF EXISTS "Allow authenticated read bookings" ON appointment_bookings;
DROP POLICY IF EXISTS "Allow public read bookings" ON appointment_bookings;
DROP POLICY IF EXISTS "Allow authenticated insert bookings" ON appointment_bookings;
DROP POLICY IF EXISTS "Allow public insert bookings" ON appointment_bookings;
DROP POLICY IF EXISTS "Allow authenticated update bookings" ON appointment_bookings;
DROP POLICY IF EXISTS "Allow authenticated delete bookings" ON appointment_bookings;

CREATE POLICY "Allow authenticated read appointment slots"
  ON appointment_slots FOR SELECT
  TO authenticated
  USING (true);

-- Allow public read of slots (for booking page) - slots are non-sensitive
CREATE POLICY "Allow public read appointment slots"
  ON appointment_slots FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated insert appointment slots"
  ON appointment_slots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update appointment slots"
  ON appointment_slots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete appointment slots"
  ON appointment_slots FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read bookings"
  ON appointment_bookings FOR SELECT
  TO authenticated
  USING (true);

-- Allow public read of a booking when holding the token (validated in app layer)
CREATE POLICY "Allow public read bookings"
  ON appointment_bookings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated insert bookings"
  ON appointment_bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow public insert bookings (booking uses notification token validation in API)
CREATE POLICY "Allow public insert bookings"
  ON appointment_bookings FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update bookings"
  ON appointment_bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete bookings"
  ON appointment_bookings FOR DELETE
  TO authenticated
  USING (true);

