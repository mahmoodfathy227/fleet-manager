-- =====================================================
-- Role Management RPCs (Super Admin only)
-- =====================================================

-- Get all auth users with their roles (for role management UI)
CREATE OR REPLACE FUNCTION get_users_with_roles()
RETURNS TABLE (
  auth_user_id UUID,
  email TEXT,
  full_name TEXT,
  role_ids INTEGER[],
  role_names TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT auth_is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    au.id AS auth_user_id,
    au.email::TEXT,
    COALESCE(u.full_name, split_part(au.email, '@', 1))::TEXT AS full_name,
    COALESCE(
      (SELECT array_agg(ur.role_id ORDER BY r.name)
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = au.id AND ur.active = true),
      ARRAY[]::INTEGER[]
    ) AS role_ids,
    COALESCE(
      (SELECT array_agg(r.name ORDER BY r.name)
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = au.id AND ur.active = true),
      ARRAY[]::TEXT[]
    ) AS role_names
  FROM auth.users au
  LEFT JOIN public.users u ON LOWER(u.email) = LOWER(au.email)
  WHERE au.email IS NOT NULL
  ORDER BY COALESCE(u.full_name, au.email);
END;
$$;

-- Set roles for a user (replaces existing assignments)
CREATE OR REPLACE FUNCTION set_user_roles(
  p_user_id UUID,
  p_role_ids INTEGER[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT auth_is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM user_roles WHERE user_id = p_user_id;

  IF array_length(p_role_ids, 1) > 0 THEN
    INSERT INTO user_roles (user_id, role_id, active, assigned_by)
    SELECT p_user_id, unnest(p_role_ids), true, auth.uid();
  END IF;
END;
$$;

COMMENT ON FUNCTION get_users_with_roles IS 'Returns auth users with their assigned roles (Super Admin only)';
COMMENT ON FUNCTION set_user_roles IS 'Sets roles for a user, replacing existing (Super Admin only)';
