-- Add next of kin and date of birth to employees (Drivers and PAs)
-- Address may already exist from a previous migration; add if not present

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS next_of_kin TEXT;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN employees.address IS 'Employee home address';
COMMENT ON COLUMN employees.next_of_kin IS 'Next of kin name and/or contact details';
COMMENT ON COLUMN employees.date_of_birth IS 'Employee date of birth';
