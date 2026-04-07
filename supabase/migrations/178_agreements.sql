-- ====================================================
-- 178_agreements.sql
--
-- Feature: Terms / Policy Agreements
--
-- Admin creates agreements targeting one or more app-user roles.
-- App users (parents, drivers, PAs) must accept before using the app.
-- Acceptance is tracked in agreement_acceptances.
-- On publish, one notification per targeted user is inserted into
-- the notifications table → DB webhook → push-notification-relay
-- Edge Function → FCM push (notification_type = 'new_agreement').
--
-- Roles stored in target_roles:
--   'parent'               → parent_contacts.user_id
--   'driver'               → employees JOIN drivers → employees.user_id
--   'passenger_assistant'  → employees JOIN passenger_assistants → employees.user_id
--
-- To apply: run this file in Supabase dashboard SQL editor or via CLI.
-- ====================================================

-- ----------------------------------------
-- agreements
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS agreements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  body        text        NOT NULL, -- markdown
  type        text        NOT NULL DEFAULT 'general'
                          CHECK (type IN ('general','terms_of_service','privacy_policy','operational_notice','data_protection')),
  target_roles text[]     NOT NULL
                          CHECK (array_length(target_roles, 1) >= 1),
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- agreement_acceptances
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS agreement_acceptances (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid        NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, user_id)
);

-- ----------------------------------------
-- Indexes
-- ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_agreements_is_active
  ON agreements (is_active);

CREATE INDEX IF NOT EXISTS idx_agreement_acceptances_agreement_id
  ON agreement_acceptances (agreement_id);

CREATE INDEX IF NOT EXISTS idx_agreement_acceptances_user_id
  ON agreement_acceptances (user_id);

-- ----------------------------------------
-- RLS
-- ----------------------------------------
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_acceptances ENABLE ROW LEVEL SECURITY;

-- agreements: app users (mobile) can read active agreements
CREATE POLICY "agreements_select_active"
  ON agreements FOR SELECT
  TO authenticated
  USING (is_active = true);

-- agreements: admins (user_roles) can read ALL agreements incl. archived
CREATE POLICY "agreements_select_admin"
  ON agreements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- agreements INSERT/UPDATE: only via SECURITY DEFINER RPCs (publish_agreement, archive_agreement)
-- No direct INSERT/UPDATE policy — mutations go through RPCs only.

-- agreement_acceptances: users can read and insert their own rows only
CREATE POLICY "acceptances_select_own"
  ON agreement_acceptances FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "acceptances_insert_own"
  ON agreement_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- agreement_acceptances: admins can read all (for stats / audit)
CREATE POLICY "acceptances_select_admin"
  ON agreement_acceptances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- ----------------------------------------
