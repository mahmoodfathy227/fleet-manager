-- ====================================================
-- Fix RLS policies for notifications table
-- ====================================================
-- This migration fixes the Row Level Security issue
-- Run this if you've already run 052_create_notifications_system.sql

-- Enable pgcrypto extension for gen_random_bytes function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to read notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to delete notifications" ON notifications;

-- Recreate all policies
CREATE POLICY "Allow authenticated users to read notifications" 
  ON notifications FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to insert notifications" 
  ON notifications FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update notifications" 
  ON notifications FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to delete notifications" 
  ON notifications FOR DELETE 
  TO authenticated 
  USING (true);

-- Update function to use SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION create_certificate_notifications()
RETURNS void 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_threshold_days INTEGER := 30; -- Create notifications for certificates expiring within 30 days
  v_record RECORD;
  v_employee_id INTEGER;
  v_employee_email VARCHAR;
  v_vehicle_assigned_employee_id INTEGER;
  v_vehicle_assigned_email VARCHAR;
  v_token VARCHAR;
BEGIN
  -- Clear old resolved/dismissed notifications that are older than 90 days
  DELETE FROM notifications 
  WHERE status IN ('resolved', 'dismissed') 
  AND created_at < CURRENT_DATE - INTERVAL '90 days';

  -- ====================================================
  -- VEHICLE CERTIFICATES
  -- ====================================================
  FOR v_record IN (
    SELECT 
      v.id AS vehicle_id,
      v.vehicle_identifier,
      v.registration,
      'registration_expiry_date' AS cert_type,
      'Registration Expiry' AS cert_name,
      v.registration_expiry_date AS expiry_date,
      (v.registration_expiry_date - CURRENT_DATE)::INTEGER AS days_until
    FROM vehicles v
    WHERE v.registration_expiry_date IS NOT NULL
      AND v.registration_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND v.registration_expiry_date >= CURRENT_DATE - INTERVAL '7 days' -- Include recently expired (7 days grace)
    
    UNION ALL
    
    SELECT 
      v.id AS vehicle_id,
      v.vehicle_identifier,
      v.registration,
      'plate_expiry_date' AS cert_type,
      'Plate Expiry' AS cert_name,
      v.plate_expiry_date AS expiry_date,
      (v.plate_expiry_date - CURRENT_DATE)::INTEGER AS days_until
    FROM vehicles v
    WHERE v.plate_expiry_date IS NOT NULL
      AND v.plate_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND v.plate_expiry_date >= CURRENT_DATE - INTERVAL '7 days' -- Include recently expired (7 days grace)
    
    UNION ALL
    
    SELECT 
      v.id,
      v.vehicle_identifier,
      v.registration,
      'insurance_expiry_date',
      'Insurance Expiry',
      v.insurance_expiry_date,
      (v.insurance_expiry_date - CURRENT_DATE)::INTEGER
    FROM vehicles v
    WHERE v.insurance_expiry_date IS NOT NULL
      AND v.insurance_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND v.insurance_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      v.id,
      v.vehicle_identifier,
      v.registration,
      'mot_date',
      'MOT Date',
      v.mot_date,
      (v.mot_date - CURRENT_DATE)::INTEGER
    FROM vehicles v
    WHERE v.mot_date IS NOT NULL
      AND v.mot_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND v.mot_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      v.id,
      v.vehicle_identifier,
      v.registration,
      'tax_date',
      'Tax Date',
      v.tax_date,
      (v.tax_date - CURRENT_DATE)::INTEGER
    FROM vehicles v
    WHERE v.tax_date IS NOT NULL
      AND v.tax_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND v.tax_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      v.id,
      v.vehicle_identifier,
      v.registration,
      'loler_expiry_date',
      'LOLER Expiry',
      v.loler_expiry_date,
      (v.loler_expiry_date - CURRENT_DATE)::INTEGER
    FROM vehicles v
    WHERE v.loler_expiry_date IS NOT NULL
      AND v.loler_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND v.loler_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      v.id,
      v.vehicle_identifier,
      v.registration,
      'first_aid_expiry',
      'First Aid Expiry',
      v.first_aid_expiry,
      (v.first_aid_expiry - CURRENT_DATE)::INTEGER
    FROM vehicles v
    WHERE v.first_aid_expiry IS NOT NULL
      AND v.first_aid_expiry <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND v.first_aid_expiry >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      v.id,
      v.vehicle_identifier,
      v.registration,
      'fire_extinguisher_expiry',
      'Fire Extinguisher Expiry',
      v.fire_extinguisher_expiry,
      (v.fire_extinguisher_expiry - CURRENT_DATE)::INTEGER
    FROM vehicles v
    WHERE v.fire_extinguisher_expiry IS NOT NULL
      AND v.fire_extinguisher_expiry <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND v.fire_extinguisher_expiry >= CURRENT_DATE - INTERVAL '7 days'
  ) LOOP
    -- Get assigned employee for vehicle
    SELECT va.employee_id, e.personal_email
    INTO v_vehicle_assigned_employee_id, v_vehicle_assigned_email
    FROM vehicle_assignments va
    LEFT JOIN employees e ON e.id = va.employee_id
    WHERE va.vehicle_id = v_record.vehicle_id
      AND va.active = TRUE
    ORDER BY va.assigned_from DESC
    LIMIT 1;

    -- Generate unique token with fallback
    BEGIN
      v_token := encode(gen_random_bytes(32), 'hex');
    EXCEPTION WHEN OTHERS THEN
      -- Fallback if pgcrypto is not available
      v_token := md5(v_record.vehicle_id::text || v_record.cert_type || CURRENT_TIMESTAMP::text || random()::text);
    END;

    -- Create notification if it doesn't already exist
    INSERT INTO notifications (
      notification_type,
      entity_type,
      entity_id,
      certificate_type,
      certificate_name,
      expiry_date,
      days_until_expiry,
      recipient_employee_id,
      recipient_email,
      email_token
    )
    SELECT 
      'vehicle_certificate',
      'vehicle',
      v_record.vehicle_id,
      v_record.cert_type,
      v_record.cert_name,
      v_record.expiry_date,
      v_record.days_until,
      v_vehicle_assigned_employee_id,
      v_vehicle_assigned_email,
      v_token
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.entity_type = 'vehicle'
        AND n.entity_id = v_record.vehicle_id
        AND n.certificate_type = v_record.cert_type
        AND n.status = 'pending'
    );
  END LOOP;

  -- ====================================================
  -- DRIVER CERTIFICATES
  -- ====================================================
  FOR v_record IN (
    SELECT 
      d.employee_id,
      e.full_name,
      e.personal_email,
      'tas_badge_expiry_date' AS cert_type,
      'TAS Badge' AS cert_name,
      d.tas_badge_expiry_date AS expiry_date,
      (d.tas_badge_expiry_date - CURRENT_DATE)::INTEGER AS days_until
    FROM drivers d
    JOIN employees e ON e.id = d.employee_id
    WHERE d.tas_badge_expiry_date IS NOT NULL
      AND d.tas_badge_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND d.tas_badge_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      d.employee_id,
      e.full_name,
      e.personal_email,
      'taxi_badge_expiry_date',
      'Taxi Badge',
      d.taxi_badge_expiry_date,
      (d.taxi_badge_expiry_date - CURRENT_DATE)::INTEGER
    FROM drivers d
    JOIN employees e ON e.id = d.employee_id
    WHERE d.taxi_badge_expiry_date IS NOT NULL
      AND d.taxi_badge_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND d.taxi_badge_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      d.employee_id,
      e.full_name,
      e.personal_email,
      'dbs_expiry_date',
      'DBS Certificate',
      d.dbs_expiry_date,
      (d.dbs_expiry_date - CURRENT_DATE)::INTEGER
    FROM drivers d
    JOIN employees e ON e.id = d.employee_id
    WHERE d.dbs_expiry_date IS NOT NULL
      AND d.dbs_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND d.dbs_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      d.employee_id,
      e.full_name,
      e.personal_email,
      'first_aid_certificate_expiry_date',
      'First Aid Certificate',
      d.first_aid_certificate_expiry_date,
      (d.first_aid_certificate_expiry_date - CURRENT_DATE)::INTEGER
    FROM drivers d
    JOIN employees e ON e.id = d.employee_id
    WHERE d.first_aid_certificate_expiry_date IS NOT NULL
      AND d.first_aid_certificate_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND d.first_aid_certificate_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      d.employee_id,
      e.full_name,
      e.personal_email,
      'driving_license_expiry_date',
      'Driving License',
      d.driving_license_expiry_date,
      (d.driving_license_expiry_date - CURRENT_DATE)::INTEGER
    FROM drivers d
    JOIN employees e ON e.id = d.employee_id
    WHERE d.driving_license_expiry_date IS NOT NULL
      AND d.driving_license_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND d.driving_license_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
  ) LOOP
    -- Generate unique token with fallback
    BEGIN
      v_token := encode(gen_random_bytes(32), 'hex');
    EXCEPTION WHEN OTHERS THEN
      v_token := md5(v_record.employee_id::text || v_record.cert_type || CURRENT_TIMESTAMP::text || random()::text);
    END;

    INSERT INTO notifications (
      notification_type,
      entity_type,
      entity_id,
      certificate_type,
      certificate_name,
      expiry_date,
      days_until_expiry,
      recipient_employee_id,
      recipient_email,
      email_token
    )
    SELECT 
      'driver_certificate',
      'driver',
      v_record.employee_id,
      v_record.cert_type,
      v_record.cert_name,
      v_record.expiry_date,
      v_record.days_until,
      v_record.employee_id,
      v_record.personal_email,
      v_token
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.entity_type = 'driver'
        AND n.entity_id = v_record.employee_id
        AND n.certificate_type = v_record.cert_type
        AND n.status = 'pending'
    );
  END LOOP;

  -- ====================================================
  -- PASSENGER ASSISTANT CERTIFICATES
  -- ====================================================
  FOR v_record IN (
    SELECT 
      pa.employee_id,
      e.full_name,
      e.personal_email,
      'tas_badge_expiry_date' AS cert_type,
      'TAS Badge' AS cert_name,
      pa.tas_badge_expiry_date AS expiry_date,
      (pa.tas_badge_expiry_date - CURRENT_DATE)::INTEGER AS days_until
    FROM passenger_assistants pa
    JOIN employees e ON e.id = pa.employee_id
    WHERE pa.tas_badge_expiry_date IS NOT NULL
      AND pa.tas_badge_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND pa.tas_badge_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
    
    UNION ALL
    
    SELECT 
      pa.employee_id,
      e.full_name,
      e.personal_email,
      'dbs_expiry_date',
      'DBS Certificate',
      pa.dbs_expiry_date,
      (pa.dbs_expiry_date - CURRENT_DATE)::INTEGER
    FROM passenger_assistants pa
    JOIN employees e ON e.id = pa.employee_id
    WHERE pa.dbs_expiry_date IS NOT NULL
      AND pa.dbs_expiry_date <= CURRENT_DATE + (notification_threshold_days || ' days')::INTERVAL
      AND pa.dbs_expiry_date >= CURRENT_DATE - INTERVAL '7 days'
  ) LOOP
    -- Generate unique token with fallback
    BEGIN
      v_token := encode(gen_random_bytes(32), 'hex');
    EXCEPTION WHEN OTHERS THEN
      v_token := md5(v_record.employee_id::text || v_record.cert_type || CURRENT_TIMESTAMP::text || random()::text);
    END;

    INSERT INTO notifications (
      notification_type,
      entity_type,
      entity_id,
      certificate_type,
      certificate_name,
      expiry_date,
      days_until_expiry,
      recipient_employee_id,
      recipient_email,
      email_token
    )
    SELECT 
      'assistant_certificate',
      'assistant',
      v_record.employee_id,
      v_record.cert_type,
      v_record.cert_name,
      v_record.expiry_date,
      v_record.days_until,
      v_record.employee_id,
      v_record.personal_email,
      v_token
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.entity_type = 'assistant'
        AND n.entity_id = v_record.employee_id
        AND n.certificate_type = v_record.cert_type
        AND n.status = 'pending'
    );
  END LOOP;

  -- Mark notifications as resolved if certificates are now valid
  UPDATE notifications n
  SET status = 'resolved',
      resolved_at = CURRENT_TIMESTAMP
  WHERE n.status = 'pending'
    AND (
      (n.entity_type = 'vehicle' AND NOT EXISTS (
        SELECT 1 FROM vehicles v
        WHERE v.id = n.entity_id
          AND (
            (n.certificate_type = 'registration_expiry_date' AND (v.registration_expiry_date IS NULL OR v.registration_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'plate_expiry_date' AND (v.plate_expiry_date IS NULL OR v.plate_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'insurance_expiry_date' AND (v.insurance_expiry_date IS NULL OR v.insurance_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'mot_date' AND (v.mot_date IS NULL OR v.mot_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'tax_date' AND (v.tax_date IS NULL OR v.tax_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'loler_expiry_date' AND (v.loler_expiry_date IS NULL OR v.loler_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'first_aid_expiry' AND (v.first_aid_expiry IS NULL OR v.first_aid_expiry > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'fire_extinguisher_expiry' AND (v.fire_extinguisher_expiry IS NULL OR v.fire_extinguisher_expiry > CURRENT_DATE + INTERVAL '30 days'))
          )
      )) OR
      (n.entity_type = 'driver' AND NOT EXISTS (
        SELECT 1 FROM drivers d
        WHERE d.employee_id = n.entity_id
          AND (
            (n.certificate_type = 'tas_badge_expiry_date' AND (d.tas_badge_expiry_date IS NULL OR d.tas_badge_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'taxi_badge_expiry_date' AND (d.taxi_badge_expiry_date IS NULL OR d.taxi_badge_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'dbs_expiry_date' AND (d.dbs_expiry_date IS NULL OR d.dbs_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'first_aid_certificate_expiry_date' AND (d.first_aid_certificate_expiry_date IS NULL OR d.first_aid_certificate_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'driving_license_expiry_date' AND (d.driving_license_expiry_date IS NULL OR d.driving_license_expiry_date > CURRENT_DATE + INTERVAL '30 days'))
          )
      )) OR
      (n.entity_type = 'assistant' AND NOT EXISTS (
        SELECT 1 FROM passenger_assistants pa
        WHERE pa.employee_id = n.entity_id
          AND (
            (n.certificate_type = 'tas_badge_expiry_date' AND (pa.tas_badge_expiry_date IS NULL OR pa.tas_badge_expiry_date > CURRENT_DATE + INTERVAL '30 days')) OR
            (n.certificate_type = 'dbs_expiry_date' AND (pa.dbs_expiry_date IS NULL OR pa.dbs_expiry_date > CURRENT_DATE + INTERVAL '30 days'))
          )
      ))
    );

  RAISE NOTICE 'Certificate notifications created/updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_certificate_notifications() TO authenticated;

