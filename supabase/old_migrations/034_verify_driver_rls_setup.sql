-- Verify and fix complete RLS setup for driver inserts
-- This ensures all components work together correctly

-- 1. Verify employees table has proper UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employees' 
    AND policyname = 'Allow authenticated users to update employees'
    AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "Allow authenticated users to update employees" 
      ON employees 
      FOR UPDATE 
      TO authenticated 
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Ensure trigger function is SECURITY DEFINER
CREATE OR REPLACE FUNCTION trigger_update_driver_expiry()
RETURNS TRIGGER 
SECURITY DEFINER  -- Bypass RLS when updating employees
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
  -- SECURITY DEFINER allows this to bypass RLS
  UPDATE employees
  SET can_work = v_can_work
  WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_driver_expiry_check ON drivers;
CREATE TRIGGER trigger_driver_expiry_check
  AFTER INSERT OR UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_driver_expiry();

-- 4. Verify drivers INSERT policy is correct
DROP POLICY IF EXISTS "Allow authenticated users to insert drivers" ON drivers;
CREATE POLICY "Allow authenticated users to insert drivers" 
  ON drivers 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- 5. Verify employees SELECT policy exists (needed for foreign key checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employees' 
    AND policyname = 'Allow authenticated users to read employees'
    AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "Allow authenticated users to read employees" 
      ON employees 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;
END $$;

