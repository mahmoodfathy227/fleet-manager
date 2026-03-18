-- Outgoing call receiver: can be a parent contact or an employee (searchable in UI)
ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS outgoing_receiver_parent_contact_id integer REFERENCES public.parent_contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS outgoing_receiver_employee_id integer REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN call_logs.outgoing_receiver_parent_contact_id IS 'When outgoing call receiver is a parent (guardian contact)';
COMMENT ON COLUMN call_logs.outgoing_receiver_employee_id IS 'When outgoing call receiver is an employee';

CREATE INDEX IF NOT EXISTS idx_call_logs_outgoing_receiver_parent ON call_logs(outgoing_receiver_parent_contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_outgoing_receiver_employee ON call_logs(outgoing_receiver_employee_id);
