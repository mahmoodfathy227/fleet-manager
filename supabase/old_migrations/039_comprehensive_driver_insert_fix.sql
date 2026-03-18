-- Comprehensive fix for driver insert RLS issue
-- This addresses the case where employee exists but insert fails

-- Step 1: Ensure trigger function is SECURITY DEFINER and can update employees
CREATE OR REPLACE FUNCTION trigger_update_driver_expiry()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_work BOOLEAN;
BEGIN
  -- Check if driver has all REQUIRED certificates set and valid
  IF NEW.tas_badge_expiry_date IS NULL THEN
    v_can_work := FALSE;
  ELSIF NEW.tas_badge_expiry_date < CURRENT_DATE THEN
    v_can_work := FALSE;
  ELSE
    v_can_work := TRUE;
  END IF;

  -- Update employee can_work status
  -- SECURITY DEFINER bypasses RLS on employees table
  UPDATE employees
  SET can_work = v_can_work
  WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_driver_expiry_check ON drivers;
CREATE TRIGGER trigger_driver_expiry_check
  AFTER INSERT OR UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_driver_expiry();

-- Step 3: Verify employees table allows SELECT (for foreign key checks)
-- This should already exist, but let's make sure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employees' 
    AND policyname = 'Allow authenticated users to read employees'
  ) THEN
    CREATE POLICY "Allow authenticated users to read employees" 
      ON employees 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;
END $$;

-- Step 4: Verify employees table allows UPDATE (for trigger)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employees' 
    AND policyname = 'Allow authenticated users to update employees'
  ) THEN
    CREATE POLICY "Allow authenticated users to update employees" 
      ON employees 
      FOR UPDATE 
      TO authenticated 
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Step 5: Verify drivers INSERT policy exists
DROP POLICY IF EXISTS "Allow authenticated users to insert drivers" ON drivers;
CREATE POLICY "Allow authenticated users to insert drivers" 
  ON drivers 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Verification queries (run these to check):
-- 1. Check if function is SECURITY DEFINER:
--    SELECT proname, prosecdef FROM pg_proc WHERE proname = 'trigger_update_driver_expiry';
--    prosecdef should be 't'
--
-- 2. Check employees table RLS status:
--    SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'employees';
--
-- 3. Check drivers table RLS status:
--    SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'drivers';
--
-- 4. Test insert (replace 20 with actual employee_id):
--    INSERT INTO drivers (employee_id, psv_license) VALUES (20, false);

