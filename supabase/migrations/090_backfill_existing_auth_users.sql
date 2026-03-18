-- ====================================================
-- Backfill Existing Auth Users
-- ====================================================
-- Creates users table records for existing Supabase Auth users
-- This ensures admin accounts created before the approval system work correctly
-- ====================================================

-- Function to sync auth.users with public.users
-- This creates a user record for any auth user that doesn't have one
CREATE OR REPLACE FUNCTION sync_auth_users_to_public_users()
RETURNS void AS $$
DECLARE
  auth_user RECORD;
  has_full_name BOOLEAN;
BEGIN
  -- Check if full_name column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'full_name'
  ) INTO has_full_name;

  -- Loop through all auth users
  FOR auth_user IN 
    SELECT id, email, created_at
    FROM auth.users
    WHERE email IS NOT NULL
  LOOP
    -- Check if user exists in public.users (case-insensitive)
    IF NOT EXISTS (
      SELECT 1 FROM public.users WHERE LOWER(email) = LOWER(auth_user.email)
    ) THEN
      -- Create user record with approved status (for existing accounts)
      IF has_full_name THEN
        -- Extract name from email if full_name column exists
        INSERT INTO public.users (
          email,
          password_hash,
          role,
          approval_status,
          full_name,
          created_at
        ) VALUES (
          auth_user.email,
          'managed_by_supabase_auth',
          'admin', -- Default to admin for existing accounts
          'approved', -- Auto-approve existing accounts
          INITCAP(REPLACE(REPLACE(SPLIT_PART(auth_user.email, '@', 1), '.', ' '), '_', ' ')), -- Generate name from email
          auth_user.created_at
        );
      ELSE
        -- Insert without full_name if column doesn't exist yet
        INSERT INTO public.users (
          email,
          password_hash,
          role,
          approval_status,
          created_at
        ) VALUES (
          auth_user.email,
          'managed_by_supabase_auth',
          'admin', -- Default to admin for existing accounts
          'approved', -- Auto-approve existing accounts
          auth_user.created_at
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the sync function
SELECT sync_auth_users_to_public_users();

-- Drop the function after use (optional, can keep it for future use)
-- DROP FUNCTION IF EXISTS sync_auth_users_to_public_users();

COMMENT ON FUNCTION sync_auth_users_to_public_users IS 
  'Syncs existing Supabase Auth users to public.users table with approved status';

