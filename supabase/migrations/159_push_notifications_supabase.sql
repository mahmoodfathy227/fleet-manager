-- =====================================================
-- Push Notifications Module - Supabase Migration
-- =====================================================
-- Permissions, employees.user_id, RPCs for route crew/parents,
-- get_my_permissions (if not exists), role mapping.
-- =====================================================

-- =====================================================
-- 1. INSERT/UPSERT NOTIFICATION PERMISSIONS
-- =====================================================

INSERT INTO public.permissions (key, description) VALUES
  ('notifications.send.single', 'Send push notification to a single user'),
  ('notifications.send.route_parents', 'Send push notification to all parents on a route'),
  ('notifications.send.route_crew', 'Send push notification to route driver and passenger assistant'),
  ('notifications.inbox', 'View own push notification inbox')
ON CONFLICT (key) DO UPDATE SET description = excluded.description;

-- =====================================================
-- 2. LINK EMPLOYEES TO AUTH.USERS
-- =====================================================

-- Add user_id column if not exists
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- Backfill from auth.users where personal_email matches (case-insensitive)
UPDATE public.employees e
SET user_id = u.id
FROM auth.users u
WHERE e.user_id IS NULL
  AND e.personal_email IS NOT NULL
  AND lower(trim(e.personal_email)) = lower(trim(u.email));

-- Check for duplicate user_id in employees (run manually before adding unique constraint):
-- SELECT user_id, count(*) FROM public.employees WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1;
-- Only add unique constraint if no duplicates:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.employees'::regclass
        AND conname = 'employees_user_id_key'
    ) THEN
      ALTER TABLE public.employees ADD CONSTRAINT employees_user_id_key UNIQUE (user_id);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Constraint may already exist or duplicates present; skip
  NULL;
END $$;

-- =====================================================
-- 3. ENSURE PARENT_CONTACTS HAS USER_ID (for route parents)
-- =====================================================

ALTER TABLE public.parent_contacts
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parent_contacts_user_id ON public.parent_contacts(user_id);

-- Backfill parent_contacts.user_id from auth.users where email matches
UPDATE public.parent_contacts pc
SET user_id = u.id
FROM auth.users u
WHERE pc.user_id IS NULL
  AND pc.email IS NOT NULL
  AND lower(trim(pc.email)) = lower(trim(u.email));

-- =====================================================
-- 4. RPC: get_route_crew_user_ids
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_route_crew_user_ids(p_route_id INTEGER)
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT e.user_id
  FROM public.routes r
  JOIN public.employees e ON e.id IN (r.driver_id, r.passenger_assistant_id)
  WHERE r.id = p_route_id
    AND e.user_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_route_crew_user_ids IS 'Returns auth user UUIDs for driver and PA assigned to a route';

-- =====================================================
-- 5. RPC: get_route_parent_user_ids
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_route_parent_user_ids(p_route_id INTEGER)
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT pc.user_id
  FROM public.passengers p
  JOIN public.passenger_parent_contacts ppc ON ppc.passenger_id = p.id
  JOIN public.parent_contacts pc ON pc.id = ppc.parent_contact_id
  WHERE p.route_id = p_route_id
    AND pc.user_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_route_parent_user_ids IS 'Returns auth user UUIDs for all parents linked to passengers on a route';

-- =====================================================
-- 6. RPC: get_my_permissions (ensure returns distinct keys)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE (permission_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.key
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
    AND ur.active = true
  UNION
  SELECT p.key
  FROM permissions p
  WHERE auth_is_super_admin();
$$;

COMMENT ON FUNCTION public.get_my_permissions IS 'Returns permission keys for the current user (for frontend route guards)';

-- =====================================================
-- 7. RPC: search_notification_recipients (for admin UI)
-- =====================================================

CREATE OR REPLACE FUNCTION public.search_notification_recipients(p_search TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  source TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT auth_has_any_permission(ARRAY['notifications.send.single', 'notifications.send.route_parents', 'notifications.send.route_crew']) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    -- From employees (drivers, PAs, etc.)
    SELECT DISTINCT
      e.user_id,
      e.personal_email::TEXT AS email,
      e.full_name::TEXT AS display_name,
      'employee'::TEXT AS source
    FROM public.employees e
    WHERE e.user_id IS NOT NULL
      AND (
        p_search IS NULL OR p_search = ''
        OR lower(e.full_name) LIKE '%' || lower(trim(p_search)) || '%'
        OR lower(e.personal_email) LIKE '%' || lower(trim(p_search)) || '%'
      )
    UNION
    -- From parent_contacts
    SELECT DISTINCT
      pc.user_id,
      pc.email::TEXT,
      pc.full_name::TEXT,
      'parent'::TEXT
    FROM public.parent_contacts pc
    WHERE pc.user_id IS NOT NULL
      AND (
        p_search IS NULL OR p_search = ''
        OR lower(pc.full_name) LIKE '%' || lower(trim(p_search)) || '%'
        OR lower(pc.email) LIKE '%' || lower(trim(p_search)) || '%'
      )
  ) combined
  ORDER BY display_name
  LIMIT 50;
END;
$$;

COMMENT ON FUNCTION public.search_notification_recipients IS 'Search users for notification targeting (employees + parent_contacts)';

-- =====================================================
-- 8. AUTO ROLE MAPPING: assign notification perms to admin roles
-- =====================================================

-- Assign notification send permissions to admin roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Operations Administrator', 'Full System Administrator', 'Super Admin')
  AND p.key IN ('notifications.send.single', 'notifications.send.route_parents', 'notifications.send.route_crew')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign notifications.inbox to all roles (so any authenticated user can view their inbox)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.key = 'notifications.inbox'
ON CONFLICT (role_id, permission_id) DO NOTHING;
