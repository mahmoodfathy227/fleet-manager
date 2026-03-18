-- Fix RLS policies for documents table
-- Add missing UPDATE and DELETE policies, and ensure INSERT works with vehicle_id
-- This also ensures foreign key checks to vehicles table work properly

-- Drop existing policies to recreate them (handle case where they might not exist)
DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON documents;

-- Note: The vehicles table should already have a SELECT policy from the initial schema
-- This allows foreign key checks when inserting documents with vehicle_id
-- If you're getting RLS errors, verify that vehicles table has:
-- CREATE POLICY "Allow authenticated users to read vehicles" ON vehicles FOR SELECT TO authenticated USING (true);

-- Recreate all policies for documents table
-- Read: Allow authenticated users to read all documents
CREATE POLICY "Allow authenticated users to read documents" 
  ON documents 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Insert: Allow authenticated users to insert documents
-- This allows inserts with vehicle_id, employee_id, or other owner fields
-- The WITH CHECK (true) allows any authenticated user to insert any document
CREATE POLICY "Allow authenticated users to insert documents" 
  ON documents 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Update: Allow authenticated users to update documents
CREATE POLICY "Allow authenticated users to update documents" 
  ON documents 
  FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- Delete: Allow authenticated users to delete documents
CREATE POLICY "Allow authenticated users to delete documents" 
  ON documents 
  FOR DELETE 
  TO authenticated 
  USING (true);

