-- ====================================================
-- Allow Anonymous User Signup
-- ====================================================
-- Allows anonymous users to insert into users table during signup
-- This is needed because users sign up before being fully authenticated
-- ====================================================

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to insert users" ON users;

-- Allow authenticated users to insert users (for admin-created users)
CREATE POLICY "Allow authenticated users to insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous users to insert users during signup
-- This allows the signup flow to create user records (drop first for idempotency)
DROP POLICY IF EXISTS "Allow anonymous users to insert users during signup" ON users;

CREATE POLICY "Allow anonymous users to insert users during signup"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (approval_status = 'pending');

-- Ensure the insert policy allows the new approval_status column
-- Update the existing policy to handle the new column
COMMENT ON POLICY "Allow anonymous users to insert users during signup" ON users IS 
  'Allows anonymous users to create user records during signup with pending approval status';

