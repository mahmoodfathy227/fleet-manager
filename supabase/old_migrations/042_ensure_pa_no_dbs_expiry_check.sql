-- Ensure update_expiry_flags() does NOT check DBS expiry for passenger assistants
-- This migration ensures the function is correctly updated and fixes any existing records

-- ======================
-- Update the expiry flags function (ensure DBS expiry is NOT checked for PAs)
-- ======================
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
    (fire_extinguisher_expiry IS NOT NULL AND fire_extinguisher_expiry < CURRENT_DATE) OR
    (taxi_badge_expiry_date IS NOT NULL AND taxi_badge_expiry_date < CURRENT_DATE)
  )
  AND off_the_road = FALSE;

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
    AND (fire_extinguisher_expiry IS NULL OR fire_extinguisher_expiry >= CURRENT_DATE)
    AND (taxi_badge_expiry_date IS NULL OR taxi_badge_expiry_date >= CURRENT_DATE);

  -- ======================
  -- EMPLOYEES (Drivers & Passenger Assistants)
  -- ⚠️ IMPORTANT: PAs ONLY require TAS Badge expiry date (DBS expiry NOT checked)
  -- ======================
  
  -- Flag employees who have expired OR NULL required certificates
  UPDATE employees
  SET can_work = FALSE
  WHERE id IN (
    SELECT DISTINCT e.id
    FROM employees e
    LEFT JOIN drivers d ON d.employee_id = e.id
    LEFT JOIN passenger_assistants pa ON pa.employee_id = e.id
    WHERE (
      -- Drivers: Required certificates (TAS Badge only)
      (d.employee_id IS NOT NULL AND (
        d.tas_badge_expiry_date IS NULL OR
        d.tas_badge_expiry_date < CURRENT_DATE
      ))
      OR
      -- Passenger Assistants: Required certificates (TAS Badge ONLY - DBS expiry NOT checked)
      (pa.employee_id IS NOT NULL AND (
        pa.tas_badge_expiry_date IS NULL OR
        pa.tas_badge_expiry_date < CURRENT_DATE
      ))
    )
  )
  AND can_work = TRUE;

  -- Unflag employees if ALL required certificates are set AND valid
  UPDATE employees
  SET can_work = TRUE
  WHERE can_work = FALSE
  AND id IN (
    SELECT DISTINCT e.id
    FROM employees e
    LEFT JOIN drivers d ON d.employee_id = e.id
    LEFT JOIN passenger_assistants pa ON pa.employee_id = e.id
    WHERE (
      -- Not a driver, OR driver has required cert set and valid (TAS Badge only)
      (d.employee_id IS NULL OR (
        d.tas_badge_expiry_date IS NOT NULL AND
        d.tas_badge_expiry_date >= CURRENT_DATE
      ))
      AND
      -- Not a PA, OR PA has required cert set and valid (TAS Badge ONLY - DBS expiry NOT checked)
      (pa.employee_id IS NULL OR (
        pa.tas_badge_expiry_date IS NOT NULL AND
        pa.tas_badge_expiry_date >= CURRENT_DATE
      ))
    )
  );

  RAISE NOTICE 'Expiry flags updated successfully (PAs require: TAS Badge ONLY, DBS expiry NOT checked)';
END;
$$ LANGUAGE plpgsql;

-- ======================
-- Ensure PA Trigger does NOT check DBS expiry
-- ======================
CREATE OR REPLACE FUNCTION trigger_update_pa_expiry()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_work BOOLEAN;
BEGIN
  -- Check if PA has all REQUIRED certificates set and valid
  -- Required: TAS Badge expiry date ONLY (DBS expiry NOT checked)
  IF NEW.tas_badge_expiry_date IS NULL THEN
    -- Missing required certificate date
    v_can_work := FALSE;
  ELSIF NEW.tas_badge_expiry_date < CURRENT_DATE THEN
    -- Required certificate expired
    v_can_work := FALSE;
  ELSE
    -- All required certificates present and valid (TAS Badge only)
    v_can_work := TRUE;
  END IF;

  -- Update employee can_work status
  -- SECURITY DEFINER allows this to bypass RLS
  UPDATE employees
  SET can_work = v_can_work
  WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists and is correctly attached
DROP TRIGGER IF EXISTS trigger_pa_expiry_check ON passenger_assistants;
CREATE TRIGGER trigger_pa_expiry_check
  AFTER INSERT OR UPDATE ON passenger_assistants
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_pa_expiry();

-- ======================
-- Run the function immediately to fix existing records
-- This will update all PAs based on TAS Badge ONLY (ignoring DBS expiry)
-- ======================
SELECT update_expiry_flags();

-- ======================
-- Update Comments
-- ======================
COMMENT ON FUNCTION update_expiry_flags() IS 'Updates can_work flag for employees. Drivers require: TAS Badge expiry date only. PAs require: TAS Badge expiry date ONLY. DBS expiry date is NOT checked for PAs.';
COMMENT ON FUNCTION trigger_update_pa_expiry() IS 'Automatically flags PAs as cannot work if required certificate (TAS Badge expiry date) is NULL or expired. DBS expiry date is NOT checked.';

