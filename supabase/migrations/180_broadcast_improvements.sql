-- 180_broadcast_improvements.sql
--
-- 1. Rebuild search_notification_recipients: adds phone_number to return type
--    and searches by phone as well as name / email.
--
-- 2. Rebuild send_admin_broadcast: adds all_parents / all_drivers /
--    all_passenger_assistants audience types; renames body → body_md in the
--    details JSONB; removes p_deep_link and p_metadata parameters.
--
-- Both functions must be DROPped before re-creating because PostgreSQL does
-- not allow changing a function's signature or return type via REPLACE.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. search_notification_recipients
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.search_notification_recipients(text);

CREATE FUNCTION public.search_notification_recipients(p_search TEXT)
RETURNS TABLE (
  user_id      UUID,
  email        TEXT,
  display_name TEXT,
  phone_number TEXT,
  source       TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT auth_has_any_permission(ARRAY[
    'notifications.send.single',
    'notifications.send.route_parents',
    'notifications.send.route_crew'
  ]) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    -- Employees (drivers, PAs, etc.)
    SELECT DISTINCT
      e.user_id,
      e.personal_email::TEXT  AS email,
      e.full_name::TEXT       AS display_name,
      e.phone_number::TEXT    AS phone_number,
      'employee'::TEXT        AS source
    FROM public.employees e
    WHERE e.user_id IS NOT NULL
      AND (
        p_search IS NULL OR p_search = ''
        OR lower(e.full_name)      LIKE '%' || lower(trim(p_search)) || '%'
        OR lower(e.personal_email) LIKE '%' || lower(trim(p_search)) || '%'
        OR lower(e.phone_number)   LIKE '%' || lower(trim(p_search)) || '%'
      )
    UNION
    -- Parent contacts
    SELECT DISTINCT
      pc.user_id,
      pc.email::TEXT,
      pc.full_name::TEXT,
      pc.phone_number::TEXT,
      'parent'::TEXT
    FROM public.parent_contacts pc
    WHERE pc.user_id IS NOT NULL
      AND (
        p_search IS NULL OR p_search = ''
        OR lower(pc.full_name)    LIKE '%' || lower(trim(p_search)) || '%'
        OR lower(pc.email)        LIKE '%' || lower(trim(p_search)) || '%'
        OR lower(pc.phone_number) LIKE '%' || lower(trim(p_search)) || '%'
      )
  ) combined
  ORDER BY display_name
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_notification_recipients(TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.search_notification_recipients IS
  'Search users for broadcast targeting (employees + parent_contacts). '
  'Returns phone_number alongside email so the admin UI can show a helpful label.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. send_admin_broadcast
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop old signature (TEXT, TEXT, TEXT, UUID, INTEGER, TEXT, JSONB)
DROP FUNCTION IF EXISTS public.send_admin_broadcast(TEXT, TEXT, TEXT, UUID, INTEGER, TEXT, JSONB);

CREATE FUNCTION public.send_admin_broadcast(
  p_audience_type  TEXT,
  -- 'single_user' | 'route_parents' | 'route_crew'
  -- 'all_parents'  | 'all_drivers'  | 'all_passenger_assistants'
  p_title          TEXT,
  p_body_md        TEXT,             -- Markdown body; stored as body_md in details JSONB
  p_target_user_id UUID    DEFAULT NULL,  -- required for single_user
  p_route_id       INTEGER DEFAULT NULL   -- required for route_parents / route_crew
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id       UUID := auth.uid();
  v_required_perm   TEXT;
  v_has_perm        BOOLEAN := FALSE;
  v_recipient_count INTEGER := 0;
  v_details         JSONB;
BEGIN
  -- ── Validate inputs ─────────────────────────────────────────────────────
  IF p_audience_type NOT IN (
    'single_user', 'route_parents', 'route_crew',
    'all_parents', 'all_drivers', 'all_passenger_assistants'
  ) THEN
    RAISE EXCEPTION 'Invalid audience_type: %', p_audience_type;
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  IF p_body_md IS NULL OR trim(p_body_md) = '' THEN
    RAISE EXCEPTION 'body is required';
  END IF;

  IF p_audience_type = 'single_user' AND p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required for single_user audience';
  END IF;

  IF p_audience_type IN ('route_parents', 'route_crew') AND p_route_id IS NULL THEN
    RAISE EXCEPTION 'route_id is required for route_parents / route_crew audience';
  END IF;

  -- ── RBAC permission check ────────────────────────────────────────────────
  v_required_perm := CASE p_audience_type
    WHEN 'single_user'              THEN 'notifications.send.single'
    WHEN 'route_parents'            THEN 'notifications.send.route_parents'
    WHEN 'route_crew'               THEN 'notifications.send.route_crew'
    WHEN 'all_parents'              THEN 'notifications.send.route_parents'
    WHEN 'all_drivers'              THEN 'notifications.send.route_crew'
    WHEN 'all_passenger_assistants' THEN 'notifications.send.route_crew'
  END;

  SELECT EXISTS (
    SELECT 1
    FROM   user_roles ur
    JOIN   role_permissions rp ON rp.role_id = ur.role_id
    JOIN   permissions p        ON p.id = rp.permission_id
    WHERE  ur.user_id = v_sender_id
      AND  ur.active  = TRUE
      AND  p.key = v_required_perm
  ) INTO v_has_perm;

  -- Full System Administrator bypasses per-permission checks
  IF NOT v_has_perm THEN
    SELECT EXISTS (
      SELECT 1
      FROM   user_roles ur
      JOIN   roles r ON r.id = ur.role_id
      WHERE  ur.user_id = v_sender_id
        AND  ur.active  = TRUE
        AND  r.name = 'Full System Administrator'
    ) INTO v_has_perm;
  END IF;

  IF NOT v_has_perm THEN
    RAISE EXCEPTION 'Permission denied: %', v_required_perm;
  END IF;

  -- ── Build shared details JSONB ────────────────────────────────────────────
  v_details := jsonb_build_object(
    'title',         p_title,
    'body_md',       p_body_md,
    'audience_type', p_audience_type,
    'route_id',      p_route_id,
    'sent_by',       v_sender_id
  );

  -- ── Resolve recipients and insert notifications ──────────────────────────
  IF p_audience_type = 'single_user' THEN

    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    VALUES ('admin_broadcast', 'unread', p_target_user_id, v_details);
    v_recipient_count := 1;

  ELSIF p_audience_type = 'all_parents' THEN

    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT 'admin_broadcast', 'unread', pc.user_id, v_details
    FROM   public.parent_contacts pc
    WHERE  pc.user_id IS NOT NULL;
    GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  ELSIF p_audience_type = 'all_drivers' THEN

    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT DISTINCT 'admin_broadcast', 'unread', e.user_id, v_details
    FROM   public.drivers d
    JOIN   public.employees e ON e.id = d.employee_id AND e.user_id IS NOT NULL;
    GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  ELSIF p_audience_type = 'all_passenger_assistants' THEN

    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT DISTINCT 'admin_broadcast', 'unread', e.user_id, v_details
    FROM   public.passenger_assistants pa
    JOIN   public.employees e ON e.id = pa.employee_id AND e.user_id IS NOT NULL;
    GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  ELSIF p_audience_type = 'route_parents' THEN

    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT DISTINCT 'admin_broadcast', 'unread', pc.user_id, v_details
    FROM   public.route_points rpt
    JOIN   public.passengers pas               ON pas.id = rpt.passenger_id
    JOIN   public.passenger_parent_contacts ppc ON ppc.passenger_id = pas.id
    JOIN   public.parent_contacts pc            ON pc.id = ppc.parent_contact_id
    WHERE  rpt.route_id = p_route_id
      AND  pc.user_id IS NOT NULL;
    GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  ELSIF p_audience_type = 'route_crew' THEN

    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT DISTINCT 'admin_broadcast', 'unread', crew.user_id, v_details
    FROM   public.routes r
    LEFT JOIN public.drivers d          ON d.id = r.driver_id
    LEFT JOIN public.employees e_driver ON e_driver.id = d.employee_id AND e_driver.user_id IS NOT NULL
    LEFT JOIN public.passenger_assistants pa ON pa.id = r.passenger_assistant_id
    LEFT JOIN public.employees e_pa     ON e_pa.id = pa.employee_id AND e_pa.user_id IS NOT NULL
    CROSS JOIN LATERAL (
      SELECT e_driver.user_id AS user_id WHERE e_driver.user_id IS NOT NULL
      UNION
      SELECT e_pa.user_id     AS user_id WHERE e_pa.user_id IS NOT NULL
    ) crew
    WHERE  r.id = p_route_id;
    GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  END IF;

  RETURN jsonb_build_object('recipient_count', v_recipient_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_admin_broadcast(TEXT, TEXT, TEXT, UUID, INTEGER)
  TO authenticated;

COMMENT ON FUNCTION public.send_admin_broadcast IS
  'Admin-only RPC: sends a manual push notification to a user, route, or all parents/drivers/PAs. '
  'Inserts one notifications row per recipient (admin_broadcast type). '
  'Details stores body_md (Markdown). The relay strips markdown for FCM; Firestore '
  'keeps body_md for rich in-app rendering. '
  'Each INSERT fires the push-notification-relay webhook automatically.';
