-- =====================================================
-- Route Spares: spare driver, spare PA, spare vehicle per route
-- Time-bound, one active per type per route. Permission-gated.
-- =====================================================

-- =====================================================
-- 1. TABLE route_spares
-- =====================================================

CREATE TABLE IF NOT EXISTS public.route_spares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id INTEGER NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  spare_type TEXT NOT NULL CHECK (spare_type IN ('driver', 'pa', 'vehicle')),
  driver_employee_id INTEGER NULL REFERENCES public.drivers(employee_id) ON DELETE SET NULL,
  pa_employee_id INTEGER NULL REFERENCES public.passenger_assistants(employee_id) ON DELETE SET NULL,
  vehicle_id INTEGER NULL REFERENCES public.vehicles(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NULL,
  reason TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  updated_by UUID NOT NULL DEFAULT auth.uid(),
  CONSTRAINT route_spares_entity_check CHECK (
    (spare_type = 'driver' AND driver_employee_id IS NOT NULL AND pa_employee_id IS NULL AND vehicle_id IS NULL)
    OR (spare_type = 'pa' AND pa_employee_id IS NOT NULL AND driver_employee_id IS NULL AND vehicle_id IS NULL)
    OR (spare_type = 'vehicle' AND vehicle_id IS NOT NULL AND driver_employee_id IS NULL AND pa_employee_id IS NULL)
  )
);

COMMENT ON TABLE public.route_spares IS 'Route-specific spare driver, PA, or vehicle assignments with optional end time.';
COMMENT ON COLUMN public.route_spares.ends_at IS 'If null, spare is "until cleared".';
COMMENT ON COLUMN public.route_spares.is_active IS 'False when cleared; only one active spare per route per spare_type.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_route_spares_route_id ON public.route_spares(route_id);
CREATE INDEX IF NOT EXISTS idx_route_spares_route_type_active ON public.route_spares(route_id, spare_type) WHERE is_active = true;

-- Only one active spare per route per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_route_spares_one_active_per_type
  ON public.route_spares (route_id, spare_type)
  WHERE is_active = true;

-- =====================================================
-- 2. TRIGGER: deactivate other spares when setting new one
-- =====================================================

CREATE OR REPLACE FUNCTION public.route_spares_deactivate_others()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.route_spares
    SET is_active = false,
        ends_at = now(),
        updated_by = auth.uid(),
        updated_at = now()
    WHERE route_id = NEW.route_id
      AND spare_type = NEW.spare_type
      AND id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_route_spares_deactivate_others ON public.route_spares;
CREATE TRIGGER trigger_route_spares_deactivate_others
  BEFORE INSERT OR UPDATE OF is_active ON public.route_spares
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.route_spares_deactivate_others();

-- =====================================================
-- 3. TRIGGER: updated_at / updated_by
-- =====================================================

CREATE OR REPLACE FUNCTION public.route_spares_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_route_spares_audit ON public.route_spares;
CREATE TRIGGER trigger_route_spares_audit
  BEFORE UPDATE ON public.route_spares
  FOR EACH ROW
  EXECUTE FUNCTION public.route_spares_audit();

-- =====================================================
-- 4. RPC: get_route_spares (with is_effectively_active)
-- =====================================================

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
    (rs.is_active AND (rs.ends_at IS NULL OR rs.ends_at > now())) AS is_effectively_active,
    rs.created_at,
    rs.updated_at
  FROM public.route_spares rs
  WHERE rs.route_id = p_route_id
  ORDER BY rs.spare_type, rs.starts_at DESC;
$$;

COMMENT ON FUNCTION public.get_route_spares IS 'Returns spare assignments for a route; is_effectively_active = is_active AND (ends_at IS NULL OR ends_at > now()).';

-- =====================================================
-- 5. PERMISSIONS (idempotent)
-- =====================================================

INSERT INTO public.permissions (key, description) VALUES
  ('routes.spares.view', 'View route spare driver/PA/vehicle assignments'),
  ('routes.spares.set', 'Set spare driver, PA, or vehicle on a route'),
  ('routes.spares.clear', 'Clear (deactivate) route spare assignments')
ON CONFLICT (key) DO UPDATE SET description = excluded.description;

-- Map to Operations Administrator, Full System Administrator, and Super Admin if exists
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.key IN ('routes.spares.view', 'routes.spares.set', 'routes.spares.clear')
  AND r.name IN ('Operations Administrator', 'Full System Administrator', 'Super Admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- 6. RLS
-- =====================================================

ALTER TABLE public.route_spares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_spares_select" ON public.route_spares;
CREATE POLICY "route_spares_select" ON public.route_spares
  FOR SELECT TO authenticated
  USING (auth_has_permission('routes.spares.view'));

DROP POLICY IF EXISTS "route_spares_insert" ON public.route_spares;
CREATE POLICY "route_spares_insert" ON public.route_spares
  FOR INSERT TO authenticated
  WITH CHECK (auth_has_permission('routes.spares.set'));

DROP POLICY IF EXISTS "route_spares_update" ON public.route_spares;
CREATE POLICY "route_spares_update" ON public.route_spares
  FOR UPDATE TO authenticated
  USING (auth_has_permission('routes.spares.set') OR auth_has_permission('routes.spares.clear'))
  WITH CHECK (auth_has_permission('routes.spares.set') OR auth_has_permission('routes.spares.clear'));

-- No DELETE policy: "clear" is done via UPDATE (is_active = false, ends_at = now())
DROP POLICY IF EXISTS "route_spares_delete" ON public.route_spares;
CREATE POLICY "route_spares_delete" ON public.route_spares
  FOR DELETE TO authenticated
  USING (auth_has_permission('routes.spares.clear'));
