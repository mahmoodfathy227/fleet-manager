-- Test script to isolate the driver insert issue
-- Option 1: Temporarily disable the trigger to test if that's the issue

-- Disable trigger temporarily
ALTER TABLE drivers DISABLE TRIGGER trigger_driver_expiry_check;

-- Test insert (replace 20 with the actual employee_id you're testing)
-- INSERT INTO drivers (employee_id, psv_license) VALUES (20, false);

-- If the insert works without the trigger, then the issue is in the trigger function
-- If it still fails, the issue is elsewhere (foreign key, constraint, etc.)

-- After testing, re-enable the trigger:
-- ALTER TABLE drivers ENABLE TRIGGER trigger_driver_expiry_check;

-- Option 2: Check if employees table RLS is blocking the trigger update
-- Run this to see employees table RLS status:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'employees';

-- Option 3: If employees RLS is enabled, ensure the trigger function can bypass it
-- The SECURITY DEFINER should handle this, but let's verify:
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'trigger_update_driver_expiry';
-- prosecdef should be 't' (true) for SECURITY DEFINER

