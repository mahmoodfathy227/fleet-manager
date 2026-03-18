-- Ensure vehicles table RLS allows foreign key checks for documents
-- When inserting a document with vehicle_id, Supabase needs to check if the vehicle exists
-- This requires the vehicles table to allow SELECT for authenticated users

-- Verify vehicles table has SELECT policy (should exist from initial schema)
-- If it doesn't exist, create it
DO $$
BEGIN
  -- Try to create the policy, ignore if it already exists
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
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Policy already exists, that's fine
    NULL;
  WHEN OTHERS THEN
    -- Some other error, log it but continue
    RAISE NOTICE 'Could not create vehicles read policy: %', SQLERRM;
END $$;

-- Also ensure documents table policies are correct (in case migration 059 wasn't run)
DO $$
BEGIN
  -- Check and create INSERT policy if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'documents' 
    AND policyname = 'Allow authenticated users to insert documents'
  ) THEN
    CREATE POLICY "Allow authenticated users to insert documents" 
      ON documents 
      FOR INSERT 
      TO authenticated 
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create documents insert policy: %', SQLERRM;
END $$;

