-- ====================================================
-- Vehicle category: store Hackney Carriage as Hackney_Carriage; migrate Jackeny typo
-- ====================================================

-- Drop any existing CHECK on vehicles.vehicle_category (name varies by Postgres version)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'vehicles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%vehicle_category%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE public.vehicles
SET vehicle_category = 'Hackney_Carriage'
WHERE vehicle_category = 'Jackeny';

ALTER TABLE public.vehicles
ADD CONSTRAINT vehicles_vehicle_category_check
CHECK (
  vehicle_category IS NULL
  OR vehicle_category IN ('M1', 'N1', 'Hackney_Carriage')
);

COMMENT ON COLUMN public.vehicles.vehicle_category IS
  'M1 passenger, N1 goods, Hackney_Carriage = licensed Hackney carriage / taxi category';
