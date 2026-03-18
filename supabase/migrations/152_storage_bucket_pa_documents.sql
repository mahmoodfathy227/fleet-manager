-- =====================================================
-- PA_DOCUMENTS bucket for passenger assistant documents
-- (Dynamic requirements and other PA uploads use this bucket.)
-- =====================================================

-- Create bucket if not exists (via storage.buckets insert with ON CONFLICT or manual creation)
-- Note: Supabase does not support INSERT ON CONFLICT for storage.buckets in all versions.
-- Create the bucket in Dashboard if it doesn't exist: Storage > New bucket > id: PA_DOCUMENTS, public: true

-- Storage RLS policies for PA_DOCUMENTS
DROP POLICY IF EXISTS "Allow authenticated uploads to PA_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from PA_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to PA_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from PA_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read PA_DOCUMENTS" ON storage.objects;

CREATE POLICY "Allow authenticated uploads to PA_DOCUMENTS"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'PA_DOCUMENTS');

CREATE POLICY "Allow authenticated reads from PA_DOCUMENTS"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'PA_DOCUMENTS');

CREATE POLICY "Allow authenticated updates to PA_DOCUMENTS"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'PA_DOCUMENTS') WITH CHECK (bucket_id = 'PA_DOCUMENTS');

CREATE POLICY "Allow authenticated deletes from PA_DOCUMENTS"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'PA_DOCUMENTS');

CREATE POLICY "Allow public read PA_DOCUMENTS"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'PA_DOCUMENTS');
