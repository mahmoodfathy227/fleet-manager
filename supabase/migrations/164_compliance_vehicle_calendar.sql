-- =====================================================
-- Compliance → Vehicles → Calendar: tolerance config + spare assignments
-- =====================================================

-- 1. Document expiry tolerance (global default + per doc type override)
CREATE TABLE IF NOT EXISTS public.document_expiry_tolerance (
  id SERIAL PRIMARY KEY,
  document_type_key TEXT NULL UNIQUE,  -- NULL = global default; e.g. 'insurance_expiry_date', 'mot_date'
  tolerance_days INTEGER NOT NULL DEFAULT 14,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.document_expiry_tolerance IS 'Days before expiry to treat as "expiring soon". document_type_key NULL = default for all types.';

INSERT INTO public.document_expiry_tolerance (document_type_key, tolerance_days)
VALUES (NULL, 14)
ON CONFLICT (document_type_key) DO NOTHING;

-- 2. Vehicle compliance spare assignment (audit + undo)
CREATE TABLE IF NOT EXISTS public.vehicle_compliance_spare_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id INTEGER NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  spare_vehicle_id INTEGER NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  document_id INTEGER NULL REFERENCES public.documents(id) ON DELETE SET NULL,
  reason TEXT NULL,
  assigned_by UUID NOT NULL DEFAULT auth.uid(),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reverted_at TIMESTAMPTZ NULL,
  reverted_by UUID NULL REFERENCES auth.users(id)
);

COMMENT ON TABLE public.vehicle_compliance_spare_assignments IS 'Spare vehicle assigned to cover for a vehicle with expiring document; supports revert.';

CREATE INDEX IF NOT EXISTS idx_vehicle_compliance_spare_vehicle ON public.vehicle_compliance_spare_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_compliance_spare_assigned_at ON public.vehicle_compliance_spare_assignments(assigned_at);

ALTER TABLE public.document_expiry_tolerance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_compliance_spare_assignments ENABLE ROW LEVEL SECURITY;

-- RLS: read for anyone with vehicle_documents.read or compliance.read; write for vehicle_compliance.write or admin
DROP POLICY IF EXISTS "compliance_tolerance_select" ON public.document_expiry_tolerance;
CREATE POLICY "compliance_tolerance_select" ON public.document_expiry_tolerance
  FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicle_documents.read', 'compliance.read', 'vehicle_compliance.write']));

DROP POLICY IF EXISTS "compliance_tolerance_update" ON public.document_expiry_tolerance;
CREATE POLICY "compliance_tolerance_update" ON public.document_expiry_tolerance
  FOR UPDATE TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicle_compliance.write', 'compliance.write']))
  WITH CHECK (auth_has_any_permission(ARRAY['vehicle_compliance.write', 'compliance.write']));

DROP POLICY IF EXISTS "compliance_tolerance_insert" ON public.document_expiry_tolerance;
CREATE POLICY "compliance_tolerance_insert" ON public.document_expiry_tolerance
  FOR INSERT TO authenticated
  WITH CHECK (auth_has_any_permission(ARRAY['vehicle_compliance.write', 'compliance.write']));

DROP POLICY IF EXISTS "compliance_spare_select" ON public.vehicle_compliance_spare_assignments;
CREATE POLICY "compliance_spare_select" ON public.vehicle_compliance_spare_assignments
  FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicle_documents.read', 'compliance.read', 'vehicle_compliance.write']));

DROP POLICY IF EXISTS "compliance_spare_insert" ON public.vehicle_compliance_spare_assignments;
CREATE POLICY "compliance_spare_insert" ON public.vehicle_compliance_spare_assignments
  FOR INSERT TO authenticated
  WITH CHECK (auth_has_any_permission(ARRAY['vehicle_compliance.write', 'routes.spares.set']));

DROP POLICY IF EXISTS "compliance_spare_update" ON public.vehicle_compliance_spare_assignments;
CREATE POLICY "compliance_spare_update" ON public.vehicle_compliance_spare_assignments
  FOR UPDATE TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicle_compliance.write', 'routes.spares.set', 'routes.spares.clear']))
  WITH CHECK (auth_has_any_permission(ARRAY['vehicle_compliance.write', 'routes.spares.set', 'routes.spares.clear']));
