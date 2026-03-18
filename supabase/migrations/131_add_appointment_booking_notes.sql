-- Add notes to appointment_bookings: context from the sent appointment link (e.g. certificate, entity).
ALTER TABLE appointment_bookings ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN appointment_bookings.notes IS 'Context from the appointment link when driver/recipient booked (e.g. certificate name, entity).';
