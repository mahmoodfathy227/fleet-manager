-- Optional fields when admins create a slot: intended crew + booking context (shown until a real booking exists).

ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS planned_booking_context TEXT,
  ADD COLUMN IF NOT EXISTS assigned_employee_id INTEGER REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appointment_slots.planned_booking_context IS 'Optional context set at slot creation (e.g. certificate topic); superseded by appointment_bookings.notes once booked.';
COMMENT ON COLUMN public.appointment_slots.assigned_employee_id IS 'Optional intended crew member for this slot; display until someone books via link.';
