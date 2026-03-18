-- ====================================================
-- Add Avatar URL to Users Table
-- ====================================================
-- Allows users to store a profile photo URL
-- ====================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN users.avatar_url IS 'Public URL for the user profile photo';

