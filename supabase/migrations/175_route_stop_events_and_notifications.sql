-- =====================================================================
-- Migration 175: route_stop_events table + notification triggers
-- =====================================================================
-- Creates:
--   • route_stop_events — driver/PA records each pickup / drop-off event
--   • notify_parent_on_stop_event() trigger — inserts a notification row
--     for each parent when their child's stop event fires
--   • notify_parents_on_session_change() trigger — notifies all parents
--     on a route when the trip starts or ends
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: route_stop_events
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.route_stop_events (
  id               BIGSERIAL PRIMARY KEY,
  route_session_id INTEGER NOT NULL REFERENCES public.route_sessions(id) ON DELETE CASCADE,
  route_point_id   INTEGER          REFERENCES public.route_points(id)   ON DELETE SET NULL,
  passenger_id     INTEGER          REFERENCES public.passengers(id)      ON DELETE SET NULL,
  event_type       TEXT NOT NULL
                   CHECK (event_type IN ('arrived', 'picked_up', 'dropped_off', 'skipped', 'no_show')),
  event_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by      UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_route_stop_events_session    ON public.route_stop_events(route_session_id);
CREATE INDEX IF NOT EXISTS idx_route_stop_events_passenger  ON public.route_stop_events(passenger_id);
CREATE INDEX IF NOT EXISTS idx_route_stop_events_event_at   ON public.route_stop_events(event_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- RLS: route_stop_events
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.route_stop_events ENABLE ROW LEVEL SECURITY;

-- Driver / PA can INSERT events for sessions they are assigned to.
CREATE POLICY "driver_pa_can_insert_stop_events"
  ON public.route_stop_events
  FOR INSERT
  WITH CHECK (
    route_session_id IN (
      SELECT rs.id
      FROM   public.route_sessions rs
      JOIN   public.employees e
             ON (e.id = rs.driver_id OR e.id = rs.passenger_assistant_id)
      WHERE  e.user_id = auth.uid()
        AND  rs.ended_at IS NULL
    )
  );

-- Driver / PA can SELECT events for their own sessions.
CREATE POLICY "driver_pa_can_read_own_stop_events"
  ON public.route_stop_events
  FOR SELECT
  USING (
    route_session_id IN (
      SELECT rs.id
      FROM   public.route_sessions rs
      JOIN   public.employees e
             ON (e.id = rs.driver_id OR e.id = rs.passenger_assistant_id)
      WHERE  e.user_id = auth.uid()
    )
  );

-- Parent can SELECT events for their child's passenger_id.
CREATE POLICY "parent_can_read_child_stop_events"
  ON public.route_stop_events
  FOR SELECT
  USING (
    passenger_id IN (
      SELECT ppc.passenger_id
      FROM   public.passenger_parent_contacts ppc
      JOIN   public.parent_contacts pc ON pc.id = ppc.parent_contact_id
      WHERE  pc.user_id = auth.uid()
    )
  );

-- Dashboard admins can read all.
CREATE POLICY "admin_can_read_all_stop_events"
  ON public.route_stop_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id = auth.uid() AND ur.active = TRUE
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- TRIGGER FUNCTION: notify parents when a stop event is recorded
-- ─────────────────────────────────────────────────────────────────────
-- Fires AFTER INSERT on route_stop_events.
-- Looks up all parents of the passenger and inserts a notifications row
-- per parent with recipient_user_id set to their auth UUID.
-- 'skipped' events do not generate a notification.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_parent_on_stop_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_type   TEXT;
  v_point_name     TEXT;
  v_passenger_name TEXT;
  v_notif_type     TEXT;
  r_parent         RECORD;
BEGIN
  -- 'skipped' events: no parent notification
  IF NEW.event_type = 'skipped' THEN
    RETURN NEW;
  END IF;

  -- Resolve session_type for the route session
  SELECT session_type INTO v_session_type
  FROM   public.route_sessions
  WHERE  id = NEW.route_session_id;

  -- Resolve stop name (nullable)
  IF NEW.route_point_id IS NOT NULL THEN
    SELECT point_name INTO v_point_name
    FROM   public.route_points
    WHERE  id = NEW.route_point_id;
  END IF;

  -- Resolve passenger name (nullable)
  IF NEW.passenger_id IS NOT NULL THEN
    SELECT full_name INTO v_passenger_name
    FROM   public.passengers
    WHERE  id = NEW.passenger_id;
  END IF;

  -- Map event_type to notification_type
  v_notif_type := CASE NEW.event_type
    WHEN 'arrived'     THEN 'driver_at_stop'
    WHEN 'picked_up'   THEN 'child_picked_up'
    WHEN 'dropped_off' THEN 'child_dropped_off'
    WHEN 'no_show'     THEN 'child_no_show'
    ELSE NULL
  END;

  IF v_notif_type IS NULL OR NEW.passenger_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert one notification per parent linked to this passenger
  FOR r_parent IN
    SELECT pc.user_id
    FROM   public.passenger_parent_contacts ppc
    JOIN   public.parent_contacts pc ON pc.id = ppc.parent_contact_id
    WHERE  ppc.passenger_id = NEW.passenger_id
      AND  pc.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (
      notification_type,
      status,
      recipient_user_id,
      details
    ) VALUES (
      v_notif_type,
      'unread',
      r_parent.user_id,
      jsonb_build_object(
        'route_session_id', NEW.route_session_id,
        'route_point_id',   NEW.route_point_id,
        'passenger_id',     NEW.passenger_id,
        'passenger_name',   v_passenger_name,
        'stop_name',        v_point_name,
        'session_type',     v_session_type,
        'event_type',       NEW.event_type,
        'event_at',         NEW.event_at
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_parent_on_stop_event
  AFTER INSERT ON public.route_stop_events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_parent_on_stop_event();

-- ─────────────────────────────────────────────────────────────────────
-- TRIGGER FUNCTION: notify parents when a route session starts / ends
-- ─────────────────────────────────────────────────────────────────────
-- Fires AFTER INSERT OR UPDATE OF started_at, ended_at on route_sessions.
-- On start:  every parent whose child is on the route gets 'trip_started'.
-- On end:    parents whose child WAS processed get 'trip_completed';
--            parents whose child was NOT processed get 'child_not_on_trip'
--            (e.g. absent, or driver didn't record the event — admin must follow up).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_parents_on_session_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r_parent RECORD;
BEGIN
  -- ── Trip started ──────────────────────────────────────────────────
  IF NEW.started_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.started_at IS NULL) THEN

    FOR r_parent IN
      SELECT DISTINCT pc.user_id, p.full_name AS passenger_name
      FROM   public.route_points rp
      JOIN   public.passengers p
             ON p.id = rp.passenger_id
      JOIN   public.passenger_parent_contacts ppc
             ON ppc.passenger_id = rp.passenger_id
      JOIN   public.parent_contacts pc
             ON pc.id = ppc.parent_contact_id
      WHERE  rp.route_id = NEW.route_id
        AND  pc.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (
        notification_type, status, recipient_user_id, details
      ) VALUES (
        'trip_started',
        'unread',
        r_parent.user_id,
        jsonb_build_object(
          'route_session_id', NEW.id,
          'route_id',         NEW.route_id,
          'session_type',     NEW.session_type,
          'started_at',       NEW.started_at,
          'passenger_name',   r_parent.passenger_name
        )
      );
    END LOOP;
  END IF;

  -- ── Trip ended ────────────────────────────────────────────────────
  IF NEW.ended_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.ended_at IS NULL) THEN

    FOR r_parent IN
      SELECT DISTINCT
        pc.user_id,
        p.id   AS passenger_id,
        p.full_name AS passenger_name,
        EXISTS (
          SELECT 1
          FROM   public.route_stop_events rse
          WHERE  rse.route_session_id = NEW.id
            AND  rse.passenger_id     = p.id
            AND  rse.event_type IN ('picked_up', 'dropped_off')
        ) AS was_processed
      FROM   public.route_points rp
      JOIN   public.passengers p
             ON p.id = rp.passenger_id
      JOIN   public.passenger_parent_contacts ppc
             ON ppc.passenger_id = rp.passenger_id
      JOIN   public.parent_contacts pc
             ON pc.id = ppc.parent_contact_id
      WHERE  rp.route_id = NEW.route_id
        AND  pc.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (
        notification_type, status, recipient_user_id, details
      ) VALUES (
        CASE WHEN r_parent.was_processed
             THEN 'trip_completed'
             ELSE 'child_not_on_trip'
        END,
        'unread',
        r_parent.user_id,
        jsonb_build_object(
          'route_session_id', NEW.id,
          'route_id',         NEW.route_id,
          'session_type',     NEW.session_type,
          'ended_at',         NEW.ended_at,
          'passenger_id',     r_parent.passenger_id,
          'passenger_name',   r_parent.passenger_name
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_parents_on_session_change
  AFTER INSERT OR UPDATE OF started_at, ended_at
  ON public.route_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_parents_on_session_change();
