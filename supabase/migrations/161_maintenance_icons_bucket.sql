-- =====================================================
-- MAINTENANCE_ICONS storage bucket for question icons
-- =====================================================
-- Create the bucket in Dashboard if it doesn't exist:
-- Storage > New bucket > id: MAINTENANCE_ICONS, public: true
-- =====================================================

DROP POLICY IF EXISTS "maintenance_icons_select" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_icons_insert" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_icons_update" ON storage.objects;
DROP POLICY IF EXISTS "maintenance_icons_delete" ON storage.objects;

CREATE POLICY "maintenance_icons_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'MAINTENANCE_ICONS' AND auth_has_permission('maintenance_questions.view'));

CREATE POLICY "maintenance_icons_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'MAINTENANCE_ICONS' AND (auth_has_permission('maintenance_questions.create') OR auth_has_permission('maintenance_questions.update')));

CREATE POLICY "maintenance_icons_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'MAINTENANCE_ICONS' AND auth_has_permission('maintenance_questions.update'))
  WITH CHECK (bucket_id = 'MAINTENANCE_ICONS');

CREATE POLICY "maintenance_icons_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'MAINTENANCE_ICONS' AND auth_has_permission('maintenance_questions.delete'));

-- Allow public read so icon images can be shown in app (e.g. mobile) without auth
CREATE POLICY "maintenance_icons_public_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'MAINTENANCE_ICONS');
