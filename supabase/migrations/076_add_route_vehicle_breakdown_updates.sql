-- ====================================================
-- Add Route and Vehicle Updates for Breakdowns
-- ====================================================
-- Creates route_updates table and adds updates when breakdowns occur
-- and when replacement vehicles are assigned
-- ====================================================

-- Create route_updates table if it doesn't exist
CREATE TABLE IF NOT EXISTS route_updates (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  update_text TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_route_updates_route ON route_updates(route_id);
CREATE INDEX IF NOT EXISTS idx_route_updates_created ON route_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_updates_user ON route_updates(updated_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_route_updates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_route_updates_updated_at ON route_updates;
CREATE TRIGGER trigger_update_route_updates_updated_at
  BEFORE UPDATE ON route_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_route_updates_updated_at();

-- Enable Row Level Security
ALTER TABLE route_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON route_updates;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON route_updates;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON route_updates;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON route_updates;

CREATE POLICY "Enable read access for authenticated users" ON route_updates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON route_updates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON route_updates
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON route_updates
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE route_updates IS 'Stores notes and updates related to routes';
COMMENT ON COLUMN route_updates.route_id IS 'References the route this update is about';
COMMENT ON COLUMN route_updates.update_text IS 'The content of the update or note';
COMMENT ON COLUMN route_updates.updated_by IS 'User who created this update';

-- ====================================================
-- Update report_vehicle_breakdown to add route update
-- ====================================================
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
    v_vehicle_registration TEXT;
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
        rs.passenger_assistant_id,
        v.registration
    INTO v_route_session
    FROM route_sessions rs
    INNER JOIN routes r ON rs.route_id = r.id
    LEFT JOIN vehicles v ON r.vehicle_id = v.id
    WHERE rs.id = p_route_session_id
      AND rs.ended_at IS NULL
      AND rs.started_at IS NOT NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Route session not found or not active: %', p_route_session_id;
    END IF;
    
    IF v_route_session.vehicle_id IS NULL THEN
        RAISE EXCEPTION 'No vehicle assigned to this route';
    END IF;
    
    -- Get vehicle registration
    SELECT registration INTO v_vehicle_registration
    FROM vehicles
    WHERE id = v_route_session.vehicle_id;
    
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
    
    -- Create route update entry
    INSERT INTO route_updates (
        route_id,
        update_text,
        updated_by
    ) VALUES (
        v_route_session.route_id,
        '🚨 Vehicle breakdown reported for vehicle ' || COALESCE(v_vehicle_registration, 'ID: ' || v_route_session.vehicle_id::TEXT) || '. ' ||
        COALESCE('Description: ' || p_description || '. ', '') ||
        COALESCE('Location: ' || p_location || '. ', '') ||
        'Reported at: ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS') || '. ' ||
        'Route vehicle has been set to VOR. Awaiting replacement vehicle assignment.',
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

COMMENT ON FUNCTION report_vehicle_breakdown IS 'Reports a vehicle breakdown, sets vehicle to VOR, and creates vehicle and route update entries';

-- ====================================================
-- Update assign_replacement_vehicle to add route and vehicle updates
-- ====================================================
CREATE OR REPLACE FUNCTION assign_replacement_vehicle(
    p_breakdown_id INTEGER,
    p_replacement_vehicle_id INTEGER
)
RETURNS vehicle_breakdowns AS $$
DECLARE
    v_breakdown vehicle_breakdowns;
    v_route_session RECORD;
    v_user_id INTEGER;
    v_old_vehicle_registration TEXT;
    v_new_vehicle_registration TEXT;
BEGIN
    -- Get current user ID from auth (if exists)
    BEGIN
        SELECT id INTO v_user_id FROM users WHERE user_id = auth.uid();
    EXCEPTION
        WHEN OTHERS THEN
            v_user_id := NULL;
    END;
    
    -- Get breakdown details
    SELECT 
        route_id, 
        route_session_id,
        vehicle_id
    INTO v_route_session
    FROM vehicle_breakdowns
    WHERE id = p_breakdown_id
      AND status = 'reported';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Breakdown not found or already resolved: %', p_breakdown_id;
    END IF;
    
    -- Validate replacement vehicle exists and is available
    IF NOT EXISTS (
        SELECT 1 FROM vehicles 
        WHERE id = p_replacement_vehicle_id
          AND (off_the_road IS NULL OR off_the_road = false)
    ) THEN
        RAISE EXCEPTION 'Replacement vehicle not found or unavailable: %', p_replacement_vehicle_id;
    END IF;
    
    -- Get vehicle registrations
    SELECT registration INTO v_old_vehicle_registration
    FROM vehicles
    WHERE id = v_route_session.vehicle_id;
    
    SELECT registration INTO v_new_vehicle_registration
    FROM vehicles
    WHERE id = p_replacement_vehicle_id;
    
    -- Update breakdown with replacement
    UPDATE vehicle_breakdowns
    SET 
        replacement_vehicle_id = p_replacement_vehicle_id,
        replacement_assigned_at = now(),
        status = 'replacement_assigned'
    WHERE id = p_breakdown_id
    RETURNING * INTO v_breakdown;
    
    -- Update route to use replacement vehicle
    UPDATE routes
    SET vehicle_id = p_replacement_vehicle_id
    WHERE id = v_route_session.route_id;
    
    -- Create route update entry
    INSERT INTO route_updates (
        route_id,
        update_text,
        updated_by
    ) VALUES (
        v_route_session.route_id,
        '✅ Replacement vehicle assigned due to breakdown. ' ||
        'Old vehicle: ' || COALESCE(v_old_vehicle_registration, 'ID: ' || v_route_session.vehicle_id::TEXT) || '. ' ||
        'New vehicle: ' || COALESCE(v_new_vehicle_registration, 'ID: ' || p_replacement_vehicle_id::TEXT) || '. ' ||
        'Assigned at: ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS') || '.',
        v_user_id
    );
    
    -- Create update for replacement vehicle
    INSERT INTO vehicle_updates (
        vehicle_id,
        update_text,
        updated_by
    ) VALUES (
        p_replacement_vehicle_id,
        '✅ Assigned as replacement vehicle for route due to breakdown. ' ||
        'Replaced vehicle: ' || COALESCE(v_old_vehicle_registration, 'ID: ' || v_route_session.vehicle_id::TEXT) || '. ' ||
        'Assigned at: ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS') || '.',
        v_user_id
    );
    
    RETURN v_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION assign_replacement_vehicle IS 'Assigns a replacement vehicle to a breakdown, updates the route, and creates route and vehicle update entries';

