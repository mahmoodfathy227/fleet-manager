-- Add colour column to vehicles table

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS colour VARCHAR;

-- Add helpful comment
COMMENT ON COLUMN vehicles.colour IS 'Vehicle colour';

