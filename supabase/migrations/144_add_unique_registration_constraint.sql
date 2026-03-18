-- ====================================================
-- Add unique constraint to vehicle registration
-- ====================================================

-- First, remove any duplicate registrations (keep the first one, delete others)
-- This is a safety measure before adding the constraint
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  FOR dup_record IN
    SELECT registration, array_agg(id ORDER BY id) as ids
    FROM vehicles
    WHERE registration IS NOT NULL AND registration != ''
    GROUP BY registration
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first ID, delete the rest
    DELETE FROM vehicles
    WHERE registration = dup_record.registration
      AND id != dup_record.ids[1];
    
    RAISE NOTICE 'Removed duplicate registration: % (kept vehicle ID: %)', 
      dup_record.registration, dup_record.ids[1];
  END LOOP;
END $$;

-- Create unique index on registration (allows NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_registration_unique 
ON vehicles(registration) 
WHERE registration IS NOT NULL AND registration != '';

COMMENT ON INDEX idx_vehicles_registration_unique IS 'Ensures vehicle registration numbers are unique (allows NULL values)';
