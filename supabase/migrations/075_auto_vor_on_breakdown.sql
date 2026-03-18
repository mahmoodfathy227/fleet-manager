-- ====================================================
-- Auto VOR on Vehicle Breakdown
-- ====================================================
-- When a vehicle breaks down, automatically set it to VOR
-- and create a vehicle update entry
-- ====================================================

-- Update the report_vehicle_breakdown function to set vehicle to VOR and create update
CREATE OR REPLACE FUNCTION report_vehicle_breakdown(
    p_route_session_id INTEGER,
    p_description TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL
)
RETURNS vehicle_breakdowns AS $$
DECLARE
    v_breakdown vehicle_breakdowns;
    v_route_session RECORD;
    v_user_id INTEGER;
BEGIN
    -- Get current user ID from auth (if exists)
    BEGIN
        SELECT id INTO v_user_id FROM users WHERE user_id = auth.uid();
    EXCEPTION
        WHEN OTHERS THEN
            v_user_id := NULL;
    END;
    
    -- Get route session details
    SELECT 
        rs.route_id,
        r.vehicle_id,
        rs.driver_id,
        rs.passenger_assistant_id
    INTO v_route_session
    FROM route_sessions rs
    INNER JOIN routes r ON rs.route_id = r.id
    WHERE rs.id = p_route_session_id
      AND rs.ended_at IS NULL
      AND rs.started_at IS NOT NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Route session not found or not active: %', p_route_session_id;
    END IF;
    
    IF v_route_session.vehicle_id IS NULL THEN
        RAISE EXCEPTION 'No vehicle assigned to this route';
    END IF;
    
    -- Allow multiple breakdown reports per session
    -- A vehicle can break down multiple times or have multiple issues
    
    -- Set vehicle to VOR (Vehicle Off Road) if not already
    -- Only update if not already VOR to avoid unnecessary updates
    UPDATE vehicles
    SET off_the_road = true
    WHERE id = v_route_session.vehicle_id
      AND (off_the_road IS NULL OR off_the_road = false);
    
    -- Create vehicle update entry
    INSERT INTO vehicle_updates (
        vehicle_id,
        update_text,
        updated_by
    ) VALUES (
        v_route_session.vehicle_id,
        '🚨 Vehicle breakdown reported. Vehicle automatically set to VOR (Vehicle Off Road). ' ||
        COALESCE('Description: ' || p_description || '. ', '') ||
        COALESCE('Location: ' || p_location || '. ', '') ||
        'Reported at: ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS') || '. ' ||
        'Vehicle will remain VOR until manually changed by admin.',
        v_user_id
    );
    
    -- Create breakdown report
    INSERT INTO vehicle_breakdowns (
        route_session_id,
        vehicle_id,
        route_id,
        reported_by,
        description,
        location,
        status
    ) VALUES (
        p_route_session_id,
        v_route_session.vehicle_id,
        v_route_session.route_id,
        v_user_id,
        p_description,
        p_location,
        'reported'
    )
    RETURNING * INTO v_breakdown;
    
    -- Create urgent notification
    INSERT INTO notifications (
        notification_type,
        entity_type,
        entity_id,
        certificate_type,
        certificate_name,
        expiry_date,
        days_until_expiry,
        status,
        details
    ) VALUES (
        'vehicle_breakdown',
        'vehicle',
        v_route_session.vehicle_id,
        'breakdown',
        'Vehicle Breakdown Reported',
        CURRENT_DATE,
        0,
        'pending',
        jsonb_build_object(
            'breakdown_id', v_breakdown.id,
            'route_session_id', p_route_session_id,
            'route_id', v_route_session.route_id,
            'description', p_description,
            'location', p_location,
            'reported_at', v_breakdown.reported_at,
            'vor_set', true
        )
    );
    
    RETURN v_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION report_vehicle_breakdown IS 'Reports a vehicle breakdown, automatically sets vehicle to VOR, and creates a vehicle update entry';

