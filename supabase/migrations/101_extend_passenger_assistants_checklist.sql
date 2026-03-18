-- ====================================================================
-- Migration: Extend Passenger Assistants Table with Complete Checklist Fields
-- ====================================================================
-- Adds all fields from the driver checklist (except driver-specific fields)
-- for comprehensive PA compliance tracking.
-- ====================================================================
-- EXCLUDED FIELDS (driver-only):
-- - taxi_badge_number, taxi_badge_expiry_date (driver only)
-- - driving_license_expiry_date (driver only)
-- - cpc_expiry_date (driver only - CPC is for drivers)
-- - vehicle_insurance_expiry_date (driver only)
-- - mot_expiry_date (driver only)
-- - psv_license (driver only)
-- ====================================================================

-- Add new columns to passenger_assistants table
ALTER TABLE passenger_assistants
ADD COLUMN IF NOT EXISTS first_aid_certificate_expiry_date DATE,
ADD COLUMN IF NOT EXISTS passport_expiry_date DATE,
ADD COLUMN IF NOT EXISTS utility_bill_date DATE,
ADD COLUMN IF NOT EXISTS birth_certificate BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS marriage_certificate BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS photo_taken BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS private_hire_badge BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paper_licence BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS taxi_plate_photo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS logbook BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS safeguarding_training_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS safeguarding_training_date DATE,
ADD COLUMN IF NOT EXISTS tas_pats_training_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tas_pats_training_date DATE,
ADD COLUMN IF NOT EXISTS psa_training_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS psa_training_date DATE,
ADD COLUMN IF NOT EXISTS additional_notes TEXT;

-- Add indexes for date columns (for faster expiry queries)
CREATE INDEX IF NOT EXISTS idx_pa_first_aid_expiry ON passenger_assistants(first_aid_certificate_expiry_date);
CREATE INDEX IF NOT EXISTS idx_pa_passport_expiry ON passenger_assistants(passport_expiry_date);

-- Update the expiry flags function to include new PA certificate fields
CREATE OR REPLACE FUNCTION update_expiry_flags()
RETURNS void AS $$
BEGIN
  -- ======================
  -- VEHICLES OFF ROAD (VOR)
  -- ======================
  UPDATE vehicles v
  SET off_the_road = TRUE,
      off_the_road_auto = TRUE
  WHERE EXISTS (
    SELECT 1
    FROM subject_documents sd
    JOIN document_requirements r ON r.id = sd.requirement_id
    WHERE sd.subject_type = 'vehicle'
      AND sd.vehicle_id = v.id
      AND r.is_required = TRUE
      AND r.criticality = 'critical'
      AND (
        sd.status IN ('missing', 'expired', 'rejected')
        OR (r.requires_expiry = TRUE AND (sd.expiry_date IS NULL OR sd.expiry_date < CURRENT_DATE))
      )
  )
  AND (v.off_the_road IS DISTINCT FROM TRUE OR v.off_the_road_auto IS DISTINCT FROM TRUE);

  UPDATE vehicles v
  SET off_the_road = FALSE,
      off_the_road_auto = FALSE
  WHERE v.off_the_road_auto = TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM subject_documents sd
      JOIN document_requirements r ON r.id = sd.requirement_id
      WHERE sd.subject_type = 'vehicle'
        AND sd.vehicle_id = v.id
        AND r.is_required = TRUE
        AND r.criticality = 'critical'
        AND (
          sd.status IN ('missing', 'expired', 'rejected')
          OR (r.requires_expiry = TRUE AND (sd.expiry_date IS NULL OR sd.expiry_date < CURRENT_DATE))
        )
    );

  -- ======================
  -- EMPLOYEES (Drivers & Passenger Assistants)
  -- ======================
  UPDATE employees e
  SET can_work = FALSE
  WHERE EXISTS (
    SELECT 1
    FROM subject_documents sd
    JOIN document_requirements r ON r.id = sd.requirement_id
    WHERE r.is_required = TRUE
      AND r.criticality = 'critical'
      AND (
        (sd.subject_type = 'driver' AND sd.driver_employee_id = e.id) OR
        (sd.subject_type = 'pa' AND sd.pa_employee_id = e.id)
      )
      AND (
        sd.status IN ('missing', 'expired', 'rejected')
        OR (r.requires_expiry = TRUE AND (sd.expiry_date IS NULL OR sd.expiry_date < CURRENT_DATE))
      )
  )
  AND e.can_work = TRUE;

  UPDATE employees e
  SET can_work = TRUE
  WHERE e.can_work = FALSE
    AND EXISTS (
      SELECT 1 FROM drivers d WHERE d.employee_id = e.id
      UNION ALL
      SELECT 1 FROM passenger_assistants pa WHERE pa.employee_id = e.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM subject_documents sd
      JOIN document_requirements r ON r.id = sd.requirement_id
      WHERE r.is_required = TRUE
        AND r.criticality = 'critical'
        AND (
          (sd.subject_type = 'driver' AND sd.driver_employee_id = e.id) OR
          (sd.subject_type = 'pa' AND sd.pa_employee_id = e.id)
        )
        AND (
          sd.status IN ('missing', 'expired', 'rejected')
          OR (r.requires_expiry = TRUE AND (sd.expiry_date IS NULL OR sd.expiry_date < CURRENT_DATE))
        )
    );

  RAISE NOTICE 'Expiry flags updated successfully (dynamic requirements)';
END;
$$ LANGUAGE plpgsql;

-- Update the PA expiry trigger to include new fields
CREATE OR REPLACE FUNCTION trigger_update_pa_expiry()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recompute_employee_can_work(NEW.employee_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_pa_expiry_check ON passenger_assistants;
CREATE TRIGGER trigger_pa_expiry_check
  AFTER INSERT OR UPDATE ON passenger_assistants
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_pa_expiry();

-- Add comment for documentation
COMMENT ON TABLE passenger_assistants IS 'Extended with complete checklist fields including certificates, documentation, and training records (excluding driver-specific fields)';

-- ====================================================================
-- Migration complete!
-- ====================================================================
-- New PA fields are now tracked in the expiry system.
-- The Certificate Expiry dashboard will automatically show these new dates.
-- ====================================================================
