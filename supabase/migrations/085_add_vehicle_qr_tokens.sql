-- ====================================================
-- Add QR Token to Vehicles
-- ====================================================
-- Adds qr_token column to vehicles table for QR code identification
-- This allows each vehicle to have a unique QR code that suppliers can scan
-- ====================================================

-- Add qr_token column to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS qr_token UUID UNIQUE;

-- Generate QR tokens for existing vehicles that don't have one
UPDATE vehicles
SET qr_token = gen_random_uuid()
WHERE qr_token IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_qr_token ON vehicles(qr_token);

-- Add helpful comment
COMMENT ON COLUMN vehicles.qr_token IS 'Unique UUID token used for QR code scanning to access vehicle details via supplier portal';

