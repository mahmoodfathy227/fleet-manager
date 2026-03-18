-- Fix RLS policies for documents and drivers so authenticated users can save (insert/update)
-- Resolves "can't save due to row security policy" when saving driver documents or driver data.

-- =====================================================
-- DOCUMENTS: ensure full CRUD for authenticated
-- =====================================================
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

-- =====================================================
-- DRIVERS: ensure full CRUD for authenticated
-- =====================================================
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

COMMENT ON POLICY "Allow authenticated users to insert documents" ON documents IS
  'Allows authenticated users to insert document records (e.g. DBS certificate uploads for drivers)';
