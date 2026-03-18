-- ====================================================
-- Add address field to employees table
-- ====================================================

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN employees.address IS 'Employee home address';

