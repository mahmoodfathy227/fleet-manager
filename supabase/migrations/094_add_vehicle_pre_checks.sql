-- ====================================================
-- Add Vehicle Pre-Check System
-- ====================================================
-- Creates vehicle_pre_checks table for drivers to complete
-- before starting AM routes. Mobile-friendly maintenance checklist.
-- ====================================================

-- Create vehicle_pre_checks table
CREATE TABLE IF NOT EXISTS vehicle_pre_checks (
  id SERIAL PRIMARY KEY,
  route_session_id INTEGER REFERENCES route_sessions(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES employees(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  session_type VARCHAR NOT NULL, -- 'AM' or 'PM'
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Vehicle Exterior Checks
  lights_working BOOLEAN DEFAULT false,
  mirrors_adjusted BOOLEAN DEFAULT false,
  tires_condition BOOLEAN DEFAULT false,
  body_damage BOOLEAN DEFAULT false,
  windows_clean BOOLEAN DEFAULT false,
  
  -- Vehicle Interior Checks
  dashboard_lights BOOLEAN DEFAULT false,
  horn_working BOOLEAN DEFAULT false,
  wipers_working BOOLEAN DEFAULT false,
  seatbelts_working BOOLEAN DEFAULT false,
  interior_clean BOOLEAN DEFAULT false,
  
  -- Safety Equipment
  first_aid_kit BOOLEAN DEFAULT false,
  fire_extinguisher BOOLEAN DEFAULT false,
  warning_triangle BOOLEAN DEFAULT false,
  emergency_kit BOOLEAN DEFAULT false,
  
  -- Mechanical Checks
  engine_oil_level BOOLEAN DEFAULT false,
  coolant_level BOOLEAN DEFAULT false,
  brake_fluid BOOLEAN DEFAULT false,
  fuel_level_adequate BOOLEAN DEFAULT false,
  
  -- Additional Notes
  notes TEXT,
  issues_found TEXT,
  
  -- Media Attachments (videos and pictures)
  media_urls JSONB DEFAULT '[]'::jsonb, -- Array of file URLs: [{type: 'video'|'image', url: string, thumbnail?: string}]
  
  -- Metadata
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_vehicle_pre_checks_route_session ON vehicle_pre_checks(route_session_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_pre_checks_driver ON vehicle_pre_checks(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_pre_checks_vehicle ON vehicle_pre_checks(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_pre_checks_date ON vehicle_pre_checks(check_date);

-- Add helpful comments
COMMENT ON TABLE vehicle_pre_checks IS 'Vehicle pre-check checklist completed by drivers before starting routes';
COMMENT ON COLUMN vehicle_pre_checks.session_type IS 'AM or PM session type';
COMMENT ON COLUMN vehicle_pre_checks.body_damage IS 'True means no body damage confirmed (check passed)';
COMMENT ON COLUMN vehicle_pre_checks.issues_found IS 'Any issues or problems found during the check';
COMMENT ON COLUMN vehicle_pre_checks.media_urls IS 'JSONB array of media files: videos and pictures from walkaround inspection';

-- Enable Row Level Security
ALTER TABLE vehicle_pre_checks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Allow authenticated users to read vehicle pre checks" ON vehicle_pre_checks;
CREATE POLICY "Allow authenticated users to read vehicle pre checks"
  ON vehicle_pre_checks
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert vehicle pre checks" ON vehicle_pre_checks;
CREATE POLICY "Allow authenticated users to insert vehicle pre checks"
  ON vehicle_pre_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous users to insert pre-checks (for QR code access)
DROP POLICY IF EXISTS "Allow anonymous users to insert vehicle pre checks" ON vehicle_pre_checks;
CREATE POLICY "Allow anonymous users to insert vehicle pre checks"
  ON vehicle_pre_checks
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ====================================================
-- NOTES ON STORAGE BUCKET CONFIGURATION
-- ====================================================
-- The VEHICLE_DOCUMENTS bucket must allow video files for pre-check walkaround videos.
-- Ensure the bucket configuration includes:
--   - video/mp4
--   - video/webm
--   - video/quicktime (for iOS)
--   - image/jpeg
--   - image/png
--   - image/jpg
-- 
-- File size limit should be increased to at least 50 MB for video uploads.
-- 
-- To update bucket settings in Supabase Dashboard:
-- 1. Go to Storage > VEHICLE_DOCUMENTS
-- 2. Click Settings
-- 3. Update Allowed MIME types to include video formats
-- 4. Increase File size limit to 50 MB (52428800 bytes) or higher

