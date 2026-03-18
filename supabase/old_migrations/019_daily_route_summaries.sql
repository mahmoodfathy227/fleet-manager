-- ====================================================
-- Daily Route Summaries View
-- ====================================================
-- This migration creates a view that aggregates route session data
-- with attendance counts and incident references for daily summaries
-- ====================================================

-- First, ensure incidents table has route_session_id and reference_number columns
-- (Add them if they don't exist)

-- Add route_session_id to incidents if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'incidents' AND column_name = 'route_session_id'
  ) THEN
    ALTER TABLE incidents 
    ADD COLUMN route_session_id INTEGER REFERENCES route_sessions(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_incidents_route_session ON incidents(route_session_id);
  END IF;
END $$;

-- Add reference_number to incidents if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'incidents' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE incidents 
    ADD COLUMN reference_number VARCHAR(50);
    
    CREATE INDEX IF NOT EXISTS idx_incidents_reference_number ON incidents(reference_number);
    
    -- Generate reference numbers for existing incidents (format: INC-{id})
    UPDATE incidents 
    SET reference_number = 'INC-' || id::text 
    WHERE reference_number IS NULL;
  END IF;
END $$;

-- ====================================================
-- DAILY ROUTE SUMMARIES VIEW
-- ====================================================
-- Aggregates route session data with attendance counts and incident references
-- ====================================================

-- Drop the view if it exists to allow column changes
DROP VIEW IF EXISTS daily_route_summaries CASCADE;

CREATE VIEW daily_route_summaries AS
SELECT 
  rs.id AS route_session_id,
  rs.route_id,
  r.route_number AS route_name,
  rs.session_date,
  rs.session_type,
  COALESCE(driver_emp.full_name, 'Unassigned') AS driver_name,
  COALESCE(pa_emp.full_name, 'Unassigned') AS passenger_assistant_name,
  rs.started_at,
  rs.ended_at,
  COALESCE(COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'absent' THEN rpa.passenger_id END), 0) AS absent_count,
  COALESCE(COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'present' THEN rpa.passenger_id END), 0) AS present_count,
  COALESCE(COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'late' THEN rpa.passenger_id END), 0) AS late_count,
  COALESCE(COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'excused' THEN rpa.passenger_id END), 0) AS excused_count,
  COALESCE(COUNT(DISTINCT CASE WHEN i.id IS NOT NULL THEN i.id END), 0) AS incident_count,
  COALESCE(
    NULLIF(
      ARRAY_AGG(DISTINCT i.id::VARCHAR) 
      FILTER (WHERE i.id IS NOT NULL),
      '{}'
    ),
    ARRAY[]::VARCHAR[]
  ) AS incident_refs
FROM route_sessions rs
INNER JOIN routes r ON r.id = rs.route_id
LEFT JOIN employees driver_emp ON driver_emp.id = rs.driver_id
LEFT JOIN employees pa_emp ON pa_emp.id = rs.passenger_assistant_id
LEFT JOIN route_passenger_attendance rpa ON rpa.route_session_id = rs.id
LEFT JOIN incidents i ON i.route_session_id = rs.id
GROUP BY 
  rs.id,
  rs.route_id,
  r.route_number,
  rs.session_date,
  rs.session_type,
  driver_emp.full_name,
  pa_emp.full_name,
  rs.started_at,
  rs.ended_at
ORDER BY rs.session_date DESC, r.route_number ASC;

-- Grant permissions on the view
GRANT SELECT ON daily_route_summaries TO authenticated;
GRANT SELECT ON daily_route_summaries TO anon;

-- Add helpful comments
COMMENT ON VIEW daily_route_summaries IS 'Daily summaries of route sessions with attendance counts and incident references';
COMMENT ON COLUMN daily_route_summaries.route_session_id IS 'Unique identifier for the route session';
COMMENT ON COLUMN daily_route_summaries.route_name IS 'Route number/name';
COMMENT ON COLUMN daily_route_summaries.session_type IS 'AM or PM session';
COMMENT ON COLUMN daily_route_summaries.absent_count IS 'Number of passengers marked as absent';
COMMENT ON COLUMN daily_route_summaries.present_count IS 'Number of passengers marked as present';
COMMENT ON COLUMN daily_route_summaries.incident_refs IS 'Array of incident reference numbers linked to this session';

-- ====================================================
-- RPC FUNCTION: get_daily_route_summaries
-- ====================================================
-- Returns daily route summaries for a specific date
-- ====================================================

-- Drop the function if it exists to allow return type changes
DROP FUNCTION IF EXISTS get_daily_route_summaries(DATE) CASCADE;

CREATE FUNCTION get_daily_route_summaries(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  route_session_id INTEGER,
  route_id INTEGER,
  route_name VARCHAR,
  session_date DATE,
  session_type VARCHAR,
  driver_name TEXT,
  passenger_assistant_name TEXT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  absent_count BIGINT,
  present_count BIGINT,
  late_count BIGINT,
  excused_count BIGINT,
  incident_count BIGINT,
  incident_refs VARCHAR[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    drs.route_session_id,
    drs.route_id,
    drs.route_name,
    drs.session_date,
    drs.session_type,
    drs.driver_name,
    drs.passenger_assistant_name,
    drs.started_at,
    drs.ended_at,
    drs.absent_count,
    drs.present_count,
    drs.late_count,
    drs.excused_count,
    drs.incident_count,
    drs.incident_refs
  FROM daily_route_summaries drs
  WHERE drs.session_date = p_date
  ORDER BY drs.route_name ASC, drs.session_type ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_daily_route_summaries(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_route_summaries(DATE) TO anon;

-- Add helpful comment
COMMENT ON FUNCTION get_daily_route_summaries(DATE) IS 'Returns daily route summaries for a specific date (defaults to today)';

