-- 179_send_admin_broadcast.sql
--
-- Adds the send_admin_broadcast RPC.
-- Admins call this RPC from the dashboard "Send Push Notification" page.
-- The RPC validates RBAC, resolves recipients, and inserts one
-- notifications row per recipient (notification_type = 'admin_broadcast').
-- Each INSERT fires the DB webhook --> push-notification-relay Edge Function
-- --> notifyInternal Firebase Function --> FCM push.
--
-- This replaces direct calls to the Firebase sendNotification Function from
-- the dashboard, giving every manual broadcast an audit trail in Supabase.

CREATE OR REPLACE FUNCTION public.send_admin_broadcast(
  p_audience_type TEXT,                          -- 'single_user' | 'route_parents' | 'route_crew'
  p_title         TEXT,
  p_body          TEXT,
  p_target_user_id UUID    DEFAULT NULL,         -- required when audience_type = 'single_user'
  p_route_id       INTEGER DEFAULT NULL,         -- required when audience_type = 'route_parents' | 'route_crew'
  p_deep_link      TEXT    DEFAULT NULL,
  p_metadata       JSONB   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id    UUID := auth.uid();
  v_required_perm TEXT;
  v_has_perm     BOOLEAN := FALSE;
  v_recipient    UUID;
  v_recipient_count INTEGER := 0;
BEGIN
  -- ── Validate inputs ────────────────────────────────────────────────────────
  IF p_audience_type NOT IN ('single_user', 'route_parents', 'route_crew') THEN
    RAISE EXCEPTION 'Invalid audience_type: %', p_audience_type;
  END IF;

  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  IF p_body IS NULL OR trim(p_body) = '' THEN
    RAISE EXCEPTION 'body is required';
  END IF;

  IF p_audience_type = 'single_user' AND p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required for single_user audience';
  END IF;

  IF p_audience_type IN ('route_parents', 'route_crew') AND p_route_id IS NULL THEN
    RAISE EXCEPTION 'route_id is required for route_parents / route_crew audience';
  END IF;

  -- ── RBAC permission check ──────────────────────────────────────────────────
  v_required_perm := CASE p_audience_type
    WHEN 'single_user'   THEN 'notifications.send.single'
    WHEN 'route_parents' THEN 'notifications.send.route_parents'
    WHEN 'route_crew'    THEN 'notifications.send.route_crew'
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

  -- Also grant to Full System Administrator (super-admin bypasses per-perm check)
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

  -- ── Resolve recipients and insert notifications ────────────────────────────
  IF p_audience_type = 'single_user' THEN
    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    VALUES (
      'admin_broadcast',
      'unread',
      p_target_user_id,
      jsonb_build_object(
        'title',         p_title,
        'body',          p_body,
        'deep_link',     p_deep_link,
        'metadata',      p_metadata,
        'audience_type', p_audience_type,
        'route_id',      p_route_id,
        'sent_by',       v_sender_id
      )
    );
    v_recipient_count := 1;

  ELSIF p_audience_type = 'route_parents' THEN
    -- All parents linked to active passengers on this route
    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT DISTINCT
      'admin_broadcast',
      'unread',
      pc.user_id,
      jsonb_build_object(
        'title',         p_title,
        'body',          p_body,
        'deep_link',     p_deep_link,
        'metadata',      p_metadata,
        'audience_type', p_audience_type,
        'route_id',      p_route_id,
        'sent_by',       v_sender_id
      )
    FROM   route_points rpt
    JOIN   passengers pas               ON pas.id = rpt.passenger_id
    JOIN   passenger_parent_contacts ppc ON ppc.passenger_id = pas.id
    JOIN   parent_contacts pc            ON pc.id = ppc.parent_contact_id
    WHERE  rpt.route_id = p_route_id
      AND  pc.user_id IS NOT NULL;

    GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  ELSIF p_audience_type = 'route_crew' THEN
    -- Driver + passenger assistant(s) assigned to the route
    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT DISTINCT
      'admin_broadcast',
      'unread',
      e.user_id,
      jsonb_build_object(
        'title',         p_title,
        'body',          p_body,
        'deep_link',     p_deep_link,
        'metadata',      p_metadata,
        'audience_type', p_audience_type,
        'route_id',      p_route_id,
        'sent_by',       v_sender_id
      )
    FROM   routes r
    LEFT JOIN drivers d ON d.id = r.driver_id
    LEFT JOIN employees e_driver ON e_driver.id = d.employee_id AND e_driver.user_id IS NOT NULL
    LEFT JOIN passenger_assistants pa ON pa.id = r.passenger_assistant_id
    LEFT JOIN employees e_pa ON e_pa.id = pa.employee_id AND e_pa.user_id IS NOT NULL
    CROSS JOIN LATERAL (
      SELECT e_driver.user_id AS user_id WHERE e_driver.user_id IS NOT NULL
      UNION
      SELECT e_pa.user_id     AS user_id WHERE e_pa.user_id IS NOT NULL
    ) e
    WHERE  r.id = p_route_id;

    GET DIAGNOSTICS v_recipient_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('recipient_count', v_recipient_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_admin_broadcast(TEXT, TEXT, TEXT, UUID, INTEGER, TEXT, JSONB)
  TO authenticated;

COMMENT ON FUNCTION public.send_admin_broadcast IS
  'Admin-only RPC: sends a manual push notification to a user, route parents, or route crew. '
  'Inserts one notifications row per recipient (admin_broadcast type). '
  'Each INSERT fires the push-notification-relay webhook automatically.';
