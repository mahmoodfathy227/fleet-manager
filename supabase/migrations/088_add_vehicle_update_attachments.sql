-- ====================================================
-- Add Attachments Support to Vehicle Updates
-- ====================================================
-- Adds file_urls column to vehicle_updates table
-- Allows storing multiple file URLs (photos and documents) with each update
-- Also ensures suppliers can upload files to VEHICLE_DOCUMENTS bucket
-- ====================================================

-- Add file_urls column to store JSON array of file URLs
ALTER TABLE vehicle_updates
ADD COLUMN IF NOT EXISTS file_urls JSONB DEFAULT '[]'::jsonb;

-- Add helpful comment
COMMENT ON COLUMN vehicle_updates.file_urls IS 'JSON array of file URLs (photos and documents) attached to this vehicle update';

-- Allow public/anonymous users to upload files to VEHICLE_DOCUMENTS bucket for vehicles with QR token
-- This allows suppliers to upload photos and files when adding vehicle updates
-- Note: The path pattern is vehicles/{vehicle_id}/updates/{filename}
DROP POLICY IF EXISTS "Allow public upload to VEHICLE_DOCUMENTS by QR token" ON storage.objects;
CREATE POLICY "Allow public upload to VEHICLE_DOCUMENTS by QR token"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'VEHICLE_DOCUMENTS' AND
    name LIKE 'vehicles/%/updates/%' AND
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.qr_token IS NOT NULL
      AND name LIKE 'vehicles/' || vehicles.id::text || '/updates/%'
    )
  );

-- Allow public/anonymous users to read files from VEHICLE_DOCUMENTS bucket for vehicles with QR token
DROP POLICY IF EXISTS "Allow public read from VEHICLE_DOCUMENTS by QR token" ON storage.objects;
CREATE POLICY "Allow public read from VEHICLE_DOCUMENTS by QR token"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'VEHICLE_DOCUMENTS' AND (
      name LIKE 'vehicles/%/updates/%' AND
      EXISTS (
        SELECT 1 FROM vehicles
        WHERE vehicles.qr_token IS NOT NULL
        AND name LIKE 'vehicles/' || vehicles.id::text || '/updates/%'
      )
    )
  );

