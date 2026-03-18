-- =====================================================
-- Maintenance Questions: permissions + role mapping
-- =====================================================
-- Assumes table public.maintenance_checks_question exists.
-- Add RLS policies on that table using auth_has_permission('maintenance_questions.*') as needed.
-- =====================================================

INSERT INTO public.permissions (key, description) VALUES
  ('maintenance_questions.view', 'View maintenance check questions'),
  ('maintenance_questions.create', 'Create maintenance check questions'),
  ('maintenance_questions.update', 'Update maintenance check questions'),
  ('maintenance_questions.delete', 'Delete maintenance check questions')
ON CONFLICT (key) DO UPDATE SET description = excluded.description;

-- Map to admin roles (same pattern as notifications)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Operations Administrator', 'Full System Administrator', 'Super Admin')
  AND p.key IN ('maintenance_questions.view', 'maintenance_questions.create', 'maintenance_questions.update', 'maintenance_questions.delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- RLS on maintenance_checks_question (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'maintenance_checks_question') THEN
    ALTER TABLE public.maintenance_checks_question ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "maintenance_questions_select" ON public.maintenance_checks_question;
    CREATE POLICY "maintenance_questions_select" ON public.maintenance_checks_question
      FOR SELECT TO authenticated USING (auth_has_permission('maintenance_questions.view'));
    DROP POLICY IF EXISTS "maintenance_questions_insert" ON public.maintenance_checks_question;
    CREATE POLICY "maintenance_questions_insert" ON public.maintenance_checks_question
      FOR INSERT TO authenticated WITH CHECK (auth_has_permission('maintenance_questions.create'));
    DROP POLICY IF EXISTS "maintenance_questions_update" ON public.maintenance_checks_question;
    CREATE POLICY "maintenance_questions_update" ON public.maintenance_checks_question
      FOR UPDATE TO authenticated USING (auth_has_permission('maintenance_questions.update')) WITH CHECK (auth_has_permission('maintenance_questions.update'));
    DROP POLICY IF EXISTS "maintenance_questions_delete" ON public.maintenance_checks_question;
    CREATE POLICY "maintenance_questions_delete" ON public.maintenance_checks_question
      FOR DELETE TO authenticated USING (auth_has_permission('maintenance_questions.delete'));
  END IF;
END $$;
