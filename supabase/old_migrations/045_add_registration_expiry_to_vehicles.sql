-- Add registration_expiry_date column to vehicles table

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS registration_expiry_date DATE;

-- Add helpful comment
COMMENT ON COLUMN vehicles.registration_expiry_date IS 'Vehicle registration expiry date';

