-- ====================================================
-- Manual User Approval Fix
-- ====================================================
-- Use this to manually approve a user if needed
-- Replace 'ali.abouel3aish@gmail.com' with the actual email
-- ====================================================

-- Manually approve the user
UPDATE users
SET 
  approval_status = 'approved',
  reviewed_at = CURRENT_TIMESTAMP,
  admin_notes = 'Manually approved via migration'
WHERE LOWER(email) = LOWER('ali.abouel3aish@gmail.com');

-- Verify the update
SELECT id, email, approval_status, reviewed_at, role
FROM users
WHERE LOWER(email) = LOWER('ali.abouel3aish@gmail.com');

