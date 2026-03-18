-- Migration: Add Vehicle Breakdown Reporting System
-- Created: 2024-12-21
-- Description: Allows drivers/PA to report vehicle breakdowns and find replacement vehicles

-- =====================================================
-- 0. ADD details COLUMN TO notifications (if not exists)
-- =====================================================
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS details JSONB;

COMMENT ON COLUMN notifications.details IS 'Additional details in JSON format (e.g., breakdown info)';

-- =====================================================
-- 1. CREATE TABLE: vehicle_breakdowns
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicle_breakdowns (
    id SERIAL PRIMARY KEY,
    route_session_id INTEGER NOT NULL REFERENCES route_sessions(id) ON DELETE CASCADE,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    reported_by INTEGER REFERENCES employees(id),
    reported_at TIMESTAMPTZ DEFAULT now(),
    description TEXT,
    location TEXT,
    status VARCHAR DEFAULT 'reported' CHECK (status IN ('reported', 'replacement_assigned', 'resolved', 'cancelled')),
    replacement_vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    replacement_assigned_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_breakdowns_route_session ON vehicle_breakdowns(route_session_id);
CREATE INDEX IF NOT EXISTS idx_breakdowns_vehicle ON vehicle_breakdowns(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_breakdowns_status ON vehicle_breakdowns(status);
CREATE INDEX IF NOT EXISTS idx_breakdowns_reported_at ON vehicle_breakdowns(reported_at DESC);

COMMENT ON TABLE vehicle_breakdowns IS 'Vehicle breakdown reports from drivers/PA during route sessions';
COMMENT ON COLUMN vehicle_breakdowns.status IS 'Status: reported, replacement_assigned, resolved, cancelled';

-- =====================================================
-- 2. TRIGGER: Update timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_breakdown_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_breakdown_timestamp ON vehicle_breakdowns;

CREATE TRIGGER trigger_update_breakdown_timestamp
    BEFORE UPDATE ON vehicle_breakdowns
    FOR EACH ROW
    EXECUTE FUNCTION update_breakdown_timestamp();

-- =====================================================
-- 3. RPC FUNCTION: report_vehicle_breakdown
-- =====================================================
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
            'reported_at', v_breakdown.reported_at
        )
    );
    
    RETURN v_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION report_vehicle_breakdown IS 'Reports a vehicle breakdown during an active route session';

-- =====================================================
-- 4. RPC FUNCTION: find_replacement_vehicle
-- =====================================================
CREATE OR REPLACE FUNCTION find_replacement_vehicle(p_vehicle_id INTEGER)
RETURNS TABLE (
    vehicle_id INTEGER,
    registration_number TEXT,
    make TEXT,
    model TEXT,
    seating_plan_name TEXT,
    total_capacity INTEGER,
    rows INTEGER,
    seats_per_row INTEGER,
    wheelchair_spaces INTEGER,
    match_type TEXT,
    capacity_difference INTEGER
) AS $$
DECLARE
    v_plan_capacity INTEGER;
    v_plan_rows INTEGER;
    v_plan_seats_per_row INTEGER;
    v_plan_wheelchair_spaces INTEGER;
