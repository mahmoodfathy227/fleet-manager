-- ====================================================
-- Add User Update Policy for Admin Approvals
-- ====================================================
-- Allows admins to update user approval status
-- ====================================================

-- Create a helper function to check if current user is an admin
-- This function uses the JWT email claim to look up the user
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get email from JWT claim
  user_email := (auth.jwt() ->> 'email');
  
  -- Check if user exists and is an admin with approved status
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(users.email) = LOWER(user_email)
    AND users.role = 'admin'
    AND users.approval_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Allow admins to update users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to update users" ON users;

-- Allow admins to update users (for approval/rejection)
CREATE POLICY "Allow admins to update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Add helpful comments
COMMENT ON FUNCTION is_admin_user() IS 
  'Checks if the current authenticated user is an admin with approved status';
COMMENT ON POLICY "Allow admins to update users" ON users IS 
  'Allows admin users with approved status to update user records (for approval/rejection)';

