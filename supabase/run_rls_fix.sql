-- Fix RLS for: 1) documents & drivers tables  2) DRIVER_DOCUMENTS storage bucket
-- Run this in Supabase Dashboard → SQL Editor if db push fails due to migration history.
-- Fixes: "can't save due to row security policy" and "new row violates row-level security policy" on upload.

-- ========== 1. TABLE: documents ==========
DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON documents;

CREATE POLICY "Allow authenticated users to read documents"
  ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert documents"
  ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update documents"
  ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete documents"
  ON documents FOR DELETE TO authenticated USING (true);

-- ========== 2. TABLE: drivers ==========
DROP POLICY IF EXISTS "Allow authenticated users to read drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to insert drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to update drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to delete drivers" ON drivers;

CREATE POLICY "Allow authenticated users to read drivers"
  ON drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert drivers"
  ON drivers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update drivers"
  ON drivers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete drivers"
  ON drivers FOR DELETE TO authenticated USING (true);

-- ========== 3. STORAGE: DRIVER_DOCUMENTS bucket (for DBS/certificate uploads) ==========
DROP POLICY IF EXISTS "Allow authenticated uploads to DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read DRIVER_DOCUMENTS" ON storage.objects;

CREATE POLICY "Allow authenticated uploads to DRIVER_DOCUMENTS"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'DRIVER_DOCUMENTS');

CREATE POLICY "Allow authenticated reads from DRIVER_DOCUMENTS"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'DRIVER_DOCUMENTS');

CREATE POLICY "Allow authenticated updates to DRIVER_DOCUMENTS"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'DRIVER_DOCUMENTS') WITH CHECK (bucket_id = 'DRIVER_DOCUMENTS');

CREATE POLICY "Allow authenticated deletes from DRIVER_DOCUMENTS"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'DRIVER_DOCUMENTS');

CREATE POLICY "Allow public read DRIVER_DOCUMENTS"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'DRIVER_DOCUMENTS');
