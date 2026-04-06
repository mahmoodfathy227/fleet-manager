-- =====================================================================
-- Migration 174: vehicles_realtime — add vehicle_db_id, REPLICA IDENTITY
--                FULL, and proper RLS policies for mobile tracking.
-- =====================================================================

-- 1. Add vehicle_db_id so we can join to vehicles and enforce RLS.
ALTER TABLE public.vehicles_realtime
  ADD COLUMN IF NOT EXISTS vehicle_db_id INTEGER REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_realtime_vehicle_db_id
  ON public.vehicles_realtime(vehicle_db_id);

-- 2. Backfill vehicle_db_id from the samsara_vehicle_id on the vehicles table.
UPDATE public.vehicles_realtime vr
SET vehicle_db_id = v.id
FROM public.vehicles v
WHERE v.samsara_vehicle_id = vr.id
  AND vr.vehicle_db_id IS NULL;

-- 3. REPLICA IDENTITY FULL — required so Realtime broadcasts all column
--    values (not just PK) on UPDATE events to Flutter subscribers.
ALTER TABLE public.vehicles_realtime REPLICA IDENTITY FULL;

-- 4. Drop the previous over-permissive policies (created by dev).
DROP POLICY IF EXISTS "Allow anon upsert vehicles_realtime"          ON public.vehicles_realtime;
DROP POLICY IF EXISTS "Allow authenticated upsert vehicles_realtime" ON public.vehicles_realtime;

-- 5. Enable RLS.
ALTER TABLE public.vehicles_realtime ENABLE ROW LEVEL SECURITY;

-- 6. POLICY: Drivers and PAs can SELECT the row for their active trip's vehicle.
--    driver_id / passenger_assistant_id on route_sessions are employee integers;
--    we join through employees to reach the auth UUID.
CREATE POLICY "driver_pa_can_read_own_vehicle"
  ON public.vehicles_realtime
  FOR SELECT
  USING (
    vehicle_db_id IN (
      SELECT r.vehicle_id
      FROM   public.routes r
      JOIN   public.route_sessions rs ON rs.route_id = r.id
      JOIN   public.employees e
             ON (e.id = rs.driver_id OR e.id = rs.passenger_assistant_id)
      WHERE  rs.ended_at IS NULL
        AND  r.vehicle_id IS NOT NULL
        AND  e.user_id = auth.uid()
    )
  );

-- 7. POLICY: A parent can SELECT the row for any vehicle that is carrying
--    one of their children on an active (not yet ended) route session.
--    route_points.passenger_id links a stop to a passenger;
--    passenger_parent_contacts links passenger to parent_contacts;
--    parent_contacts.user_id links to auth.
CREATE POLICY "parent_can_read_child_vehicle"
  ON public.vehicles_realtime
  FOR SELECT
  USING (
    vehicle_db_id IN (
      SELECT r.vehicle_id
      FROM   public.routes r
      JOIN   public.route_sessions    rs  ON rs.route_id  = r.id
      JOIN   public.route_points      rp  ON rp.route_id  = r.id
      JOIN   public.passenger_parent_contacts ppc ON ppc.passenger_id = rp.passenger_id
      JOIN   public.parent_contacts   pc  ON pc.id = ppc.parent_contact_id
      WHERE  rs.ended_at IS NULL
        AND  r.vehicle_id IS NOT NULL
        AND  pc.user_id = auth.uid()
    )
  );

-- 8. POLICY: Dashboard users (any user_roles entry, active = true) can
--    read all rows for the admin live-map.
CREATE POLICY "admin_can_read_all_vehicles_realtime"
  ON public.vehicles_realtime
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      WHERE  ur.user_id = auth.uid()
        AND  ur.active  = TRUE
    )
  );

-- NOTE: INSERT / UPDATE / DELETE on vehicles_realtime is intentionally
-- restricted to the service-role key (used by the samsara-location-webhook
-- Edge Function). No authenticated-user policy for writes is needed.
