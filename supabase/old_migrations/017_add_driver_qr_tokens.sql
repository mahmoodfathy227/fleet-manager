-- ====================================================
-- Driver QR Token Support
-- ====================================================
-- Adds QR token field to drivers table and RPC function
-- to start route sessions via QR code scanning
-- ====================================================

-- ====================================================
-- ADD QR TOKEN TO DRIVERS TABLE
-- ====================================================

-- Add qr_token column to drivers table
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS qr_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Generate QR tokens for existing drivers that don't have one
UPDATE drivers 
SET qr_token = gen_random_uuid()
WHERE qr_token IS NULL;

-- Make qr_token NOT NULL after populating existing records
ALTER TABLE drivers 
ALTER COLUMN qr_token SET NOT NULL;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_drivers_qr_token ON drivers(qr_token);

-- Add helpful comment
COMMENT ON COLUMN drivers.qr_token IS 'Unique UUID token used for QR code scanning to start route sessions';

-- ====================================================
-- RPC FUNCTION: start_route_session_from_qr
-- ====================================================
-- Allows drivers to start a route session by scanning their QR code
-- and selecting AM or PM session type
-- ====================================================

CREATE OR REPLACE FUNCTION start_route_session_from_qr(
  p_qr_token UUID,
  p_session_type TEXT
)
RETURNS JSON AS $$
DECLARE
  v_driver_id INTEGER;
  v_route_id INTEGER;
  v_route_number VARCHAR;
  v_session_id INTEGER;
  v_pa_id INTEGER;
  v_result JSON;
BEGIN
  -- Validate session type
  IF p_session_type NOT IN ('AM', 'PM') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid session_type. Must be AM or PM'
    );
  END IF;

  -- Find driver by QR token
  SELECT employee_id INTO v_driver_id
  FROM drivers
  WHERE qr_token = p_qr_token;

  IF v_driver_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Driver not found with provided QR token'
    );
  END IF;

  -- Find assigned route for this driver via crew table
  SELECT c.route_id, r.route_number
  INTO v_route_id, v_route_number
  FROM crew c
  INNER JOIN routes r ON r.id = c.route_id
  WHERE c.driver_id = v_driver_id
  LIMIT 1;

  IF v_route_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No route assigned to this driver'
    );
  END IF;

  -- Check if session already exists for today
  SELECT id INTO v_session_id
  FROM route_sessions
  WHERE route_id = v_route_id
    AND session_date = CURRENT_DATE
    AND session_type = p_session_type;

  IF v_session_id IS NOT NULL THEN
    -- Session already exists, return existing session info
    SELECT json_build_object(
      'success', true,
      'session_id', v_session_id,
      'route_id', v_route_id,
      'route_name', v_route_number,
      'session_type', p_session_type,
      'session_date', CURRENT_DATE,
      'message', 'Session already exists for this route and session type today'
    ) INTO v_result;
  ELSE
    -- Get PA from crew assignment
    SELECT pa_id INTO v_pa_id
    FROM crew
    WHERE route_id = v_route_id AND driver_id = v_driver_id
    LIMIT 1;

    -- Insert new route session
    INSERT INTO route_sessions (
      route_id,
      driver_id,
      passenger_assistant_id,
      session_date,
      session_type,
      started_at
    )
    VALUES (
      v_route_id,
      v_driver_id,
      v_pa_id,
      CURRENT_DATE,
      p_session_type,
      NOW()
    )
    RETURNING id INTO v_session_id;

    -- Return success with session details
    v_result := json_build_object(
      'success', true,
      'session_id', v_session_id,
      'route_id', v_route_id,
      'route_name', v_route_number,
      'session_type', p_session_type,
      'session_date', CURRENT_DATE,
      'started_at', NOW()
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION start_route_session_from_qr TO authenticated;
GRANT EXECUTE ON FUNCTION start_route_session_from_qr TO anon;

-- Add function comment
COMMENT ON FUNCTION start_route_session_from_qr IS 
'Starts a new route session for a driver by scanning their QR code.
Parameters:
  - p_qr_token: UUID token from driver QR code
  - p_session_type: AM or PM
Returns: JSON object with success status, session details, or error message.
Example: SELECT start_route_session_from_qr(''123e4567-e89b-12d3-a456-426614174000'', ''AM'');';

