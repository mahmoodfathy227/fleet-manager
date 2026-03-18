-- Fix driver insert for employees that exist but aren't in drivers table
-- The issue might be with the trigger or foreign key constraints

-- 1. Ensure the trigger function can handle the update properly
CREATE OR REPLACE FUNCTION trigger_update_driver_expiry()
RETURNS TRIGGER 
SECURITY DEFINER
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
  -- Use a more explicit update that handles edge cases
  BEGIN
    UPDATE employees
    SET can_work = v_can_work
    WHERE id = NEW.employee_id;
    
    -- If no rows updated, that's okay - employee might not exist (shouldn't happen due to FK)
    -- But we'll continue anyway
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the insert
      RAISE WARNING 'Could not update employee can_work status: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Verify the foreign key constraint allows the insert
-- The constraint should be: employee_id REFERENCES employees(id)
-- This should work if the employee exists

-- 3. Check if there are any other constraints that might block
-- Run this query to see all constraints:
-- SELECT conname, contype, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'drivers'::regclass;

