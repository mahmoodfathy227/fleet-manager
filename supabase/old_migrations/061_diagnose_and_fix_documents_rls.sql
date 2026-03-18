-- Diagnostic and fix for documents RLS issues
-- This will check current policies and recreate them if needed

-- First, let's check what policies exist
DO $$
DECLARE
  doc_policies_count INTEGER;
  vehicles_policy_exists BOOLEAN;
BEGIN
  -- Count existing documents policies
  SELECT COUNT(*) INTO doc_policies_count
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'documents';
  
  RAISE NOTICE 'Current documents policies count: %', doc_policies_count;
  
  -- Check if vehicles read policy exists
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'vehicles' 
    AND policyname = 'Allow authenticated users to read vehicles'
  ) INTO vehicles_policy_exists;
  
  RAISE NOTICE 'Vehicles read policy exists: %', vehicles_policy_exists;
END $$;

-- Force drop and recreate all documents policies to ensure they're correct
DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON documents;

-- Recreate all policies with explicit permissions
CREATE POLICY "Allow authenticated users to read documents" 
  ON documents 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to insert documents" 
  ON documents 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update documents" 
  ON documents 
  FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete documents" 
  ON documents 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Verify vehicles table has read policy (required for foreign key checks)
-- This should already exist, but we'll ensure it's there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'vehicles' 
    AND policyname = 'Allow authenticated users to read vehicles'
  ) THEN
    CREATE POLICY "Allow authenticated users to read vehicles" 
      ON vehicles 
      FOR SELECT 
      TO authenticated 
      USING (true);
    RAISE NOTICE 'Created vehicles read policy';
  ELSE
    RAISE NOTICE 'Vehicles read policy already exists';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Vehicles read policy already exists (caught exception)';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error checking/creating vehicles policy: %', SQLERRM;
END $$;

-- Final verification query (run this separately to check)
-- SELECT tablename, policyname, cmd, roles 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND (tablename = 'documents' OR tablename = 'vehicles')
-- ORDER BY tablename, policyname;

