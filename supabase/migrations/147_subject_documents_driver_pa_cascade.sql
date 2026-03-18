-- =====================================================
-- Fix: allow employee/driver/PA delete by cascading
-- subject_documents when driver or PA is deleted.
-- =====================================================
-- When deleting an employee, drivers/passenger_assistants rows may be
-- cascade-deleted (or deleted first). subject_documents references
-- drivers(employee_id) and passenger_assistants(employee_id); without
-- ON DELETE CASCADE those references block the delete.

-- Driver: drop existing FK(s) and re-add with ON DELETE CASCADE
ALTER TABLE subject_documents
  DROP CONSTRAINT IF EXISTS subject_documents_driver_fk;

ALTER TABLE subject_documents
  DROP CONSTRAINT IF EXISTS subject_documents_driver_employee_id_fkey;

ALTER TABLE subject_documents
  ADD CONSTRAINT subject_documents_driver_employee_id_fkey
  FOREIGN KEY (driver_employee_id) REFERENCES drivers(employee_id) ON DELETE CASCADE;

-- PA: drop existing FK(s) and re-add with ON DELETE CASCADE
ALTER TABLE subject_documents
  DROP CONSTRAINT IF EXISTS subject_documents_pa_fk;

ALTER TABLE subject_documents
  DROP CONSTRAINT IF EXISTS subject_documents_pa_employee_id_fkey;

ALTER TABLE subject_documents
  ADD CONSTRAINT subject_documents_pa_employee_id_fkey
  FOREIGN KEY (pa_employee_id) REFERENCES passenger_assistants(employee_id) ON DELETE CASCADE;

-- Employee: ensure ON DELETE CASCADE (subject_type = 'employee')
ALTER TABLE subject_documents
  DROP CONSTRAINT IF EXISTS subject_documents_employee_fk;

ALTER TABLE subject_documents
  DROP CONSTRAINT IF EXISTS subject_documents_employee_id_fkey;

ALTER TABLE subject_documents
  ADD CONSTRAINT subject_documents_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
