-- Add PSV PMI (Periodic Maintenance Inspection) interim check to certificate notifications.
-- Run after 136_add_vehicle_pmi_psv.sql. Next PMI due = last_pmi_date + pmi_weeks.
-- ====================================================

-- Patch: add one UNION to the vehicle certificates loop in create_certificate_notifications.
-- We replace the function with the same body as 097 plus the PSV PMI union below.

CREATE OR REPLACE FUNCTION create_certificate_notifications()
RETURNS void 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_threshold_days INTEGER := 30;
  v_record RECORD;
  v_employee_id INTEGER;
  v_employee_email VARCHAR;
  v_vehicle_assigned_employee_id INTEGER;
  v_vehicle_assigned_email VARCHAR;
  v_token VARCHAR;
BEGIN
  DELETE FROM notifications 
  WHERE status IN ('resolved', 'dismissed') 
  AND created_at < CURRENT_DATE - INTERVAL '90 days';

  FOR v_record IN (
    SELECT v.id AS vehicle_id, v.vehicle_identifier, v.registration, 'registration_expiry_date' AS cert_type, 'Plate Expiry' AS cert_name, v.registration_expiry_date AS expiry_date, (v.registration_expiry_date - CURRENT_DATE)::INTEGER AS days_until FROM vehicles v WHERE v.registration_expiry_date IS NOT NULL AND v.registration_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND v.registration_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT v.id, v.vehicle_identifier, v.registration, 'plate_expiry_date', 'Plate Expiry', v.plate_expiry_date, (v.plate_expiry_date - CURRENT_DATE)::INTEGER FROM vehicles v WHERE v.plate_expiry_date IS NOT NULL AND v.plate_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND v.plate_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT v.id, v.vehicle_identifier, v.registration, 'insurance_expiry_date', 'Insurance Expiry', v.insurance_expiry_date, (v.insurance_expiry_date - CURRENT_DATE)::INTEGER FROM vehicles v WHERE v.insurance_expiry_date IS NOT NULL AND v.insurance_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND v.insurance_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT v.id, v.vehicle_identifier, v.registration, 'mot_date', 'MOT Date', v.mot_date, (v.mot_date - CURRENT_DATE)::INTEGER FROM vehicles v WHERE v.mot_date IS NOT NULL AND v.mot_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND v.mot_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT v.id, v.vehicle_identifier, v.registration, 'tax_date', 'Tax Date', v.tax_date, (v.tax_date - CURRENT_DATE)::INTEGER FROM vehicles v WHERE v.tax_date IS NOT NULL AND v.tax_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND v.tax_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT v.id, v.vehicle_identifier, v.registration, 'loler_expiry_date', 'LOLER Expiry', v.loler_expiry_date, (v.loler_expiry_date - CURRENT_DATE)::INTEGER FROM vehicles v WHERE v.loler_expiry_date IS NOT NULL AND v.loler_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND v.loler_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT v.id, v.vehicle_identifier, v.registration, 'first_aid_expiry', 'First Aid Expiry', v.first_aid_expiry, (v.first_aid_expiry - CURRENT_DATE)::INTEGER FROM vehicles v WHERE v.first_aid_expiry IS NOT NULL AND v.first_aid_expiry <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND v.first_aid_expiry >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT v.id, v.vehicle_identifier, v.registration, 'fire_extinguisher_expiry', 'Fire Extinguisher Expiry', v.fire_extinguisher_expiry, (v.fire_extinguisher_expiry - CURRENT_DATE)::INTEGER FROM vehicles v WHERE v.fire_extinguisher_expiry IS NOT NULL AND v.fire_extinguisher_expiry <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND v.fire_extinguisher_expiry >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL
    SELECT v.id, v.vehicle_identifier, v.registration, 'pmi_due', 'PMI Interim Due', (v.last_pmi_date + (v.pmi_weeks || ' weeks')::interval)::date, ((v.last_pmi_date + (v.pmi_weeks || ' weeks')::interval)::date - CURRENT_DATE)::INTEGER FROM vehicles v WHERE v.vehicle_type = 'PSV' AND v.pmi_weeks IS NOT NULL AND v.last_pmi_date IS NOT NULL AND (v.last_pmi_date + (v.pmi_weeks || ' weeks')::interval)::date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND (v.last_pmi_date + (v.pmi_weeks || ' weeks')::interval)::date >= CURRENT_DATE - INTERVAL '7 days'
  ) LOOP
    SELECT va.employee_id, e.personal_email INTO v_vehicle_assigned_employee_id, v_vehicle_assigned_email FROM vehicle_assignments va LEFT JOIN employees e ON e.id = va.employee_id WHERE va.vehicle_id = v_record.vehicle_id AND va.active = TRUE ORDER BY va.assigned_from DESC LIMIT 1;
    BEGIN v_token := encode(gen_random_bytes(32), 'hex'); EXCEPTION WHEN OTHERS THEN v_token := md5(v_record.vehicle_id::text || v_record.cert_type || CURRENT_TIMESTAMP::text || random()::text); END;
    INSERT INTO notifications (notification_type, entity_type, entity_id, certificate_type, certificate_name, expiry_date, days_until_expiry, recipient_employee_id, recipient_email, email_token)
    SELECT 'certificate_expiry', 'vehicle', v_record.vehicle_id, v_record.cert_type, v_record.cert_name, v_record.expiry_date, v_record.days_until, v_vehicle_assigned_employee_id, v_vehicle_assigned_email, v_token
    WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_type = 'vehicle' AND n.entity_id = v_record.vehicle_id AND n.certificate_type = v_record.cert_type AND n.status IN ('pending', 'sent') AND n.expiry_date = v_record.expiry_date);
  END LOOP;

  FOR v_record IN (
    SELECT d.employee_id, e.full_name, e.personal_email, 'tas_badge_expiry_date' AS cert_type, 'TAS Badge' AS cert_name, d.tas_badge_expiry_date AS expiry_date, (d.tas_badge_expiry_date - CURRENT_DATE)::INTEGER AS days_until FROM drivers d JOIN employees e ON e.id = d.employee_id WHERE d.tas_badge_expiry_date IS NOT NULL AND d.tas_badge_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND d.tas_badge_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL SELECT d.employee_id, e.full_name, e.personal_email, 'taxi_badge_expiry_date', 'Taxi Badge', d.taxi_badge_expiry_date, (d.taxi_badge_expiry_date - CURRENT_DATE)::INTEGER FROM drivers d JOIN employees e ON e.id = d.employee_id WHERE d.taxi_badge_expiry_date IS NOT NULL AND d.taxi_badge_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND d.taxi_badge_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL SELECT d.employee_id, e.full_name, e.personal_email, 'dbs_expiry_date', 'DBS Certificate', d.dbs_expiry_date, (d.dbs_expiry_date - CURRENT_DATE)::INTEGER FROM drivers d JOIN employees e ON e.id = d.employee_id WHERE d.dbs_expiry_date IS NOT NULL AND d.dbs_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND d.dbs_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL SELECT d.employee_id, e.full_name, e.personal_email, 'first_aid_certificate_expiry_date', 'First Aid Certificate', d.first_aid_certificate_expiry_date, (d.first_aid_certificate_expiry_date - CURRENT_DATE)::INTEGER FROM drivers d JOIN employees e ON e.id = d.employee_id WHERE d.first_aid_certificate_expiry_date IS NOT NULL AND d.first_aid_certificate_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND d.first_aid_certificate_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL SELECT d.employee_id, e.full_name, e.personal_email, 'driving_license_expiry_date', 'Driving License', d.driving_license_expiry_date, (d.driving_license_expiry_date - CURRENT_DATE)::INTEGER FROM drivers d JOIN employees e ON e.id = d.employee_id WHERE d.driving_license_expiry_date IS NOT NULL AND d.driving_license_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND d.driving_license_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
  ) LOOP
    BEGIN v_token := encode(gen_random_bytes(32), 'hex'); EXCEPTION WHEN OTHERS THEN v_token := md5(v_record.employee_id::text || v_record.cert_type || CURRENT_TIMESTAMP::text || random()::text); END;
    INSERT INTO notifications (notification_type, entity_type, entity_id, certificate_type, certificate_name, expiry_date, days_until_expiry, recipient_employee_id, recipient_email, email_token)
    SELECT 'certificate_expiry', 'driver', v_record.employee_id, v_record.cert_type, v_record.cert_name, v_record.expiry_date, v_record.days_until, v_record.employee_id, v_record.personal_email, v_token
    WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_type = 'driver' AND n.entity_id = v_record.employee_id AND n.certificate_type = v_record.cert_type AND n.status IN ('pending', 'sent') AND n.expiry_date = v_record.expiry_date);
  END LOOP;

  FOR v_record IN (
    SELECT pa.employee_id, e.full_name, e.personal_email, 'tas_badge_expiry_date' AS cert_type, 'TAS Badge' AS cert_name, pa.tas_badge_expiry_date AS expiry_date, (pa.tas_badge_expiry_date - CURRENT_DATE)::INTEGER AS days_until FROM passenger_assistants pa JOIN employees e ON e.id = pa.employee_id WHERE pa.tas_badge_expiry_date IS NOT NULL AND pa.tas_badge_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND pa.tas_badge_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL SELECT pa.employee_id, e.full_name, e.personal_email, 'dbs_expiry_date', 'DBS Certificate', pa.dbs_expiry_date, (pa.dbs_expiry_date - CURRENT_DATE)::INTEGER FROM passenger_assistants pa JOIN employees e ON e.id = pa.employee_id WHERE pa.dbs_expiry_date IS NOT NULL AND pa.dbs_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL AND pa.dbs_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
  ) LOOP
    BEGIN v_token := encode(gen_random_bytes(32), 'hex'); EXCEPTION WHEN OTHERS THEN v_token := md5(v_record.employee_id::text || v_record.cert_type || CURRENT_TIMESTAMP::text || random()::text); END;
    INSERT INTO notifications (notification_type, entity_type, entity_id, certificate_type, certificate_name, expiry_date, days_until_expiry, recipient_employee_id, recipient_email, email_token)
    SELECT 'certificate_expiry', 'assistant', v_record.employee_id, v_record.cert_type, v_record.cert_name, v_record.expiry_date, v_record.days_until, v_record.employee_id, v_record.personal_email, v_token
    WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_type = 'assistant' AND n.entity_id = v_record.employee_id AND n.certificate_type = v_record.cert_type AND n.status IN ('pending', 'sent') AND n.expiry_date = v_record.expiry_date);
  END LOOP;

  FOR v_record IN (
    SELECT 'driver' AS entity_type, sd.id AS subject_document_id, sd.driver_employee_id AS entity_id, e.personal_email AS recipient_email, sd.driver_employee_id AS recipient_employee_id, COALESCE(NULLIF(r.code, ''), r.name) AS cert_type, r.name AS cert_name, sd.expiry_date AS expiry_date, (sd.expiry_date - CURRENT_DATE)::INTEGER AS days_until FROM subject_documents sd JOIN document_requirements r ON r.id = sd.requirement_id JOIN employees e ON e.id = sd.driver_employee_id WHERE sd.subject_type = 'driver' AND r.requires_expiry = TRUE AND sd.expiry_date IS NOT NULL AND sd.status IN ('valid', 'pending') AND sd.expiry_date <= CURRENT_DATE + (COALESCE(NULLIF(r.renewal_notice_days, 0), 30) || ' days')::INTERVAL AND sd.expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL SELECT 'assistant', sd.id, sd.pa_employee_id, e.personal_email, sd.pa_employee_id, COALESCE(NULLIF(r.code, ''), r.name), r.name, sd.expiry_date, (sd.expiry_date - CURRENT_DATE)::INTEGER FROM subject_documents sd JOIN document_requirements r ON r.id = sd.requirement_id JOIN employees e ON e.id = sd.pa_employee_id WHERE sd.subject_type = 'pa' AND r.requires_expiry = TRUE AND sd.expiry_date IS NOT NULL AND sd.status IN ('valid', 'pending') AND sd.expiry_date <= CURRENT_DATE + (COALESCE(NULLIF(r.renewal_notice_days, 0), 30) || ' days')::INTERVAL AND sd.expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL SELECT 'vehicle', sd.id, sd.vehicle_id, NULL::VARCHAR, NULL::INTEGER, COALESCE(NULLIF(r.code, ''), r.name), r.name, sd.expiry_date, (sd.expiry_date - CURRENT_DATE)::INTEGER FROM subject_documents sd JOIN document_requirements r ON r.id = sd.requirement_id WHERE sd.subject_type = 'vehicle' AND r.requires_expiry = TRUE AND sd.expiry_date IS NOT NULL AND sd.status IN ('valid', 'pending') AND sd.expiry_date <= CURRENT_DATE + (COALESCE(NULLIF(r.renewal_notice_days, 0), 30) || ' days')::INTERVAL AND sd.expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    UNION ALL SELECT 'employee', sd.id, sd.employee_id, e.personal_email, sd.employee_id, COALESCE(NULLIF(r.code, ''), r.name), r.name, sd.expiry_date, (sd.expiry_date - CURRENT_DATE)::INTEGER FROM subject_documents sd JOIN document_requirements r ON r.id = sd.requirement_id JOIN employees e ON e.id = sd.employee_id WHERE sd.subject_type = 'employee' AND r.requires_expiry = TRUE AND sd.expiry_date IS NOT NULL AND sd.status IN ('valid', 'pending') AND sd.expiry_date <= CURRENT_DATE + (COALESCE(NULLIF(r.renewal_notice_days, 0), 30) || ' days')::INTERVAL AND sd.expiry_date >= CURRENT_DATE - INTERVAL '7 days'
  ) LOOP
    IF v_record.entity_type = 'vehicle' THEN
      SELECT va.employee_id, e.personal_email INTO v_vehicle_assigned_employee_id, v_vehicle_assigned_email FROM vehicle_assignments va LEFT JOIN employees e ON e.id = va.employee_id WHERE va.vehicle_id = v_record.entity_id AND va.active = TRUE ORDER BY va.assigned_from DESC LIMIT 1;
      v_employee_id := v_vehicle_assigned_employee_id; v_employee_email := v_vehicle_assigned_email;
    ELSE v_employee_id := v_record.recipient_employee_id; v_employee_email := v_record.recipient_email; END IF;
    BEGIN v_token := encode(gen_random_bytes(32), 'hex'); EXCEPTION WHEN OTHERS THEN v_token := md5(v_record.entity_id::text || v_record.cert_type || CURRENT_TIMESTAMP::text || random()::text); END;
    INSERT INTO notifications (notification_type, entity_type, entity_id, certificate_type, certificate_name, expiry_date, days_until_expiry, recipient_employee_id, recipient_email, email_token, subject_document_id)
    SELECT 'certificate_expiry', v_record.entity_type, v_record.entity_id, v_record.cert_type, v_record.cert_name, v_record.expiry_date, v_record.days_until, v_employee_id, v_employee_email, v_token, v_record.subject_document_id
    WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.subject_document_id = v_record.subject_document_id AND n.status IN ('pending', 'sent') AND n.expiry_date = v_record.expiry_date);
  END LOOP;
  RAISE NOTICE 'Certificate notifications created/updated successfully';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION create_certificate_notifications() TO authenticated;
COMMENT ON FUNCTION create_certificate_notifications() IS 'Creates notifications for expiring certificates (vehicles incl. PSV PMI, drivers, assistants). Run daily via cron.';
