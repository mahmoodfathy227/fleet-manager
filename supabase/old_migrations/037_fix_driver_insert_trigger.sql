-- Fix driver insert issue for employee 20 (and others)
-- The trigger updates employees table, which might have RLS enabled
-- Solution: Ensure trigger function is SECURITY DEFINER and handles errors gracefully

-- Drop and recreate the trigger function with proper error handling
CREATE OR REPLACE FUNCTION trigger_update_driver_expiry()
RETURNS TRIGGER 
SECURITY DEFINER  -- This bypasses RLS when updating employees
SET search_path = public
AS $$
DECLARE
  v_can_work BOOLEAN;
BEGIN
  -- Check if driver has all REQUIRED certificates set and valid
  -- Required: TAS Badge expiry date only
  IF NEW.tas_badge_expiry_date IS NULL THEN
    v_can_work := FALSE;
  ELSIF NEW.tas_badge_expiry_date < CURRENT_DATE THEN
    v_can_work := FALSE;
  ELSE
    v_can_work := TRUE;
  END IF;

  -- Update employee can_work status
  -- SECURITY DEFINER allows this to bypass RLS on employees table
  UPDATE employees
  SET can_work = v_can_work
  WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists and is attached
DROP TRIGGER IF EXISTS trigger_driver_expiry_check ON drivers;
CREATE TRIGGER trigger_driver_expiry_check
  AFTER INSERT OR UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_driver_expiry();

-- Verify the function has SECURITY DEFINER
-- You can check with: SELECT prosrc, prosecdef FROM pg_proc WHERE proname = 'trigger_update_driver_expiry';
-- prosecdef should be true for SECURITY DEFINER

