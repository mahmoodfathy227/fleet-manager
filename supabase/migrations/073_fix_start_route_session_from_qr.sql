-- ====================================================
-- Fix start_route_session_from_qr RPC Function
-- ====================================================
-- Update the function to query routes directly using driver_id
-- instead of going through the crew table (which is deprecated)
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

  -- Find assigned route for this driver directly from routes table
  SELECT id, route_number, passenger_assistant_id
  INTO v_route_id, v_route_number, v_pa_id
  FROM routes
  WHERE driver_id = v_driver_id
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

-- Update function comment
COMMENT ON FUNCTION start_route_session_from_qr IS 
'Starts a new route session for a driver by scanning their QR code.
Parameters:
  - p_qr_token: UUID token from driver QR code
  - p_session_type: AM or PM
Returns: JSON object with success status, session details, or error message.
Updated to query routes directly using driver_id instead of crew table.';

