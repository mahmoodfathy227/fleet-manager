-- Fix driver insert RLS issue
-- The trigger_update_driver_expiry function updates employees table
-- This needs to work even when RLS is enabled
-- Solution: Make the trigger function SECURITY DEFINER

-- Update the trigger function to use SECURITY DEFINER
-- This allows it to bypass RLS when updating the employees table
CREATE OR REPLACE FUNCTION trigger_update_driver_expiry()
RETURNS TRIGGER 
SECURITY DEFINER  -- This allows the function to bypass RLS
SET search_path = public
AS $$
DECLARE
  v_can_work BOOLEAN;
BEGIN
  -- Check if driver has all REQUIRED certificates set and valid
  -- Required: TAS Badge expiry date only (DBS expiry removed)
  IF NEW.tas_badge_expiry_date IS NULL THEN
    -- Missing required certificate date
    v_can_work := FALSE;
  ELSIF NEW.tas_badge_expiry_date < CURRENT_DATE THEN
    -- Required certificate expired
    v_can_work := FALSE;
  ELSE
    -- All required certificates present and valid
    v_can_work := TRUE;
  END IF;

  -- Update employee can_work status
  -- With SECURITY DEFINER, this will bypass RLS
  UPDATE employees
  SET can_work = v_can_work
  WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also ensure the drivers INSERT policy is correct
-- Drop and recreate to ensure it's properly set
DROP POLICY IF EXISTS "Allow authenticated users to insert drivers" ON drivers;

CREATE POLICY "Allow authenticated users to insert drivers" 
  ON drivers 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
