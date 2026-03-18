-- ====================================================
-- Fix User Approval Case Sensitivity
-- ====================================================
-- Ensures email lookups are case-insensitive
-- Adds index for better performance on email lookups
-- ====================================================

-- Create case-insensitive index on email column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- Add helpful comment
COMMENT ON INDEX idx_users_email_lower IS 'Case-insensitive index on email for better lookup performance';

