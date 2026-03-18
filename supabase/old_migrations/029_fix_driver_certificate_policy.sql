-- Fix driver certificate policy: Remove Taxi Badge requirement (now on vehicles)
-- Drivers now only require: TAS Badge and DBS Certificate

-- ======================
-- Update the expiry flags function
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
    AND (fire_extinguisher_expiry IS NULL OR fire_extinguisher_expiry >= CURRENT_DATE)
    AND (taxi_badge_expiry_date IS NULL OR taxi_badge_expiry_date >= CURRENT_DATE);

  -- ======================
  -- EMPLOYEES (Drivers & Passenger Assistants)
  -- ⚠️ UPDATED: Drivers now only require TAS Badge and DBS (Taxi Badge moved to vehicles)
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
      -- Drivers: Required certificates (TAS Badge, DBS) - Taxi Badge removed
      (d.employee_id IS NOT NULL AND (
        -- Check for NULL (missing dates) - REQUIRED
        d.tas_badge_expiry_date IS NULL OR
        d.dbs_expiry_date IS NULL OR
        -- Check for expired dates
        d.tas_badge_expiry_date < CURRENT_DATE OR
        d.dbs_expiry_date < CURRENT_DATE
      ))
      OR
      -- Passenger Assistants: Required certificates (TAS Badge, DBS)
      (pa.employee_id IS NOT NULL AND (
        -- Check for NULL (missing dates) - REQUIRED
        pa.tas_badge_expiry_date IS NULL OR
        pa.dbs_expiry_date IS NULL OR
        -- Check for expired dates
        pa.tas_badge_expiry_date < CURRENT_DATE OR
        pa.dbs_expiry_date < CURRENT_DATE
      ))
    )
  )
  AND can_work = TRUE; -- Only update if not already flagged

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
      -- Not a driver, OR driver has all required certs set and valid (TAS Badge, DBS only)
      (d.employee_id IS NULL OR (
        d.tas_badge_expiry_date IS NOT NULL AND
        d.dbs_expiry_date IS NOT NULL AND
        d.tas_badge_expiry_date >= CURRENT_DATE AND
        d.dbs_expiry_date >= CURRENT_DATE
      ))
      AND
      -- Not a PA, OR PA has all required certs set and valid
      (pa.employee_id IS NULL OR (
        pa.tas_badge_expiry_date IS NOT NULL AND
        pa.dbs_expiry_date IS NOT NULL AND
        pa.tas_badge_expiry_date >= CURRENT_DATE AND
        pa.dbs_expiry_date >= CURRENT_DATE
      ))
    )
  );

  RAISE NOTICE 'Expiry flags updated successfully (Drivers now require: TAS Badge, DBS only)';
END;
$$ LANGUAGE plpgsql;

-- ======================
-- Update Driver Trigger to check for NULL dates (TAS Badge, DBS only)
-- ======================
CREATE OR REPLACE FUNCTION trigger_update_driver_expiry()
RETURNS TRIGGER AS $$
DECLARE
  v_can_work BOOLEAN;
BEGIN
  -- Check if driver has all REQUIRED certificates set and valid
  -- Required: TAS Badge, DBS (Taxi Badge moved to vehicles)
  IF NEW.tas_badge_expiry_date IS NULL OR
     NEW.dbs_expiry_date IS NULL THEN
    -- Missing required certificate dates
    v_can_work := FALSE;
  ELSIF NEW.tas_badge_expiry_date < CURRENT_DATE OR
        NEW.dbs_expiry_date < CURRENT_DATE THEN
    -- Required certificate expired
    v_can_work := FALSE;
  ELSE
    -- All required certificates present and valid
    v_can_work := TRUE;
  END IF;

  -- Update employee can_work status
  UPDATE employees
  SET can_work = v_can_work
  WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================
-- Run the function immediately to update existing records
-- ======================
SELECT update_expiry_flags();

-- ======================
-- Summary Comments
-- ======================
COMMENT ON FUNCTION update_expiry_flags() IS 'Updates can_work flag for employees. Drivers require: TAS Badge, DBS (all must be set and not expired). PAs require: TAS Badge, DBS (all must be set and not expired). Taxi Badge is now tracked on vehicles.';
COMMENT ON FUNCTION trigger_update_driver_expiry() IS 'Automatically flags drivers as cannot work if required certificates (TAS Badge, DBS) are NULL or expired. Taxi Badge is now tracked on vehicles.';