BEGIN
    -- Get the active seating plan of the broken vehicle
    SELECT 
        vsp.total_capacity,
        vsp.rows,
        vsp.seats_per_row,
        vsp.wheelchair_spaces
    INTO 
        v_plan_capacity,
        v_plan_rows,
        v_plan_seats_per_row,
        v_plan_wheelchair_spaces
    FROM vehicle_seating_plans vsp
    WHERE vsp.vehicle_id = p_vehicle_id 
      AND vsp.is_active = true
    LIMIT 1;

    -- If no plan found, return empty
    IF v_plan_capacity IS NULL THEN
        RETURN;
    END IF;

    -- First, try to find spare vehicles with EXACT seating match
    RETURN QUERY
    SELECT 
        v.id AS vehicle_id,
        COALESCE(v.registration, '')::TEXT AS registration_number,
        COALESCE(v.make, '')::TEXT AS make,
        COALESCE(v.model, '')::TEXT AS model,
        COALESCE(vsp.name, '')::TEXT AS seating_plan_name,
        vsp.total_capacity AS total_capacity,
        vsp.rows AS rows,
        vsp.seats_per_row AS seats_per_row,
        vsp.wheelchair_spaces AS wheelchair_spaces,
        'exact_spare'::TEXT AS match_type,
        0 AS capacity_difference
    FROM vehicles v
    INNER JOIN vehicle_seating_plans vsp ON v.id = vsp.vehicle_id
    WHERE vsp.is_active = true
      AND v.id != p_vehicle_id
      AND v.spare_vehicle = true
      AND (v.off_the_road IS NULL OR v.off_the_road = false)
      AND vsp.total_capacity = v_plan_capacity
      AND vsp.rows = v_plan_rows
      AND vsp.seats_per_row = v_plan_seats_per_row
      AND vsp.wheelchair_spaces = v_plan_wheelchair_spaces
      AND NOT EXISTS (
          SELECT 1 
          FROM route_sessions rs
          INNER JOIN routes r ON rs.route_id = r.id
          WHERE r.vehicle_id = v.id
            AND rs.session_date = CURRENT_DATE
            AND rs.started_at IS NOT NULL
            AND rs.ended_at IS NULL
      )
    ORDER BY v.registration
    LIMIT 5;

    -- If we found exact matches, return them
    IF FOUND THEN
        RETURN;
    END IF;

    -- Otherwise, find closest match (spare vehicles first, then others)
    RETURN QUERY
    SELECT 
        v.id AS vehicle_id,
        COALESCE(v.registration, '')::TEXT AS registration_number,
        COALESCE(v.make, '')::TEXT AS make,
        COALESCE(v.model, '')::TEXT AS model,
        COALESCE(vsp.name, '')::TEXT AS seating_plan_name,
        vsp.total_capacity AS total_capacity,
        vsp.rows AS rows,
        vsp.seats_per_row AS seats_per_row,
        vsp.wheelchair_spaces AS wheelchair_spaces,
        CASE 
            WHEN v.spare_vehicle = true THEN 'closest_spare'::TEXT
            ELSE 'closest_match'::TEXT
        END AS match_type,
        ABS(vsp.total_capacity - v_plan_capacity) AS capacity_difference
    FROM vehicles v
    INNER JOIN vehicle_seating_plans vsp ON v.id = vsp.vehicle_id
    WHERE vsp.is_active = true
      AND v.id != p_vehicle_id
      AND (v.off_the_road IS NULL OR v.off_the_road = false)
      AND vsp.total_capacity >= v_plan_capacity  -- Only vehicles with same or greater capacity
      AND vsp.wheelchair_spaces >= v_plan_wheelchair_spaces  -- Must have same or more wheelchair spaces
      AND NOT EXISTS (
          SELECT 1 
          FROM route_sessions rs
          INNER JOIN routes r ON rs.route_id = r.id
          WHERE r.vehicle_id = v.id
            AND rs.session_date = CURRENT_DATE
            AND rs.started_at IS NOT NULL
            AND rs.ended_at IS NULL
      )
    ORDER BY 
        CASE WHEN v.spare_vehicle = true THEN 0 ELSE 1 END,  -- Spare vehicles first
        ABS(vsp.total_capacity - v_plan_capacity),  -- Closest capacity match
        ABS(vsp.wheelchair_spaces - v_plan_wheelchair_spaces),  -- Closest wheelchair match
        v.registration
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION find_replacement_vehicle IS 'Finds replacement vehicles: first exact spare matches, then closest matches';

-- =====================================================
-- 5. RPC FUNCTION: assign_replacement_vehicle
-- =====================================================
CREATE OR REPLACE FUNCTION assign_replacement_vehicle(
    p_breakdown_id INTEGER,
    p_replacement_vehicle_id INTEGER
)
RETURNS vehicle_breakdowns AS $$
DECLARE
    v_breakdown vehicle_breakdowns;
    v_route_session RECORD;
BEGIN
    -- Get breakdown details
    SELECT route_id, route_session_id INTO v_route_session
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
    
    RETURN v_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION assign_replacement_vehicle IS 'Assigns a replacement vehicle to a breakdown and updates the route';

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================
ALTER TABLE vehicle_breakdowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view breakdowns" ON vehicle_breakdowns;
DROP POLICY IF EXISTS "Authenticated users can manage breakdowns" ON vehicle_breakdowns;

CREATE POLICY "Authenticated users can view breakdowns"
    ON vehicle_breakdowns FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage breakdowns"
    ON vehicle_breakdowns FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION report_vehicle_breakdown TO authenticated;
GRANT EXECUTE ON FUNCTION find_replacement_vehicle TO authenticated;
GRANT EXECUTE ON FUNCTION assign_replacement_vehicle TO authenticated;