-- RPC: get_pending_agreements(p_user_id uuid)
--
-- Returns active agreements not yet accepted by the given user,
-- filtered to agreements that include at least one role the user holds.
-- Role resolution:
--   parent               → parent_contacts.user_id
--   driver               → employees JOIN drivers (employee_id)
--   passenger_assistant  → employees JOIN passenger_assistants (employee_id)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION get_pending_agreements(p_user_id uuid)
RETURNS TABLE (
  id           uuid,
  title        text,
  body         text,
  type         text,
  target_roles text[],
  created_at   timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_roles text[] := '{}';
BEGIN
  -- Determine which app roles this user holds
  IF EXISTS (SELECT 1 FROM parent_contacts WHERE user_id = p_user_id) THEN
    v_user_roles := v_user_roles || ARRAY['parent'];
  END IF;
  IF EXISTS (SELECT 1 FROM employees e JOIN drivers d ON d.employee_id = e.id WHERE e.user_id = p_user_id) THEN
    v_user_roles := v_user_roles || ARRAY['driver'];
  END IF;
  IF EXISTS (SELECT 1 FROM employees e JOIN passenger_assistants pa ON pa.employee_id = e.id WHERE e.user_id = p_user_id) THEN
    v_user_roles := v_user_roles || ARRAY['passenger_assistant'];
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.body,
    a.type,
    a.target_roles,
    a.created_at
  FROM agreements a
  WHERE a.is_active = true
    AND a.target_roles && v_user_roles          -- at least one role in common
    AND NOT EXISTS (
      SELECT 1
      FROM agreement_acceptances aa
      WHERE aa.agreement_id = a.id
        AND aa.user_id = p_user_id
    )
  ORDER BY a.created_at ASC;                    -- oldest first → show sequentially
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_agreements(uuid) TO authenticated;

-- ----------------------------------------
-- RPC: get_agreement_stats(p_agreement_id uuid)
--
-- Returns acceptance count and total targeted user count for a given agreement.
-- Denominator is dynamic (current users with that role who have a user_id).
-- ----------------------------------------
CREATE OR REPLACE FUNCTION get_agreement_stats(p_agreement_id uuid)
RETURNS TABLE (
  total_targeted  bigint,
  total_accepted  bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_roles text[];
BEGIN
  SELECT target_roles INTO v_target_roles FROM agreements WHERE id = p_agreement_id;

  RETURN QUERY
  SELECT
    (
      SELECT COUNT(DISTINCT u.uid)
      FROM (
        SELECT pc.user_id AS uid FROM parent_contacts pc
          WHERE pc.user_id IS NOT NULL AND 'parent' = ANY(v_target_roles)
        UNION
        SELECT e.user_id FROM employees e JOIN drivers d ON d.employee_id = e.id
          WHERE e.user_id IS NOT NULL AND 'driver' = ANY(v_target_roles)
        UNION
        SELECT e.user_id FROM employees e JOIN passenger_assistants pa ON pa.employee_id = e.id
          WHERE e.user_id IS NOT NULL AND 'passenger_assistant' = ANY(v_target_roles)
      ) u
    ) AS total_targeted,
    (
      SELECT COUNT(*) FROM agreement_acceptances WHERE agreement_id = p_agreement_id
    ) AS total_accepted;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agreement_stats(uuid) TO authenticated;

-- ----------------------------------------
-- RPC: publish_agreement
--
-- Creates a new agreement and bulk-inserts one notification per targeted
-- user into the notifications table. The DB webhook fires automatically
-- per INSERT → push-notification-relay Edge Function → FCM push.
--
-- SECURITY DEFINER so it can write to agreements (bypassing RLS) and
-- insert notifications on behalf of any user.
-- Caller must be an authenticated user with a row in user_roles (admin).
-- ----------------------------------------
CREATE OR REPLACE FUNCTION publish_agreement(
  p_title        text,
  p_body         text,
  p_type         text DEFAULT 'general',
  p_target_roles text[] DEFAULT ARRAY['parent','driver','passenger_assistant']
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agreement_id uuid;
  v_user_id      uuid;
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Validate type
  IF p_type NOT IN ('general','terms_of_service','privacy_policy','operational_notice','data_protection') THEN
    RAISE EXCEPTION 'Invalid type: %', p_type;
  END IF;

  -- Validate roles
  IF array_length(p_target_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'target_roles must be a non-empty array';
  END IF;

  -- Insert the agreement
  INSERT INTO agreements (title, body, type, target_roles, created_by)
  VALUES (p_title, p_body, p_type, p_target_roles, auth.uid())
  RETURNING id INTO v_agreement_id;

  -- Resolve targeted user UUIDs and insert one notification each
  -- parent
  IF 'parent' = ANY(p_target_roles) THEN
    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT
      'new_agreement',
      'pending',
      pc.user_id,
      jsonb_build_object(
        'agreement_id', v_agreement_id,
        'title',        p_title,
        'type',         p_type
      )
    FROM parent_contacts pc
    WHERE pc.user_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  -- driver
  IF 'driver' = ANY(p_target_roles) THEN
    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT DISTINCT
      'new_agreement',
      'pending',
      e.user_id,
      jsonb_build_object(
        'agreement_id', v_agreement_id,
        'title',        p_title,
        'type',         p_type
      )
    FROM employees e
    JOIN drivers d ON d.employee_id = e.id
    WHERE e.user_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  -- passenger_assistant
  IF 'passenger_assistant' = ANY(p_target_roles) THEN
    INSERT INTO notifications (notification_type, status, recipient_user_id, details)
    SELECT DISTINCT
      'new_agreement',
      'pending',
      e.user_id,
      jsonb_build_object(
        'agreement_id', v_agreement_id,
        'title',        p_title,
        'type',         p_type
      )
    FROM employees e
    JOIN passenger_assistants pa ON pa.employee_id = e.id
    WHERE e.user_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_agreement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION publish_agreement(text, text, text, text[]) TO authenticated;

-- ----------------------------------------
-- RPC: archive_agreement(p_agreement_id uuid)
--
-- Sets is_active = false. Users who haven't accepted will no longer see
-- the popup. Existing acceptances are preserved for audit trail.
-- Admin only (user_roles check).
-- ----------------------------------------
CREATE OR REPLACE FUNCTION archive_agreement(p_agreement_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE agreements
  SET is_active = false
  WHERE id = p_agreement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agreement not found: %', p_agreement_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_agreement(uuid) TO authenticated;
