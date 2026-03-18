-- Debug script to check what's preventing driver inserts
-- Run this to identify the actual issue

-- 1. Check if there are any constraints on drivers table
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'drivers'::regclass
ORDER BY contype, conname;

-- 2. Check if employee_id exists (replace with actual ID you're trying to use)
-- SELECT id, full_name, employment_status FROM employees WHERE id = YOUR_EMPLOYEE_ID;

-- 3. Check if employee_id is already a driver
-- SELECT employee_id FROM drivers WHERE employee_id = YOUR_EMPLOYEE_ID;

-- 4. Check triggers on drivers table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'drivers';

-- 5. Test insert with a simple query (replace with actual values)
-- This will show the actual error
/*
INSERT INTO drivers (
    employee_id,
    tas_badge_number,
    tas_badge_expiry_date,
    dbs_number,
    psv_license
) VALUES (
    1,  -- Replace with actual employee_id
    'TEST123',
    '2025-12-31',
    'DBS123',
    false
);
*/

