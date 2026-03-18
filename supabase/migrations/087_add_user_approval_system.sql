-- ====================================================
-- Add User Approval System
-- ====================================================
-- Adds approval_status field to users table
-- Allows admins to review and approve/reject new user signups
-- ====================================================

-- Add approval_status column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'pending';

-- Add reviewed_by and reviewed_at columns for tracking admin reviews
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Add admin_notes column for admin comments during review
ALTER TABLE users
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create index for faster queries on approval status
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);

-- Update existing users to 'approved' status (assuming they were already active)
UPDATE users
SET approval_status = 'approved'
WHERE approval_status IS NULL OR approval_status = 'pending';

-- Add helpful comments
COMMENT ON COLUMN users.approval_status IS 'User approval status: pending, approved, or rejected';
COMMENT ON COLUMN users.reviewed_by IS 'ID of admin user who reviewed this signup';
COMMENT ON COLUMN users.reviewed_at IS 'Timestamp when the signup was reviewed';
COMMENT ON COLUMN users.admin_notes IS 'Admin notes/comments about the user signup review';

