-- Setup storage policies for VEHICLE_DOCUMENTS bucket
-- This allows authenticated users to upload, read, update, and delete vehicle documents

-- First, ensure the bucket exists (this will fail gracefully if it doesn't)
-- Note: Buckets must be created manually in Supabase Dashboard, but we can check if it exists
DO $$
BEGIN
  -- Check if bucket exists
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'VEHICLE_DOCUMENTS'
  ) THEN
    RAISE NOTICE 'WARNING: VEHICLE_DOCUMENTS bucket does not exist. Please create it in Supabase Dashboard: Storage > New bucket > Name: VEHICLE_DOCUMENTS > Public: Yes';
  ELSE
    RAISE NOTICE 'VEHICLE_DOCUMENTS bucket exists';
  END IF;
END $$;

-- Drop existing policies if they exist (handle all possible policy names)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND (policyname LIKE '%VEHICLE_DOCUMENTS%' OR policyname LIKE '%vehicle%document%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 1. Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads to VEHICLE_DOCUMENTS"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'VEHICLE_DOCUMENTS');

-- 2. Allow authenticated users to read files
CREATE POLICY "Allow authenticated reads from VEHICLE_DOCUMENTS"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'VEHICLE_DOCUMENTS');

-- 3. Allow authenticated users to update files
CREATE POLICY "Allow authenticated updates to VEHICLE_DOCUMENTS"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'VEHICLE_DOCUMENTS')
  WITH CHECK (bucket_id = 'VEHICLE_DOCUMENTS');

-- 4. Allow authenticated users to delete files
CREATE POLICY "Allow authenticated deletes from VEHICLE_DOCUMENTS"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'VEHICLE_DOCUMENTS');

-- 5. Allow public read access (if bucket is public)
-- This allows viewing documents via public URLs
CREATE POLICY "Allow public read VEHICLE_DOCUMENTS"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'VEHICLE_DOCUMENTS');

-- 6. Allow anonymous uploads to VEHICLE_DOCUMENTS (for token-based uploads)
CREATE POLICY "Allow anonymous uploads to VEHICLE_DOCUMENTS"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'VEHICLE_DOCUMENTS');

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%VEHICLE_DOCUMENTS%';
  
  RAISE NOTICE 'Created % policies for VEHICLE_DOCUMENTS bucket', policy_count;
END $$;

-- IMPORTANT: Make sure the VEHICLE_DOCUMENTS bucket exists in your Supabase Storage
-- If it doesn't exist, create it in the Supabase Dashboard:
-- 1. Go to Storage section
-- 2. Click "New bucket"
-- 3. Name: VEHICLE_DOCUMENTS (exact name, case-sensitive)
-- 4. Public bucket: ✅ Enable (checked)
-- 5. File size limit: 10 MB (10485760 bytes) or as needed
-- 6. Allowed MIME types: image/*, application/pdf

-- To verify bucket exists, run:
-- SELECT * FROM storage.buckets WHERE id = 'VEHICLE_DOCUMENTS';

-- To verify policies exist, run:
-- SELECT policyname, cmd, roles 
-- FROM pg_policies 
-- WHERE schemaname = 'storage' 
-- AND tablename = 'objects'
-- AND policyname LIKE '%VEHICLE_DOCUMENTS%';

