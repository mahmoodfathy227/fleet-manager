-- ====================================================
-- 173_cert_expiry_reminder_cron.sql
--
-- NEW notification type: cert_expiry_reminder
-- Separate from and does NOT touch the old certificate_expiry system.
--
-- Design:
--   - All type-specific data in details JSONB only (no legacy compliance columns)
--   - Severity: expiring_soon (8-30d) / urgent (1-7d) / expired (past, up to 90d)
--   - Cadence: expiring_soon = once per week, urgent/expired = once per day
--   - recipient_user_id:
--       * vehicle certs     → NULL  (admin-only via rbac_notifications_select)
--       * driver certs      → employee's auth UUID  (employee sees their own)
--       * assistant certs   → employee's auth UUID  (employee sees their own)
--       * subject_documents → NULL for vehicles, employee UUID for others
--   - Covers all future document types automatically via subject_documents
--   - Scheduled via pg_cron at midnight UTC every day
--
-- To test manually (Supabase SQL Editor):
--   SELECT create_cert_expiry_reminders();
-- ====================================================

CREATE OR REPLACE FUNCTION create_cert_expiry_reminders()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record             RECORD;
  v_severity           TEXT;
  v_cadence_hours      INTEGER;
  v_last_sent          TIMESTAMPTZ;
  v_entity_type        TEXT;
  v_entity_id          INTEGER;
  v_cert_type          TEXT;
  v_cert_name          TEXT;
  v_expiry_date        DATE;
  v_days_until         INTEGER;
  v_display_name       TEXT;
  v_recipient_user_id  UUID;
  v_subject_doc_id     UUID;
