-- Migration: Add Vehicle Seating Plan Management System
-- Created: 2024-12-21
-- Description: Implements seating plans for vehicles with substitution vehicle finder

-- =====================================================
-- 1. CREATE TABLE: vehicle_seating_plans
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicle_seating_plans (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_capacity INTEGER NOT NULL CHECK (total_capacity > 0),
    rows INTEGER NOT NULL CHECK (rows > 0),
    seats_per_row INTEGER NOT NULL CHECK (seats_per_row > 0),
    wheelchair_spaces INTEGER DEFAULT 0 CHECK (wheelchair_spaces >= 0),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Ensure only one active plan per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_seating_plans_active_unique
ON vehicle_seating_plans(vehicle_id) WHERE is_active = true;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_seating_plans_vehicle_id ON vehicle_seating_plans(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_seating_plans_is_active ON vehicle_seating_plans(is_active);

COMMENT ON TABLE vehicle_seating_plans IS 'Seating configurations for vehicles';
COMMENT ON COLUMN vehicle_seating_plans.name IS 'Display name for the seating plan';
COMMENT ON COLUMN vehicle_seating_plans.total_capacity IS 'Total passenger capacity';
COMMENT ON COLUMN vehicle_seating_plans.rows IS 'Number of seat rows';
COMMENT ON COLUMN vehicle_seating_plans.seats_per_row IS 'Typical seats per row';
COMMENT ON COLUMN vehicle_seating_plans.wheelchair_spaces IS 'Number of wheelchair accessible spaces';
COMMENT ON COLUMN vehicle_seating_plans.is_active IS 'Only one active plan per vehicle';

-- =====================================================
-- 2. CREATE TABLE: seating_plan_seats (detailed layout)
-- =====================================================
CREATE TABLE IF NOT EXISTS seating_plan_seats (
    id SERIAL PRIMARY KEY,
    seating_plan_id INTEGER NOT NULL REFERENCES vehicle_seating_plans(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    seat_type TEXT DEFAULT 'standard' CHECK (seat_type IN ('standard', 'wheelchair', 'exit_row')),
    is_accessible BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seating_plan_seats_plan_id ON seating_plan_seats(seating_plan_id);

COMMENT ON TABLE seating_plan_seats IS 'Detailed seat assignments for seating plans';
COMMENT ON COLUMN seating_plan_seats.seat_number IS 'Seat identifier (e.g., "1", "A1", "12B")';
COMMENT ON COLUMN seating_plan_seats.seat_type IS 'Type of seat: standard, wheelchair, exit_row';

-- =====================================================
-- 3. TRIGGER: Update timestamp on changes
-- =====================================================
CREATE OR REPLACE FUNCTION update_vehicle_seating_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vehicle_seating_plan_timestamp ON vehicle_seating_plans;

CREATE TRIGGER trigger_update_vehicle_seating_plan_timestamp
    BEFORE UPDATE ON vehicle_seating_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_seating_plan_timestamp();

-- =====================================================
-- 4. RPC FUNCTION: update_vehicle_seating_plan
-- =====================================================
CREATE OR REPLACE FUNCTION update_vehicle_seating_plan(
    p_vehicle_id INTEGER,
    p_name TEXT,
    p_total_capacity INTEGER,
    p_rows INTEGER,
    p_seats_per_row INTEGER,
    p_wheelchair_spaces INTEGER DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS vehicle_seating_plans AS $$
DECLARE
    v_new_plan vehicle_seating_plans;
    v_user_id INTEGER;
BEGIN
    -- Get current user ID from auth (if exists)
    BEGIN
        SELECT id INTO v_user_id FROM users WHERE user_id = auth.uid();
    EXCEPTION
        WHEN OTHERS THEN
            v_user_id := NULL;
    END;
    
    -- Validate vehicle exists
    IF NOT EXISTS (SELECT 1 FROM vehicles WHERE id = p_vehicle_id) THEN
        RAISE EXCEPTION 'Vehicle not found: %', p_vehicle_id;
    END IF;

    -- Validate inputs
    IF p_total_capacity <= 0 THEN
        RAISE EXCEPTION 'Total capacity must be greater than 0';
    END IF;
    
    IF p_rows <= 0 THEN
        RAISE EXCEPTION 'Rows must be greater than 0';
    END IF;
    
    IF p_seats_per_row <= 0 THEN
        RAISE EXCEPTION 'Seats per row must be greater than 0';
    END IF;
    
    IF p_wheelchair_spaces < 0 THEN
        RAISE EXCEPTION 'Wheelchair spaces cannot be negative';
    END IF;

    -- Deactivate all existing plans for this vehicle
    UPDATE vehicle_seating_plans
    SET is_active = false,
        updated_at = now(),
        updated_by = v_user_id
    WHERE vehicle_id = p_vehicle_id AND is_active = true;

    -- Create new active plan
    INSERT INTO vehicle_seating_plans (
        vehicle_id,
        name,
        total_capacity,
        rows,
        seats_per_row,
        wheelchair_spaces,
        notes,
        is_active,
        created_by,
        updated_by
    ) VALUES (
        p_vehicle_id,
        p_name,
        p_total_capacity,
        p_rows,
        p_seats_per_row,
        p_wheelchair_spaces,
        p_notes,
        true,
        v_user_id,
        v_user_id
    )
    RETURNING * INTO v_new_plan;

    RETURN v_new_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_vehicle_seating_plan IS 'Creates a new active seating plan for a vehicle, deactivating previous plans';

-- =====================================================
-- 5. RPC FUNCTION: find_substitution_vehicles
-- =====================================================
CREATE OR REPLACE FUNCTION find_substitution_vehicles(p_vehicle_id INTEGER)
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
    status TEXT
) AS $$
DECLARE
    v_plan_capacity INTEGER;
    v_plan_rows INTEGER;
    v_plan_seats_per_row INTEGER;
    v_plan_wheelchair_spaces INTEGER;
BEGIN
    -- Get the active seating plan of the target vehicle
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

    -- First, find vehicles with EXACT seating match
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
            WHEN v.spare_vehicle = true THEN 'spare'
            WHEN v.off_the_road = true THEN 'vor'
            ELSE 'active'
        END::TEXT AS status
    FROM vehicles v
    INNER JOIN vehicle_seating_plans vsp ON v.id = vsp.vehicle_id
    WHERE vsp.is_active = true
      AND vsp.total_capacity = v_plan_capacity
      AND vsp.rows = v_plan_rows
      AND vsp.seats_per_row = v_plan_seats_per_row
      AND vsp.wheelchair_spaces = v_plan_wheelchair_spaces
      AND v.id != p_vehicle_id
      AND (v.spare_vehicle IS NULL OR v.spare_vehicle = false)
      AND (v.off_the_road IS NULL OR v.off_the_road = false)
      AND NOT EXISTS (
          -- Check if vehicle is currently assigned to an active route session
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
        v.registration
    LIMIT 5;

    -- Also return similar seating plans (same or greater capacity, same or more wheelchair spaces)
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
            WHEN v.spare_vehicle = true THEN 'spare'
            WHEN v.off_the_road = true THEN 'vor'
            ELSE 'active'
        END::TEXT AS status
    FROM vehicles v
    INNER JOIN vehicle_seating_plans vsp ON v.id = vsp.vehicle_id
    WHERE vsp.is_active = true
      AND v.id != p_vehicle_id
      AND (v.off_the_road IS NULL OR v.off_the_road = false)
      AND vsp.total_capacity >= v_plan_capacity  -- Same or greater capacity
      AND vsp.wheelchair_spaces >= v_plan_wheelchair_spaces  -- Same or more wheelchair spaces
      AND NOT (
        -- Exclude exact matches (already returned above)
        vsp.total_capacity = v_plan_capacity
        AND vsp.rows = v_plan_rows
        AND vsp.seats_per_row = v_plan_seats_per_row
        AND vsp.wheelchair_spaces = v_plan_wheelchair_spaces
      )
      AND NOT EXISTS (
          -- Check if vehicle is currently assigned to an active route session
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

COMMENT ON FUNCTION find_substitution_vehicles IS 'Finds available vehicles with identical seating layout for emergency substitution';

-- =====================================================
-- 6. VIEW: vehicle_substitution_matrix (optional)
-- =====================================================
CREATE OR REPLACE VIEW vehicle_substitution_matrix AS
SELECT 
    v1.id AS primary_vehicle_id,
    v1.registration AS primary_vehicle_reg,
    v2.id AS substitute_vehicle_id,
    v2.registration AS substitute_vehicle_reg,
    vsp1.name AS seating_plan_name,
    vsp1.total_capacity AS capacity,
    vsp1.wheelchair_spaces
FROM vehicles v1
INNER JOIN vehicle_seating_plans vsp1 ON v1.id = vsp1.vehicle_id AND vsp1.is_active = true
INNER JOIN vehicle_seating_plans vsp2 ON 
    vsp2.is_active = true
    AND vsp2.total_capacity = vsp1.total_capacity
    AND vsp2.rows = vsp1.rows
    AND vsp2.seats_per_row = vsp1.seats_per_row
    AND vsp2.wheelchair_spaces = vsp1.wheelchair_spaces
INNER JOIN vehicles v2 ON v2.id = vsp2.vehicle_id
WHERE v1.id != v2.id
  AND (v2.spare_vehicle IS NULL OR v2.spare_vehicle = false)
  AND (v2.off_the_road IS NULL OR v2.off_the_road = false)
ORDER BY v1.registration, v2.registration;

COMMENT ON VIEW vehicle_substitution_matrix IS 'Matrix showing all possible vehicle substitutions based on seating plans';

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================
ALTER TABLE vehicle_seating_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_plan_seats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view seating plans" ON vehicle_seating_plans;
DROP POLICY IF EXISTS "Authenticated users can manage seating plans" ON vehicle_seating_plans;
DROP POLICY IF EXISTS "Authenticated users can view seat details" ON seating_plan_seats;
DROP POLICY IF EXISTS "Authenticated users can manage seat details" ON seating_plan_seats;

-- Allow authenticated users to read seating plans
CREATE POLICY "Authenticated users can view seating plans"
    ON vehicle_seating_plans FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to create/update seating plans
CREATE POLICY "Authenticated users can manage seating plans"
    ON vehicle_seating_plans FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read seat details
CREATE POLICY "Authenticated users can view seat details"
    ON seating_plan_seats FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to manage seat details
CREATE POLICY "Authenticated users can manage seat details"
    ON seating_plan_seats FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION update_vehicle_seating_plan TO authenticated;
GRANT EXECUTE ON FUNCTION find_substitution_vehicles TO authenticated;

