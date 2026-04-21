-- Ensure PostgREST can resolve appointment_slots → employees when embedding is used.
-- Safe if 185 already created the same constraint (name matches PostgreSQL default).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointment_slots'
      AND column_name = 'assigned_employee_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    INNER JOIN pg_class t ON c.conrelid = t.oid
    INNER JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'appointment_slots'
      AND c.contype = 'f'
      AND c.conname = 'appointment_slots_assigned_employee_id_fkey'
  ) THEN
    ALTER TABLE public.appointment_slots
      ADD CONSTRAINT appointment_slots_assigned_employee_id_fkey
      FOREIGN KEY (assigned_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;
END $$;
