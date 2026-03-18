-- Storage RLS policies for DRIVER_DOCUMENTS bucket
-- Fixes: "new row violates row-level security policy" when uploading DBS/certificates for drivers/PAs.
-- The app uploads to DRIVER_DOCUMENTS for both drivers and passenger assistants.

DROP POLICY IF EXISTS "Allow authenticated uploads to DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read DRIVER_DOCUMENTS" ON storage.objects;

-- Allow authenticated users to upload (INSERT) to DRIVER_DOCUMENTS
CREATE POLICY "Allow authenticated uploads to DRIVER_DOCUMENTS"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'DRIVER_DOCUMENTS');

-- Allow authenticated users to read (SELECT) from DRIVER_DOCUMENTS
CREATE POLICY "Allow authenticated reads from DRIVER_DOCUMENTS"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'DRIVER_DOCUMENTS');

-- Allow authenticated users to update files in DRIVER_DOCUMENTS
CREATE POLICY "Allow authenticated updates to DRIVER_DOCUMENTS"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'DRIVER_DOCUMENTS')
  WITH CHECK (bucket_id = 'DRIVER_DOCUMENTS');

-- Allow authenticated users to delete from DRIVER_DOCUMENTS
CREATE POLICY "Allow authenticated deletes from DRIVER_DOCUMENTS"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'DRIVER_DOCUMENTS');

-- Allow public read if bucket is public (for viewing docs via URL)
CREATE POLICY "Allow public read DRIVER_DOCUMENTS"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'DRIVER_DOCUMENTS');