BEGIN

  -- ====================================================
  -- VEHICLE CERTIFICATES  (hardcoded columns on vehicles table)
  -- recipient_user_id = NULL → admin-only visibility
  -- ====================================================
  FOR v_record IN (
    SELECT v.id AS entity_id,
           COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text) AS display_base,
           'registration_expiry_date' AS cert_type, 'Registration Expiry'   AS cert_name, v.registration_expiry_date AS expiry_date
    FROM vehicles v
    WHERE v.registration_expiry_date IS NOT NULL
      AND v.registration_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND v.registration_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT v.id, COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text),
           'plate_expiry_date', 'Plate Expiry', v.plate_expiry_date
    FROM vehicles v
    WHERE v.plate_expiry_date IS NOT NULL
      AND v.plate_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND v.plate_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT v.id, COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text),
           'insurance_expiry_date', 'Insurance', v.insurance_expiry_date
    FROM vehicles v
    WHERE v.insurance_expiry_date IS NOT NULL
      AND v.insurance_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND v.insurance_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT v.id, COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text),
           'mot_date', 'MOT', v.mot_date
    FROM vehicles v
    WHERE v.mot_date IS NOT NULL
      AND v.mot_date >= CURRENT_DATE - INTERVAL '90 days'
      AND v.mot_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT v.id, COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text),
           'tax_date', 'Vehicle Tax', v.tax_date
    FROM vehicles v
    WHERE v.tax_date IS NOT NULL
      AND v.tax_date >= CURRENT_DATE - INTERVAL '90 days'
      AND v.tax_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT v.id, COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text),
           'loler_expiry_date', 'LOLER Certificate', v.loler_expiry_date
    FROM vehicles v
    WHERE v.loler_expiry_date IS NOT NULL
      AND v.loler_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND v.loler_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT v.id, COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text),
           'first_aid_expiry', 'Vehicle First Aid Kit', v.first_aid_expiry
    FROM vehicles v
    WHERE v.first_aid_expiry IS NOT NULL
      AND v.first_aid_expiry >= CURRENT_DATE - INTERVAL '90 days'
      AND v.first_aid_expiry <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT v.id, COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text),
           'fire_extinguisher_expiry', 'Fire Extinguisher', v.fire_extinguisher_expiry
    FROM vehicles v
    WHERE v.fire_extinguisher_expiry IS NOT NULL
      AND v.fire_extinguisher_expiry >= CURRENT_DATE - INTERVAL '90 days'
      AND v.fire_extinguisher_expiry <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    -- PSV PMI: computed due date from last_pmi_date + pmi_weeks
    SELECT v.id, COALESCE(v.vehicle_identifier, v.registration, 'Vehicle ' || v.id::text),
           'pmi_due', 'PSV PMI Interim',
           (v.last_pmi_date + (v.pmi_weeks || ' weeks')::interval)::date
    FROM vehicles v
    WHERE v.vehicle_type = 'PSV'
      AND v.pmi_weeks IS NOT NULL
      AND v.last_pmi_date IS NOT NULL
      AND (v.last_pmi_date + (v.pmi_weeks || ' weeks')::interval)::date >= CURRENT_DATE - INTERVAL '90 days'
      AND (v.last_pmi_date + (v.pmi_weeks || ' weeks')::interval)::date <= CURRENT_DATE + INTERVAL '30 days'
  ) LOOP
    v_entity_type       := 'vehicle';
    v_entity_id         := v_record.entity_id;
    v_cert_type         := v_record.cert_type;
    v_cert_name         := v_record.cert_name;
    v_expiry_date       := v_record.expiry_date;
    v_days_until        := (v_record.expiry_date - CURRENT_DATE)::INTEGER;
    v_display_name      := v_record.display_base || ' — ' || v_record.cert_name;
    v_recipient_user_id := NULL;  -- vehicle certs: admin-only
    v_subject_doc_id    := NULL;

    IF v_days_until < 0 THEN
      v_severity := 'expired';       v_cadence_hours := 24;
    ELSIF v_days_until <= 7 THEN
      v_severity := 'urgent';        v_cadence_hours := 24;
    ELSE
      v_severity := 'expiring_soon'; v_cadence_hours := 168; -- 7 days
    END IF;

    SELECT MAX(created_at) INTO v_last_sent
    FROM notifications
    WHERE notification_type = 'cert_expiry_reminder'
      AND (details->>'entity_type') = v_entity_type
      AND (details->>'entity_id')::INTEGER = v_entity_id
      AND (details->>'cert_type') = v_cert_type;

    IF v_last_sent IS NULL OR v_last_sent < NOW() - (v_cadence_hours || ' hours')::INTERVAL THEN
      INSERT INTO notifications (notification_type, status, recipient_user_id, details)
      VALUES (
        'cert_expiry_reminder',
        'pending',
        v_recipient_user_id,
        jsonb_build_object(
          'entity_type',  v_entity_type,
          'entity_id',    v_entity_id,
          'cert_type',    v_cert_type,
          'cert_name',    v_cert_name,
          'expiry_date',  v_expiry_date::text,
          'severity',     v_severity,
          'display_name', v_display_name
        )
      );
    END IF;
  END LOOP;

  -- ====================================================
  -- DRIVER CERTIFICATES  (hardcoded columns on drivers table)
  -- recipient_user_id = driver's employees.user_id (auth UUID)
  -- ====================================================
  FOR v_record IN (
    SELECT d.employee_id, e.full_name, e.user_id AS recipient_user_id,
           'tas_badge_expiry_date' AS cert_type, 'TAS Badge' AS cert_name, d.tas_badge_expiry_date AS expiry_date
    FROM drivers d JOIN employees e ON e.id = d.employee_id
    WHERE d.tas_badge_expiry_date IS NOT NULL
      AND d.tas_badge_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND d.tas_badge_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT d.employee_id, e.full_name, e.user_id,
           'taxi_badge_expiry_date', 'Taxi Badge', d.taxi_badge_expiry_date
    FROM drivers d JOIN employees e ON e.id = d.employee_id
    WHERE d.taxi_badge_expiry_date IS NOT NULL
      AND d.taxi_badge_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND d.taxi_badge_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT d.employee_id, e.full_name, e.user_id,
           'dbs_expiry_date', 'DBS Certificate', d.dbs_expiry_date
    FROM drivers d JOIN employees e ON e.id = d.employee_id
    WHERE d.dbs_expiry_date IS NOT NULL
      AND d.dbs_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND d.dbs_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT d.employee_id, e.full_name, e.user_id,
           'first_aid_certificate_expiry_date', 'First Aid Certificate', d.first_aid_certificate_expiry_date
    FROM drivers d JOIN employees e ON e.id = d.employee_id
    WHERE d.first_aid_certificate_expiry_date IS NOT NULL
      AND d.first_aid_certificate_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND d.first_aid_certificate_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT d.employee_id, e.full_name, e.user_id,
           'driving_license_expiry_date', 'Driving Licence', d.driving_license_expiry_date
    FROM drivers d JOIN employees e ON e.id = d.employee_id
    WHERE d.driving_license_expiry_date IS NOT NULL
      AND d.driving_license_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND d.driving_license_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
  ) LOOP
    v_entity_type       := 'driver';
    v_entity_id         := v_record.employee_id;
    v_cert_type         := v_record.cert_type;
    v_cert_name         := v_record.cert_name;
    v_expiry_date       := v_record.expiry_date;
    v_days_until        := (v_record.expiry_date - CURRENT_DATE)::INTEGER;
    v_display_name      := COALESCE(v_record.full_name, 'Driver ' || v_record.employee_id::text) || ' — ' || v_record.cert_name;
    v_recipient_user_id := v_record.recipient_user_id;
    v_subject_doc_id    := NULL;

    IF v_days_until < 0 THEN
      v_severity := 'expired';       v_cadence_hours := 24;
    ELSIF v_days_until <= 7 THEN
      v_severity := 'urgent';        v_cadence_hours := 24;
    ELSE
      v_severity := 'expiring_soon'; v_cadence_hours := 168;
    END IF;

    SELECT MAX(created_at) INTO v_last_sent
    FROM notifications
    WHERE notification_type = 'cert_expiry_reminder'
      AND (details->>'entity_type') = v_entity_type
      AND (details->>'entity_id')::INTEGER = v_entity_id
      AND (details->>'cert_type') = v_cert_type;

    IF v_last_sent IS NULL OR v_last_sent < NOW() - (v_cadence_hours || ' hours')::INTERVAL THEN
      INSERT INTO notifications (notification_type, status, recipient_user_id, details)
      VALUES (
        'cert_expiry_reminder',
        'pending',
        v_recipient_user_id,
        jsonb_build_object(
          'entity_type',  v_entity_type,
          'entity_id',    v_entity_id,
          'cert_type',    v_cert_type,
          'cert_name',    v_cert_name,
          'expiry_date',  v_expiry_date::text,
          'severity',     v_severity,
          'display_name', v_display_name
        )
      );
    END IF;
  END LOOP;

  -- ====================================================
  -- ASSISTANT CERTIFICATES  (hardcoded columns on passenger_assistants table)
  -- recipient_user_id = assistant's employees.user_id (auth UUID)
  -- ====================================================
  FOR v_record IN (
    SELECT pa.employee_id, e.full_name, e.user_id AS recipient_user_id,
           'tas_badge_expiry_date' AS cert_type, 'TAS Badge' AS cert_name, pa.tas_badge_expiry_date AS expiry_date
    FROM passenger_assistants pa JOIN employees e ON e.id = pa.employee_id
    WHERE pa.tas_badge_expiry_date IS NOT NULL
      AND pa.tas_badge_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND pa.tas_badge_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    UNION ALL
    SELECT pa.employee_id, e.full_name, e.user_id,
           'dbs_expiry_date', 'DBS Certificate', pa.dbs_expiry_date
    FROM passenger_assistants pa JOIN employees e ON e.id = pa.employee_id
    WHERE pa.dbs_expiry_date IS NOT NULL
      AND pa.dbs_expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND pa.dbs_expiry_date <= CURRENT_DATE + INTERVAL '30 days'
  ) LOOP
    v_entity_type       := 'assistant';
    v_entity_id         := v_record.employee_id;
    v_cert_type         := v_record.cert_type;
    v_cert_name         := v_record.cert_name;
    v_expiry_date       := v_record.expiry_date;
    v_days_until        := (v_record.expiry_date - CURRENT_DATE)::INTEGER;
    v_display_name      := COALESCE(v_record.full_name, 'Assistant ' || v_record.employee_id::text) || ' — ' || v_record.cert_name;
    v_recipient_user_id := v_record.recipient_user_id;
    v_subject_doc_id    := NULL;

    IF v_days_until < 0 THEN
      v_severity := 'expired';       v_cadence_hours := 24;
    ELSIF v_days_until <= 7 THEN
      v_severity := 'urgent';        v_cadence_hours := 24;
    ELSE
      v_severity := 'expiring_soon'; v_cadence_hours := 168;
    END IF;

    SELECT MAX(created_at) INTO v_last_sent
    FROM notifications
    WHERE notification_type = 'cert_expiry_reminder'
      AND (details->>'entity_type') = v_entity_type
      AND (details->>'entity_id')::INTEGER = v_entity_id
      AND (details->>'cert_type') = v_cert_type;

    IF v_last_sent IS NULL OR v_last_sent < NOW() - (v_cadence_hours || ' hours')::INTERVAL THEN
      INSERT INTO notifications (notification_type, status, recipient_user_id, details)
      VALUES (
        'cert_expiry_reminder',
        'pending',
        v_recipient_user_id,
        jsonb_build_object(
          'entity_type',  v_entity_type,
          'entity_id',    v_entity_id,
          'cert_type',    v_cert_type,
          'cert_name',    v_cert_name,
          'expiry_date',  v_expiry_date::text,
          'severity',     v_severity,
          'display_name', v_display_name
        )
      );
    END IF;
  END LOOP;

  -- ====================================================
  -- SUBJECT DOCUMENTS  (dynamic — auto-picks up all future doc types)
  -- Dedup key: subject_document_id (more precise than entity+cert_type)
  -- recipient_user_id:
  --   vehicle subject docs → NULL (admin-only)
  --   driver / PA / employee subject docs → employees.user_id
  -- ====================================================
  FOR v_record IN (
    -- Driver subject documents
    SELECT
      'driver'                                    AS entity_type,
      sd.driver_employee_id                       AS entity_id,
      e.full_name,
      e.user_id                                   AS recipient_user_id,
      COALESCE(NULLIF(r.code, ''), r.name)        AS cert_type,
      r.name                                      AS cert_name,
      sd.expiry_date,
      r.renewal_notice_days,
      sd.id                                       AS subject_document_id
    FROM subject_documents sd
    JOIN document_requirements r ON r.id = sd.requirement_id
    JOIN employees e ON e.id = sd.driver_employee_id
    WHERE sd.subject_type = 'driver'
      AND r.requires_expiry = TRUE
      AND sd.expiry_date IS NOT NULL
      AND sd.status IN ('valid', 'pending')
      AND sd.expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND sd.expiry_date <= CURRENT_DATE + (COALESCE(NULLIF(r.renewal_notice_days, 0), 30) || ' days')::INTERVAL

    UNION ALL
    -- PA subject documents
    SELECT
      'assistant',
      sd.pa_employee_id,
      e.full_name,
      e.user_id,
      COALESCE(NULLIF(r.code, ''), r.name),
      r.name,
      sd.expiry_date,
      r.renewal_notice_days,
      sd.id
    FROM subject_documents sd
    JOIN document_requirements r ON r.id = sd.requirement_id
    JOIN employees e ON e.id = sd.pa_employee_id
    WHERE sd.subject_type = 'pa'
      AND r.requires_expiry = TRUE
      AND sd.expiry_date IS NOT NULL
      AND sd.status IN ('valid', 'pending')
      AND sd.expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND sd.expiry_date <= CURRENT_DATE + (COALESCE(NULLIF(r.renewal_notice_days, 0), 30) || ' days')::INTERVAL

    UNION ALL
    -- Vehicle subject documents (no employee recipient)
    SELECT
      'vehicle',
      sd.vehicle_id,
      NULL::TEXT,
      NULL::UUID,
      COALESCE(NULLIF(r.code, ''), r.name),
      r.name,
      sd.expiry_date,
      r.renewal_notice_days,
      sd.id
    FROM subject_documents sd
    JOIN document_requirements r ON r.id = sd.requirement_id
    WHERE sd.subject_type = 'vehicle'
      AND r.requires_expiry = TRUE
      AND sd.expiry_date IS NOT NULL
      AND sd.status IN ('valid', 'pending')
      AND sd.expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND sd.expiry_date <= CURRENT_DATE + (COALESCE(NULLIF(r.renewal_notice_days, 0), 30) || ' days')::INTERVAL

    UNION ALL
    -- Generic employee subject documents
    SELECT
      'employee',
      sd.employee_id,
      e.full_name,
      e.user_id,
      COALESCE(NULLIF(r.code, ''), r.name),
      r.name,
      sd.expiry_date,
      r.renewal_notice_days,
      sd.id
    FROM subject_documents sd
    JOIN document_requirements r ON r.id = sd.requirement_id
    JOIN employees e ON e.id = sd.employee_id
    WHERE sd.subject_type = 'employee'
      AND r.requires_expiry = TRUE
      AND sd.expiry_date IS NOT NULL
      AND sd.status IN ('valid', 'pending')
      AND sd.expiry_date >= CURRENT_DATE - INTERVAL '90 days'
      AND sd.expiry_date <= CURRENT_DATE + (COALESCE(NULLIF(r.renewal_notice_days, 0), 30) || ' days')::INTERVAL
  ) LOOP
    v_entity_type       := v_record.entity_type;
    v_entity_id         := v_record.entity_id;
    v_cert_type         := v_record.cert_type;
    v_cert_name         := v_record.cert_name;
    v_expiry_date       := v_record.expiry_date;
    v_days_until        := (v_record.expiry_date - CURRENT_DATE)::INTEGER;
    v_display_name      := COALESCE(v_record.full_name, initcap(v_record.entity_type) || ' ' || v_record.entity_id::text) || ' — ' || v_record.cert_name;
    v_recipient_user_id := v_record.recipient_user_id;
    v_subject_doc_id    := v_record.subject_document_id;

    IF v_days_until < 0 THEN
      v_severity := 'expired';       v_cadence_hours := 24;
    ELSIF v_days_until <= 7 THEN
      v_severity := 'urgent';        v_cadence_hours := 24;
    ELSE
      v_severity := 'expiring_soon'; v_cadence_hours := 168;
    END IF;

    -- Use subject_document_id as the dedup key for subject docs
    SELECT MAX(created_at) INTO v_last_sent
    FROM notifications
    WHERE notification_type = 'cert_expiry_reminder'
      AND (details->>'subject_document_id') = v_subject_doc_id::text;

    IF v_last_sent IS NULL OR v_last_sent < NOW() - (v_cadence_hours || ' hours')::INTERVAL THEN
      INSERT INTO notifications (notification_type, status, recipient_user_id, details)
      VALUES (
        'cert_expiry_reminder',
        'pending',
        v_recipient_user_id,
        jsonb_build_object(
          'entity_type',         v_entity_type,
          'entity_id',           v_entity_id,
          'cert_type',           v_cert_type,
          'cert_name',           v_cert_name,
          'expiry_date',         v_expiry_date::text,
          'severity',            v_severity,
          'display_name',        v_display_name,
          'subject_document_id', v_subject_doc_id::text
        )
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'create_cert_expiry_reminders completed successfully';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION create_cert_expiry_reminders() TO authenticated;

COMMENT ON FUNCTION create_cert_expiry_reminders() IS
  'Inserts cert_expiry_reminder notifications for expiring/expired certificates. '
  'Sources: vehicles (hardcoded columns), drivers, passenger_assistants, subject_documents (dynamic). '
  'Severity: expiring_soon (8-30d, weekly cadence) | urgent (1-7d, daily) | expired (past, daily). '
  'Vehicle certs: recipient_user_id = NULL (admin-only). Driver/PA certs target the employee auth UUID. '
  'Does NOT touch the old certificate_expiry system. Scheduled via pg_cron at midnight UTC.';

-- ====================================================
-- Schedule via pg_cron (midnight UTC daily)
-- Safe to re-run: removes old job if it already exists
-- ====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cert-expiry-reminders') THEN
    PERFORM cron.unschedule('cert-expiry-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'cert-expiry-reminders',
  '0 0 * * *',
  'SELECT create_cert_expiry_reminders()'
);
