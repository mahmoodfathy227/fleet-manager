-- ====================================================
-- Add M2 vehicle category (passenger vehicle, more than 8 seats)
-- ====================================================

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_category_check;

ALTER TABLE public.vehicles
ADD CONSTRAINT vehicles_vehicle_category_check
CHECK (
  vehicle_category IS NULL
  OR vehicle_category IN ('M1', 'M2', 'N1', 'Hackney_Carriage')
);

COMMENT ON COLUMN public.vehicles.vehicle_category IS
  'M1 light passenger, M2 passenger >8 seats, N1 goods, Hackney_Carriage Hackney/taxi';
