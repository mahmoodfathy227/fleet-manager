-- Add registration_expiry_date to VOR (Vehicle Off Road) checks
-- This ensures vehicles are marked as VOR if registration expires

-- ======================
-- Update the expiry flags function to include registration_expiry_date
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
    (registration_expiry_date IS NOT NULL AND registration_expiry_date < CURRENT_DATE) OR
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
    AND (registration_expiry_date IS NULL OR registration_expiry_date >= CURRENT_DATE)
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
  -- ⚠️ UPDATED: PAs now only require TAS Badge expiry date (DBS expiry removed)
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
      -- Passenger Assistants: Required certificates (TAS Badge only) - DBS expiry removed
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
      -- Not a PA, OR PA has required cert set and valid (TAS Badge only)
      (pa.employee_id IS NULL OR (
        pa.tas_badge_expiry_date IS NOT NULL AND
        pa.tas_badge_expiry_date >= CURRENT_DATE
      ))
    )
  );

  RAISE NOTICE 'Expiry flags updated successfully (PAs now require: TAS Badge only)';
END;
$$ LANGUAGE plpgsql;

-- Update comment
COMMENT ON FUNCTION update_expiry_flags() IS 'Updates can_work flag for employees and VOR status for vehicles. Drivers require: TAS Badge expiry date only. PAs require: TAS Badge expiry date only. Vehicles marked VOR if registration_expiry_date, plate_expiry_date, insurance_expiry_date, mot_date, tax_date, loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry, or taxi_badge_expiry_date is expired.';

