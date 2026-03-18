-- ====================================================
-- CREATE REQUIRED STORAGE BUCKETS
-- ====================================================
-- This migration creates the storage buckets needed for document uploads
-- Note: Buckets can be created via SQL, but they must be configured properly

-- 1. Create VEHICLE_DOCUMENTS bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'VEHICLE_DOCUMENTS',
  'VEHICLE_DOCUMENTS',
  true, -- Public bucket
  10485760, -- 10 MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create EMPLOYEE_DOCUMENTS bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'EMPLOYEE_DOCUMENTS',
  'EMPLOYEE_DOCUMENTS',
  true, -- Public bucket
  10485760, -- 10 MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create DOCUMENTS bucket (if it doesn't exist) - fallback bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'DOCUMENTS',
  'DOCUMENTS',
  true, -- Public bucket
  10485760, -- 10 MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================
-- SETUP STORAGE POLICIES FOR EMPLOYEE_DOCUMENTS
-- ====================================================

-- Drop existing policies for EMPLOYEE_DOCUMENTS
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND (policyname LIKE '%EMPLOYEE_DOCUMENTS%' OR policyname LIKE '%employee%document%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Allow authenticated users to upload to EMPLOYEE_DOCUMENTS
CREATE POLICY "Allow authenticated uploads to EMPLOYEE_DOCUMENTS"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'EMPLOYEE_DOCUMENTS');

-- Allow authenticated users to read from EMPLOYEE_DOCUMENTS
CREATE POLICY "Allow authenticated reads from EMPLOYEE_DOCUMENTS"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'EMPLOYEE_DOCUMENTS');

-- Allow authenticated users to update files in EMPLOYEE_DOCUMENTS
CREATE POLICY "Allow authenticated updates to EMPLOYEE_DOCUMENTS"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'EMPLOYEE_DOCUMENTS')
  WITH CHECK (bucket_id = 'EMPLOYEE_DOCUMENTS');

-- Allow authenticated users to delete from EMPLOYEE_DOCUMENTS
CREATE POLICY "Allow authenticated deletes from EMPLOYEE_DOCUMENTS"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'EMPLOYEE_DOCUMENTS');

-- Allow public read access to EMPLOYEE_DOCUMENTS
CREATE POLICY "Allow public read EMPLOYEE_DOCUMENTS"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'EMPLOYEE_DOCUMENTS');

-- Allow anonymous uploads to EMPLOYEE_DOCUMENTS (for token-based uploads)
CREATE POLICY "Allow anonymous uploads to EMPLOYEE_DOCUMENTS"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'EMPLOYEE_DOCUMENTS');

-- ====================================================
-- SETUP STORAGE POLICIES FOR DOCUMENTS (fallback)
-- ====================================================

-- Drop existing policies for DOCUMENTS bucket
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE '%DOCUMENTS%'
    AND policyname NOT LIKE '%VEHICLE%'
    AND policyname NOT LIKE '%EMPLOYEE%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Allow authenticated users to upload to DOCUMENTS
CREATE POLICY "Allow authenticated uploads to DOCUMENTS"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'DOCUMENTS');

-- Allow authenticated users to read from DOCUMENTS
CREATE POLICY "Allow authenticated reads from DOCUMENTS"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'DOCUMENTS');

-- Allow authenticated users to update files in DOCUMENTS
CREATE POLICY "Allow authenticated updates to DOCUMENTS"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'DOCUMENTS')
  WITH CHECK (bucket_id = 'DOCUMENTS');

-- Allow authenticated users to delete from DOCUMENTS
CREATE POLICY "Allow authenticated deletes from DOCUMENTS"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'DOCUMENTS');

-- Allow public read access to DOCUMENTS
CREATE POLICY "Allow public read DOCUMENTS"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'DOCUMENTS');

-- Allow anonymous uploads to DOCUMENTS (for token-based uploads)
CREATE POLICY "Allow anonymous uploads to DOCUMENTS"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'DOCUMENTS');

-- ====================================================
-- VERIFY BUCKETS WERE CREATED
-- ====================================================

DO $$
DECLARE
  bucket_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bucket_count
  FROM storage.buckets
  WHERE id IN ('VEHICLE_DOCUMENTS', 'EMPLOYEE_DOCUMENTS', 'DOCUMENTS');
  
  IF bucket_count = 3 THEN
    RAISE NOTICE 'Successfully created/verified all 3 required storage buckets';
  ELSE
    RAISE WARNING 'Only % out of 3 buckets exist. Please check bucket creation.', bucket_count;
  END IF;
END $$;

-- ====================================================
-- NOTES
-- ====================================================
-- If bucket creation fails, you may need to create them manually in Supabase Dashboard:
-- 1. Go to Storage section
-- 2. Click "New bucket"
-- 3. For each bucket:
--    - Name: VEHICLE_DOCUMENTS, EMPLOYEE_DOCUMENTS, or DOCUMENTS (exact name, case-sensitive)
--    - Public bucket: ✅ Enable (checked)
--    - File size limit: 10 MB (10485760 bytes)
--    - Allowed MIME types: image/jpeg, image/jpg, image/png, image/gif, application/pdf
--
-- To verify buckets exist:
-- SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id IN ('VEHICLE_DOCUMENTS', 'EMPLOYEE_DOCUMENTS', 'DOCUMENTS');

