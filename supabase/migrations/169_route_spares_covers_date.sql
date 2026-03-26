-- Date-scoped spare assignments (operations calendar): one active spare per route+type+date,
-- while keeping at most one open-ended (covers_date NULL) spare per route+type.

ALTER TABLE public.route_spares
  ADD COLUMN IF NOT EXISTS covers_date DATE;

COMMENT ON COLUMN public.route_spares.covers_date IS
  'Operational calendar date this spare applies to (calendar assignment). NULL = open-ended until cleared.';

-- Old trigger deactivated every other active spare on the route — incompatible with multiple dated rows.
DROP TRIGGER IF EXISTS trigger_route_spares_deactivate_others ON public.route_spares;
DROP FUNCTION IF EXISTS public.route_spares_deactivate_others();

DROP INDEX IF EXISTS idx_route_spares_one_active_per_type;

-- One open-ended active spare per route + spare_type
CREATE UNIQUE INDEX IF NOT EXISTS route_spares_one_open_active_per_route_type
  ON public.route_spares (route_id, spare_type)
  WHERE is_active = true AND covers_date IS NULL;

-- One active spare per route + spare_type + calendar date (when date-scoped)
CREATE UNIQUE INDEX IF NOT EXISTS route_spares_one_active_per_route_type_date
  ON public.route_spares (route_id, spare_type, covers_date)
  WHERE is_active = true AND covers_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_route_spares(p_route_id INTEGER)
RETURNS TABLE (
  id UUID,
  spare_type TEXT,
  driver_employee_id INTEGER,
  pa_employee_id INTEGER,
  vehicle_id INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  reason TEXT,
  is_active BOOLEAN,
  is_effectively_active BOOLEAN,
  covers_date DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rs.id,
    rs.spare_type,
    rs.driver_employee_id,
    rs.pa_employee_id,
    rs.vehicle_id,
    rs.starts_at,
    rs.ends_at,
    rs.reason,
    rs.is_active,
    (
      rs.is_active
      AND (rs.ends_at IS NULL OR rs.ends_at > now())
      AND (rs.starts_at IS NULL OR rs.starts_at <= now())
      AND (
        rs.covers_date IS NULL
        OR rs.covers_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date
      )
    ) AS is_effectively_active,
    rs.covers_date,
    rs.created_at,
    rs.updated_at
  FROM public.route_spares rs
  WHERE rs.route_id = p_route_id
  ORDER BY rs.spare_type, rs.covers_date DESC NULLS LAST, rs.starts_at DESC;
$$;

COMMENT ON FUNCTION public.get_route_spares IS
  'Spares for a route. is_effectively_active respects time window and covers_date (London calendar day) when set.';
