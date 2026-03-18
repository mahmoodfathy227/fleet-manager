-- Add can_work column to employees table if it doesn't exist
ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_work BOOLEAN DEFAULT TRUE;

-- Create function to update expiry flags
CREATE OR REPLACE FUNCTION update_expiry_flags()
RETURNS void AS $$
BEGIN
  -- ======================
  -- VEHICLES OFF ROAD (VOR)
  -- ======================
  
  -- Mark vehicles as VOR if any certificate is expired
  UPDATE vehicles
  SET off_the_road = TRUE
  WHERE (
    (plate_expiry_date IS NOT NULL AND plate_expiry_date < CURRENT_DATE) OR
    (insurance_expiry_date IS NOT NULL AND insurance_expiry_date < CURRENT_DATE) OR
    (mot_date IS NOT NULL AND mot_date < CURRENT_DATE) OR
    (tax_date IS NOT NULL AND tax_date < CURRENT_DATE) OR
    (loler_expiry_date IS NOT NULL AND loler_expiry_date < CURRENT_DATE) OR
    (first_aid_expiry IS NOT NULL AND first_aid_expiry < CURRENT_DATE) OR
    (fire_extinguisher_expiry IS NOT NULL AND fire_extinguisher_expiry < CURRENT_DATE)
  )
  AND off_the_road = FALSE; -- Only update if not already marked

  -- Re-enable vehicles if all certificates are valid or NULL
  UPDATE vehicles
  SET off_the_road = FALSE
  WHERE off_the_road = TRUE
    AND (plate_expiry_date IS NULL OR plate_expiry_date >= CURRENT_DATE)
    AND (insurance_expiry_date IS NULL OR insurance_expiry_date >= CURRENT_DATE)
    AND (mot_date IS NULL OR mot_date >= CURRENT_DATE)
    AND (tax_date IS NULL OR tax_date >= CURRENT_DATE)
    AND (loler_expiry_date IS NULL OR loler_expiry_date >= CURRENT_DATE)
    AND (first_aid_expiry IS NULL OR first_aid_expiry >= CURRENT_DATE)
    AND (fire_extinguisher_expiry IS NULL OR fire_extinguisher_expiry >= CURRENT_DATE);

  -- ======================
  -- EMPLOYEES (Drivers & Passenger Assistants)
  -- ======================
  
  -- Flag employees who have expired certificates
  UPDATE employees
  SET can_work = FALSE
  WHERE id IN (
    SELECT DISTINCT e.id
    FROM employees e
    LEFT JOIN drivers d ON d.employee_id = e.id
    LEFT JOIN passenger_assistants pa ON pa.employee_id = e.id
    WHERE (
      (d.tas_badge_expiry_date IS NOT NULL AND d.tas_badge_expiry_date < CURRENT_DATE) OR
      (d.taxi_badge_expiry_date IS NOT NULL AND d.taxi_badge_expiry_date < CURRENT_DATE) OR
      (d.dbs_expiry_date IS NOT NULL AND d.dbs_expiry_date < CURRENT_DATE) OR
      (pa.tas_badge_expiry_date IS NOT NULL AND pa.tas_badge_expiry_date < CURRENT_DATE) OR
      (pa.dbs_expiry_date IS NOT NULL AND pa.dbs_expiry_date < CURRENT_DATE)
    )
  )
  AND can_work = TRUE; -- Only update if not already flagged

  -- Unflag employees if all their certificates are valid or NULL
  UPDATE employees
  SET can_work = TRUE
  WHERE can_work = FALSE
  AND id IN (
    SELECT DISTINCT e.id
    FROM employees e
    LEFT JOIN drivers d ON d.employee_id = e.id
    LEFT JOIN passenger_assistants pa ON pa.employee_id = e.id
    WHERE (
      (d.employee_id IS NULL OR (
        (d.tas_badge_expiry_date IS NULL OR d.tas_badge_expiry_date >= CURRENT_DATE) AND
        (d.taxi_badge_expiry_date IS NULL OR d.taxi_badge_expiry_date >= CURRENT_DATE) AND
        (d.dbs_expiry_date IS NULL OR d.dbs_expiry_date >= CURRENT_DATE)
      ))
      AND
      (pa.employee_id IS NULL OR (
        (pa.tas_badge_expiry_date IS NULL OR pa.tas_badge_expiry_date >= CURRENT_DATE) AND
        (pa.dbs_expiry_date IS NULL OR pa.dbs_expiry_date >= CURRENT_DATE)
      ))
    )
  );

  RAISE NOTICE 'Expiry flags updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to run after vehicle updates
CREATE OR REPLACE FUNCTION trigger_update_vehicle_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any expiry date changed
  IF (OLD.plate_expiry_date IS DISTINCT FROM NEW.plate_expiry_date OR
      OLD.insurance_expiry_date IS DISTINCT FROM NEW.insurance_expiry_date OR
      OLD.mot_date IS DISTINCT FROM NEW.mot_date OR
      OLD.tax_date IS DISTINCT FROM NEW.tax_date OR
      OLD.loler_expiry_date IS DISTINCT FROM NEW.loler_expiry_date OR
      OLD.first_aid_expiry IS DISTINCT FROM NEW.first_aid_expiry OR
      OLD.fire_extinguisher_expiry IS DISTINCT FROM NEW.fire_extinguisher_expiry) THEN
    
    -- Check if any certificate is expired
    IF (NEW.plate_expiry_date IS NOT NULL AND NEW.plate_expiry_date < CURRENT_DATE) OR
       (NEW.insurance_expiry_date IS NOT NULL AND NEW.insurance_expiry_date < CURRENT_DATE) OR
       (NEW.mot_date IS NOT NULL AND NEW.mot_date < CURRENT_DATE) OR
       (NEW.tax_date IS NOT NULL AND NEW.tax_date < CURRENT_DATE) OR
       (NEW.loler_expiry_date IS NOT NULL AND NEW.loler_expiry_date < CURRENT_DATE) OR
       (NEW.first_aid_expiry IS NOT NULL AND NEW.first_aid_expiry < CURRENT_DATE) OR
       (NEW.fire_extinguisher_expiry IS NOT NULL AND NEW.fire_extinguisher_expiry < CURRENT_DATE) THEN
      NEW.off_the_road := TRUE;
    ELSE
      -- All certificates valid or NULL, can be operational
      NEW.off_the_road := FALSE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_vehicle_expiry_check ON vehicles;
