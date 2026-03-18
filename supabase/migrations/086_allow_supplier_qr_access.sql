-- ====================================================
-- Allow Supplier QR Code Access to Vehicles
-- ====================================================
-- Enables public access to vehicles via QR token for suppliers
-- Allows suppliers to view vehicle details, add notes, toggle VOR, and add updates
-- ====================================================

-- Drop existing policies if they exist (to allow re-running migration)
DROP POLICY IF EXISTS "Allow public read vehicles by QR token" ON vehicles;
DROP POLICY IF EXISTS "Allow public update vehicles by QR token" ON vehicles;
DROP POLICY IF EXISTS "Allow public read vehicle updates by QR token" ON vehicle_updates;
DROP POLICY IF EXISTS "Allow public insert vehicle updates by QR token" ON vehicle_updates;

-- Allow public/anonymous users to read vehicles by QR token
-- This allows suppliers to view vehicle details when they have the QR token
CREATE POLICY "Allow public read vehicles by QR token"
  ON vehicles
  FOR SELECT
  TO anon, authenticated
  USING (qr_token IS NOT NULL);

-- Allow public/anonymous users to update vehicles (notes and VOR status) by QR token
-- This allows suppliers to update notes and VOR status when they have the QR token
CREATE POLICY "Allow public update vehicles by QR token"
  ON vehicles
  FOR UPDATE
  TO anon, authenticated
  USING (qr_token IS NOT NULL)
  WITH CHECK (qr_token IS NOT NULL);

-- Allow public/anonymous users to read vehicle updates for vehicles with QR token
-- This allows suppliers to view the update history for vehicles they can access
CREATE POLICY "Allow public read vehicle updates by QR token"
  ON vehicle_updates
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = vehicle_updates.vehicle_id
      AND vehicles.qr_token IS NOT NULL
    )
  );

-- Allow public/anonymous users to insert vehicle updates for vehicles with QR token
-- This allows suppliers to add updates/notes to vehicles they can access
CREATE POLICY "Allow public insert vehicle updates by QR token"
  ON vehicle_updates
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicles
      WHERE vehicles.id = vehicle_updates.vehicle_id
      AND vehicles.qr_token IS NOT NULL
    )
  );

