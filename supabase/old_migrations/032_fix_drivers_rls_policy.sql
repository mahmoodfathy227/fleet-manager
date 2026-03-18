-- Fix RLS policy for drivers table to ensure inserts work correctly
-- The issue is that WITH CHECK needs to allow the insert without referencing the new row
-- Drop existing policies and recreate with proper syntax

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to insert drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to update drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to delete drivers" ON drivers;

-- Recreate policies with explicit checks
-- Read: Allow authenticated users to read all drivers
CREATE POLICY "Allow authenticated users to read drivers" 
  ON drivers 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Insert: Allow authenticated users to insert drivers
-- Using WITH CHECK (true) to allow all authenticated inserts
-- The foreign key constraint will handle employee_id validation
CREATE POLICY "Allow authenticated users to insert drivers" 
  ON drivers 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Update: Allow authenticated users to update drivers
CREATE POLICY "Allow authenticated users to update drivers" 
  ON drivers 
  FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- Delete: Allow authenticated users to delete drivers
CREATE POLICY "Allow authenticated users to delete drivers" 
  ON drivers 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Ensure employees table RLS allows foreign key checks
-- This is critical - when inserting a driver, Supabase checks if the employee exists
-- The employees table must allow SELECT for authenticated users (which it already does)