CREATE TRIGGER trigger_vehicle_expiry_check
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vehicle_expiry();

-- Also trigger on INSERT to catch newly created vehicles with expired certificates
DROP TRIGGER IF EXISTS trigger_vehicle_expiry_check_insert ON vehicles;
CREATE TRIGGER trigger_vehicle_expiry_check_insert
  BEFORE INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vehicle_expiry();

-- Create trigger for drivers
CREATE OR REPLACE FUNCTION trigger_update_driver_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any expiry date changed
  IF (OLD.tas_badge_expiry_date IS DISTINCT FROM NEW.tas_badge_expiry_date OR
      OLD.taxi_badge_expiry_date IS DISTINCT FROM NEW.taxi_badge_expiry_date OR
      OLD.dbs_expiry_date IS DISTINCT FROM NEW.dbs_expiry_date) THEN
    
    -- Check if any certificate is expired
    IF (NEW.tas_badge_expiry_date IS NOT NULL AND NEW.tas_badge_expiry_date < CURRENT_DATE) OR
       (NEW.taxi_badge_expiry_date IS NOT NULL AND NEW.taxi_badge_expiry_date < CURRENT_DATE) OR
       (NEW.dbs_expiry_date IS NOT NULL AND NEW.dbs_expiry_date < CURRENT_DATE) THEN
      UPDATE employees SET can_work = FALSE WHERE id = NEW.employee_id;
    ELSE
      -- Check if all certificates valid for this employee
      PERFORM 1 FROM drivers d
      LEFT JOIN passenger_assistants pa ON pa.employee_id = d.employee_id
      WHERE d.employee_id = NEW.employee_id
      AND (
        (d.tas_badge_expiry_date IS NULL OR d.tas_badge_expiry_date >= CURRENT_DATE) AND
        (d.taxi_badge_expiry_date IS NULL OR d.taxi_badge_expiry_date >= CURRENT_DATE) AND
        (d.dbs_expiry_date IS NULL OR d.dbs_expiry_date >= CURRENT_DATE) AND
        (pa.tas_badge_expiry_date IS NULL OR pa.tas_badge_expiry_date >= CURRENT_DATE) AND
        (pa.dbs_expiry_date IS NULL OR pa.dbs_expiry_date >= CURRENT_DATE)
      );
      
      IF FOUND THEN
        UPDATE employees SET can_work = TRUE WHERE id = NEW.employee_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_driver_expiry_check ON drivers;
CREATE TRIGGER trigger_driver_expiry_check
  AFTER UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_driver_expiry();

-- Create trigger for passenger assistants
CREATE OR REPLACE FUNCTION trigger_update_pa_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any expiry date changed
  IF (OLD.tas_badge_expiry_date IS DISTINCT FROM NEW.tas_badge_expiry_date OR
      OLD.dbs_expiry_date IS DISTINCT FROM NEW.dbs_expiry_date) THEN
    
    -- Check if any certificate is expired
    IF (NEW.tas_badge_expiry_date IS NOT NULL AND NEW.tas_badge_expiry_date < CURRENT_DATE) OR
       (NEW.dbs_expiry_date IS NOT NULL AND NEW.dbs_expiry_date < CURRENT_DATE) THEN
      UPDATE employees SET can_work = FALSE WHERE id = NEW.employee_id;
    ELSE
      -- Check if all certificates valid for this employee
      PERFORM 1 FROM passenger_assistants pa
      LEFT JOIN drivers d ON d.employee_id = pa.employee_id
      WHERE pa.employee_id = NEW.employee_id
      AND (
        (pa.tas_badge_expiry_date IS NULL OR pa.tas_badge_expiry_date >= CURRENT_DATE) AND
        (pa.dbs_expiry_date IS NULL OR pa.dbs_expiry_date >= CURRENT_DATE) AND
        (d.tas_badge_expiry_date IS NULL OR d.tas_badge_expiry_date >= CURRENT_DATE) AND
        (d.taxi_badge_expiry_date IS NULL OR d.taxi_badge_expiry_date >= CURRENT_DATE) AND
        (d.dbs_expiry_date IS NULL OR d.dbs_expiry_date >= CURRENT_DATE)
      );
      
      IF FOUND THEN
        UPDATE employees SET can_work = TRUE WHERE id = NEW.employee_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pa_expiry_check ON passenger_assistants;
CREATE TRIGGER trigger_pa_expiry_check
  AFTER UPDATE ON passenger_assistants
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_pa_expiry();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_expiry_flags() TO authenticated;

-- Add comment
COMMENT ON FUNCTION update_expiry_flags() IS 'Updates VOR status for vehicles and can_work status for employees based on certificate expiry dates. Runs daily via cron.';

-- Note: To schedule this function with Supabase cron:
-- Run this via Supabase SQL editor or enable pg_cron extension:
-- 
-- SELECT cron.schedule(
--   'update-expiry-flags',
--   '0 0 * * *', -- Daily at midnight UTC
--   $$SELECT update_expiry_flags();$$
-- );
--
-- Or using Supabase Edge Functions for more control

