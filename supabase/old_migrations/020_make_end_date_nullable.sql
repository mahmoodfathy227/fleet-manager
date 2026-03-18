-- ====================================================
-- Make end_date nullable in employees table
-- ====================================================
-- This migration makes the end_date column nullable
-- to allow employees without an end date

-- The column is already nullable in the schema (DATE without NOT NULL),
-- but we'll ensure it's explicitly nullable
ALTER TABLE employees 
  ALTER COLUMN end_date DROP NOT NULL;

-- If the column doesn't exist as nullable, this will ensure it is
-- (PostgreSQL DATE columns are nullable by default, but this makes it explicit)

