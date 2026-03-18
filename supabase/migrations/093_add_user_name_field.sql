-- ====================================================
-- Add Name Field to Users Table
-- ====================================================
-- Adds full_name column to users table for signup
-- ====================================================

-- Add full_name column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS full_name VARCHAR;

-- Add helpful comment
COMMENT ON COLUMN users.full_name IS 'Full name of the user';

