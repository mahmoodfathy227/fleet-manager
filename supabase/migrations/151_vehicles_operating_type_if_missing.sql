-- Ensure vehicles.operating_type exists for export_tas5_rows (e.g. PSV/Hackney/Private Hire)
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS operating_type text;
