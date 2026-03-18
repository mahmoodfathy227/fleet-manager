-- Migration: Add Passenger Seat Assignments
-- Created: 2024-12-21
-- Description: Allows assigning passengers to specific seats on route sessions

-- =====================================================
-- 1. CREATE TABLE: route_session_seat_assignments
-- =====================================================
CREATE TABLE IF NOT EXISTS route_session_seat_assignments (
    id SERIAL PRIMARY KEY,
    route_session_id INTEGER NOT NULL REFERENCES route_sessions(id) ON DELETE CASCADE,
    passenger_id INTEGER NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    seat_type TEXT DEFAULT 'standard' CHECK (seat_type IN ('standard', 'wheelchair')),
    notes TEXT,
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure a passenger is only assigned one seat per route session
    UNIQUE(route_session_id, passenger_id),
    -- Ensure a seat is only assigned to one passenger per route session
    UNIQUE(route_session_id, seat_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seat_assignments_route_session ON route_session_seat_assignments(route_session_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_passenger ON route_session_seat_assignments(passenger_id);

COMMENT ON TABLE route_session_seat_assignments IS 'Passenger seat assignments for specific route sessions';
COMMENT ON COLUMN route_session_seat_assignments.seat_number IS 'Seat identifier (e.g., "1", "A1", "12B")';
COMMENT ON COLUMN route_session_seat_assignments.seat_type IS 'Type of seat: standard or wheelchair';

-- =====================================================
-- 2. TRIGGER: Update timestamp on changes
-- =====================================================
CREATE OR REPLACE FUNCTION update_seat_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_seat_assignment_timestamp ON route_session_seat_assignments;

CREATE TRIGGER trigger_update_seat_assignment_timestamp
    BEFORE UPDATE ON route_session_seat_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_seat_assignment_timestamp();

-- =====================================================
-- 3. RPC FUNCTION: assign_passenger_to_seat
-- =====================================================
CREATE OR REPLACE FUNCTION assign_passenger_to_seat(
    p_route_session_id INTEGER,
    p_passenger_id INTEGER,
    p_seat_number TEXT,
    p_seat_type TEXT DEFAULT 'standard',
    p_notes TEXT DEFAULT NULL
)
RETURNS route_session_seat_assignments AS $$
DECLARE
    v_assignment route_session_seat_assignments;
    v_user_id INTEGER;
    v_passenger_mobility TEXT;
BEGIN
    -- Get current user ID from auth (if exists)
    BEGIN
        SELECT id INTO v_user_id FROM users WHERE user_id = auth.uid();
    EXCEPTION
        WHEN OTHERS THEN
            v_user_id := NULL;
    END;
    
    -- Validate route session exists
    IF NOT EXISTS (SELECT 1 FROM route_sessions WHERE id = p_route_session_id) THEN
        RAISE EXCEPTION 'Route session not found: %', p_route_session_id;
    END IF;
    
    -- Validate passenger exists
    IF NOT EXISTS (SELECT 1 FROM passengers WHERE id = p_passenger_id) THEN
        RAISE EXCEPTION 'Passenger not found: %', p_passenger_id;
    END IF;
    
    -- Get passenger mobility type
    SELECT mobility_type INTO v_passenger_mobility 
    FROM passengers 
    WHERE id = p_passenger_id;
    
    -- Warn if wheelchair passenger is not assigned to wheelchair seat
    IF v_passenger_mobility = 'Wheelchair' AND p_seat_type != 'wheelchair' THEN
        RAISE WARNING 'Wheelchair passenger assigned to non-wheelchair seat';
    END IF;

    -- Insert or update seat assignment
    INSERT INTO route_session_seat_assignments (
        route_session_id,
        passenger_id,
        seat_number,
        seat_type,
        notes,
        assigned_by,
        assigned_at
    ) VALUES (
        p_route_session_id,
        p_passenger_id,
        p_seat_number,
        p_seat_type,
        p_notes,
        v_user_id,
        now()
    )
    ON CONFLICT (route_session_id, passenger_id) 
    DO UPDATE SET
        seat_number = EXCLUDED.seat_number,
        seat_type = EXCLUDED.seat_type,
        notes = EXCLUDED.notes,
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = EXCLUDED.assigned_at,
        updated_at = now()
    RETURNING * INTO v_assignment;

    RETURN v_assignment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION assign_passenger_to_seat IS 'Assigns a passenger to a specific seat on a route session';

-- =====================================================
-- 4. RPC FUNCTION: unassign_passenger_seat
-- =====================================================
CREATE OR REPLACE FUNCTION unassign_passenger_seat(
    p_route_session_id INTEGER,
    p_passenger_id INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM route_session_seat_assignments
    WHERE route_session_id = p_route_session_id
      AND passenger_id = p_passenger_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION unassign_passenger_seat IS 'Removes a passenger seat assignment';

-- =====================================================
-- 5. RPC FUNCTION: get_route_session_seating
-- =====================================================
CREATE OR REPLACE FUNCTION get_route_session_seating(p_route_session_id INTEGER)
RETURNS TABLE (
    seat_number TEXT,
    seat_type TEXT,
    passenger_id INTEGER,
    passenger_name TEXT,
    mobility_type TEXT,
    sen_requirements TEXT,
    assigned_by_name TEXT,
    assigned_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rssa.seat_number::TEXT AS seat_number,
        rssa.seat_type::TEXT AS seat_type,
        rssa.passenger_id::INTEGER AS passenger_id,
        p.full_name::TEXT AS passenger_name,
        p.mobility_type::TEXT AS mobility_type,
        p.sen_requirements::TEXT AS sen_requirements,
        COALESCE(e.full_name::TEXT, 'System'::TEXT) AS assigned_by_name,
        rssa.assigned_at::TIMESTAMPTZ AS assigned_at
    FROM route_session_seat_assignments rssa
    INNER JOIN passengers p ON rssa.passenger_id = p.id
    LEFT JOIN users u ON rssa.assigned_by = u.id
    LEFT JOIN employees e ON u.employee_id = e.id
    WHERE rssa.route_session_id = p_route_session_id
    ORDER BY rssa.seat_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_route_session_seating IS 'Gets all seat assignments for a route session with passenger details';

-- =====================================================
-- 6. VIEW: route_session_seating_overview
-- =====================================================
CREATE OR REPLACE VIEW route_session_seating_overview AS
SELECT 
    rs.id AS route_session_id,
    rs.route_id,
    rs.session_date,
    rs.session_type,
    r.route_number,
    v.id AS vehicle_id,
    v.registration AS vehicle_registration,
    vsp.total_capacity,
    vsp.wheelchair_spaces,
    COUNT(rssa.id) AS assigned_seats,
    COUNT(CASE WHEN p.mobility_type = 'Wheelchair' THEN 1 END) AS wheelchair_passengers,
    vsp.total_capacity - COUNT(rssa.id) AS available_seats
FROM route_sessions rs
INNER JOIN routes r ON rs.route_id = r.id
LEFT JOIN vehicles v ON r.vehicle_id = v.id
LEFT JOIN vehicle_seating_plans vsp ON v.id = vsp.vehicle_id AND vsp.is_active = true
LEFT JOIN route_session_seat_assignments rssa ON rs.id = rssa.route_session_id
LEFT JOIN passengers p ON rssa.passenger_id = p.id
GROUP BY rs.id, rs.route_id, rs.session_date, rs.session_type, r.route_number, 
         v.id, v.registration, vsp.total_capacity, vsp.wheelchair_spaces
ORDER BY rs.session_date DESC, rs.session_type;

COMMENT ON VIEW route_session_seating_overview IS 'Overview of seat assignments per route session';

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================
ALTER TABLE route_session_seat_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view seat assignments" ON route_session_seat_assignments;
DROP POLICY IF EXISTS "Authenticated users can manage seat assignments" ON route_session_seat_assignments;

-- Allow authenticated users to read seat assignments
CREATE POLICY "Authenticated users can view seat assignments"
    ON route_session_seat_assignments FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to manage seat assignments
CREATE POLICY "Authenticated users can manage seat assignments"
    ON route_session_seat_assignments FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION assign_passenger_to_seat TO authenticated;
GRANT EXECUTE ON FUNCTION unassign_passenger_seat TO authenticated;
GRANT EXECUTE ON FUNCTION get_route_session_seating TO authenticated;

