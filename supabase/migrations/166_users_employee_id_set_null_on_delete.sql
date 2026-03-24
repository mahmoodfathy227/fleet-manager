-- Allow deleting employees when users.employee_id references them.
-- When an employee is deleted, set users.employee_id to NULL for any user linked to that employee
-- (the user account remains; it is just unlinked from the employee record).

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_employee_id_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT users_employee_id_fkey ON public.users IS
  'Set NULL on delete: deleting an employee unlinks the user account from that employee; the user remains.';
