-- Add free-text field for outgoing receiver when they are not a parent contact or employee

ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS outgoing_receiver_other_name TEXT;

COMMENT ON COLUMN public.call_logs.outgoing_receiver_other_name IS 'When outgoing call receiver is not in parent_contacts or employees, store their name here.';

