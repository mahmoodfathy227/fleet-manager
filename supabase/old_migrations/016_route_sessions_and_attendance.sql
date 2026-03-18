-- ====================================================
-- Route Sessions and Passenger Attendance
-- ====================================================
-- This migration adds support for:
-- 1. Route Sessions (AM/PM daily services)
-- 2. Passenger Attendance tracking per session
-- 3. Route History views for past services
-- ====================================================

-- ====================================================
-- ROUTE SESSIONS
-- ====================================================
-- Each route has a route_sessions table entry for every day it runs.
-- Tracks AM/PM sessions with driver, PA, start/end times, and notes.
-- ====================================================

CREATE TABLE IF NOT EXISTS route_sessions (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_type VARCHAR(2) NOT NULL CHECK (session_type IN ('AM', 'PM')),
  driver_id INTEGER REFERENCES drivers(employee_id) ON DELETE SET NULL,
  passenger_assistant_id INTEGER REFERENCES passenger_assistants(employee_id) ON DELETE SET NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_route_session UNIQUE (route_id, session_date, session_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_route_sessions_route_id ON route_sessions(route_id);
CREATE INDEX IF NOT EXISTS idx_route_sessions_date ON route_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_route_sessions_type ON route_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_route_sessions_date_type ON route_sessions(session_date, session_type);
CREATE INDEX IF NOT EXISTS idx_route_sessions_driver ON route_sessions(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_sessions_pa ON route_sessions(passenger_assistant_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_route_sessions_updated_at ON route_sessions;
CREATE TRIGGER trigger_update_route_sessions_updated_at
  BEFORE UPDATE ON route_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE route_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON route_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON route_sessions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON route_sessions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON route_sessions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE route_sessions IS 'Tracks daily AM/PM service sessions for each route';
COMMENT ON COLUMN route_sessions.route_id IS 'References the route this session belongs to';
COMMENT ON COLUMN route_sessions.session_date IS 'Date of the service session';
COMMENT ON COLUMN route_sessions.session_type IS 'Type of session: AM (morning) or PM (afternoon)';
COMMENT ON COLUMN route_sessions.driver_id IS 'References the driver assigned to this session';
COMMENT ON COLUMN route_sessions.passenger_assistant_id IS 'References the passenger assistant assigned to this session';
COMMENT ON COLUMN route_sessions.started_at IS 'Timestamp when the session started';
COMMENT ON COLUMN route_sessions.ended_at IS 'Timestamp when the session ended';

-- ====================================================
-- PASSENGER ATTENDANCE
-- ====================================================
-- Tracks attendance status for each passenger per route session.
-- Supports statuses: present, absent, late, excused.
-- ====================================================

CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

CREATE TABLE IF NOT EXISTS route_passenger_attendance (
  id SERIAL PRIMARY KEY,
  route_session_id INTEGER NOT NULL REFERENCES route_sessions(id) ON DELETE CASCADE,
  passenger_id INTEGER NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  attendance_status attendance_status NOT NULL DEFAULT 'absent',
  notes TEXT,
  marked_by INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_passenger_session_attendance UNIQUE (route_session_id, passenger_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_route_session ON route_passenger_attendance(route_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_passenger ON route_passenger_attendance(passenger_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON route_passenger_attendance(attendance_status);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_by ON route_passenger_attendance(marked_by);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_at ON route_passenger_attendance(marked_at);

-- Enable Row Level Security
ALTER TABLE route_passenger_attendance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON route_passenger_attendance
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON route_passenger_attendance
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON route_passenger_attendance
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON route_passenger_attendance
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE route_passenger_attendance IS 'Tracks passenger attendance status for each route session';
COMMENT ON COLUMN route_passenger_attendance.route_session_id IS 'References the route session this attendance record belongs to';
COMMENT ON COLUMN route_passenger_attendance.passenger_id IS 'References the passenger whose attendance is being tracked';
COMMENT ON COLUMN route_passenger_attendance.attendance_status IS 'Attendance status: present, absent, late, or excused';
COMMENT ON COLUMN route_passenger_attendance.marked_by IS 'References the employee who marked this attendance';
COMMENT ON COLUMN route_passenger_attendance.marked_at IS 'Timestamp when attendance was marked';

-- ====================================================
-- ROUTE SERVICE HISTORY VIEW
-- ====================================================
-- Shows every AM/PM session for every route with aggregated attendance counts.
-- Ordered by session_date DESC, session_type ASC.
-- ====================================================

CREATE OR REPLACE VIEW route_service_history AS
SELECT
  -- Route Information
  rs.route_id,
  r.route_number AS route_name,
  
  -- Session Information
  rs.id AS session_id,
  rs.session_date,
  rs.session_type,
  
  -- Crew Information
  rs.driver_id,
  driver_emp.full_name AS driver_name,
  rs.passenger_assistant_id,
  pa_emp.full_name AS passenger_assistant_name,
  
  -- Session Timing
  rs.started_at,
  rs.ended_at,
  rs.notes,
  
  -- Attendance Aggregates
  COUNT(DISTINCT p.id) AS total_passengers,
  COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'present' THEN rpa.passenger_id END) AS present_count,
  COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'absent' THEN rpa.passenger_id END) AS absent_count,
  COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'late' THEN rpa.passenger_id END) AS late_count,
  COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'excused' THEN rpa.passenger_id END) AS excused_count,
  COUNT(DISTINCT rpa.passenger_id) AS attendance_marked_count,
  
  -- Timestamps
  rs.created_at,
  rs.updated_at

FROM route_sessions rs
INNER JOIN routes r ON r.id = rs.route_id
LEFT JOIN drivers d ON d.employee_id = rs.driver_id
LEFT JOIN employees driver_emp ON driver_emp.id = rs.driver_id
LEFT JOIN passenger_assistants pa ON pa.employee_id = rs.passenger_assistant_id
LEFT JOIN employees pa_emp ON pa_emp.id = rs.passenger_assistant_id
LEFT JOIN passengers p ON p.route_id = rs.route_id
LEFT JOIN route_passenger_attendance rpa ON rpa.route_session_id = rs.id AND rpa.passenger_id = p.id

GROUP BY
  rs.id,
  rs.route_id,
  r.route_number,
  rs.session_date,
  rs.session_type,
  rs.driver_id,
  driver_emp.full_name,
  rs.passenger_assistant_id,
  pa_emp.full_name,
  rs.started_at,
  rs.ended_at,
  rs.notes,
  rs.created_at,
  rs.updated_at

ORDER BY rs.session_date DESC, rs.session_type ASC;

-- Grant permissions
GRANT SELECT ON route_service_history TO authenticated;
GRANT SELECT ON route_service_history TO anon;

-- Add view comment
COMMENT ON VIEW route_service_history IS 
'Comprehensive view of all route service sessions with attendance aggregates.
Shows every AM/PM session for every route with driver, PA, and attendance counts.
Ordered by session_date DESC, session_type ASC.
Example: SELECT * FROM route_service_history WHERE route_id = 1;';

-- ====================================================
-- ROUTE ATTENDANCE SUMMARY VIEW
-- ====================================================
-- Grouped by route_session_id with totals for each attendance status.
-- ====================================================

CREATE OR REPLACE VIEW route_attendance_summary AS
SELECT
  rs.id AS route_session_id,
  rs.route_id,
  r.route_number AS route_name,
  rs.session_date,
  rs.session_type,
  COUNT(DISTINCT rpa.passenger_id) AS total_attendance_records,
  COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'present' THEN rpa.passenger_id END) AS present_count,
  COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'absent' THEN rpa.passenger_id END) AS absent_count,
  COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'late' THEN rpa.passenger_id END) AS late_count,
  COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'excused' THEN rpa.passenger_id END) AS excused_count,
  COUNT(DISTINCT p.id) AS total_passengers_on_route,
  ROUND(
    (COUNT(DISTINCT CASE WHEN rpa.attendance_status = 'present' THEN rpa.passenger_id END)::NUMERIC / 
     NULLIF(COUNT(DISTINCT p.id), 0)) * 100, 
    2
  ) AS attendance_percentage

FROM route_sessions rs
LEFT JOIN routes r ON r.id = rs.route_id
LEFT JOIN passengers p ON p.route_id = rs.route_id
LEFT JOIN route_passenger_attendance rpa ON rpa.route_session_id = rs.id

GROUP BY
  rs.id,
  rs.route_id,
  r.route_number,
  rs.session_date,
  rs.session_type

ORDER BY rs.session_date DESC, rs.session_type ASC;

-- Grant permissions
GRANT SELECT ON route_attendance_summary TO authenticated;
GRANT SELECT ON route_attendance_summary TO anon;

-- Add view comment
COMMENT ON VIEW route_attendance_summary IS 
'Summary view of attendance statistics grouped by route session.
Provides attendance counts and percentages for each session.
Example: SELECT * FROM route_attendance_summary WHERE route_id = 1;';

-- ====================================================
-- PASSENGER ATTENDANCE HISTORY VIEW
-- ====================================================
-- List of all attendance records per passenger including route info + session date/type.
-- ====================================================

CREATE OR REPLACE VIEW passenger_attendance_history AS
SELECT
  -- Passenger Information
  p.id AS passenger_id,
  p.full_name AS passenger_name,
  
  -- Route Information
  r.id AS route_id,
  r.route_number AS route_name,
  
  -- Session Information
  rs.id AS route_session_id,
  rs.session_date,
  rs.session_type,
  
  -- Attendance Information
  rpa.id AS attendance_id,
  rpa.attendance_status,
  rpa.notes AS attendance_notes,
  rpa.marked_by,
  marker_emp.full_name AS marked_by_name,
  rpa.marked_at,
  
  -- Timestamps
  rpa.created_at

FROM route_passenger_attendance rpa
INNER JOIN route_sessions rs ON rs.id = rpa.route_session_id
INNER JOIN passengers p ON p.id = rpa.passenger_id
INNER JOIN routes r ON r.id = rs.route_id
LEFT JOIN employees marker_emp ON marker_emp.id = rpa.marked_by

ORDER BY 
  p.full_name,
  rs.session_date DESC,
  rs.session_type ASC;

-- Grant permissions
GRANT SELECT ON passenger_attendance_history TO authenticated;
GRANT SELECT ON passenger_attendance_history TO anon;

-- Add view comment
COMMENT ON VIEW passenger_attendance_history IS 
'Complete attendance history for all passengers across all route sessions.
Shows passenger name, route info, session details, and attendance status.
Ordered by passenger name, then session_date DESC, session_type ASC.
Example: SELECT * FROM passenger_attendance_history WHERE passenger_id = 1;';

-- ====================================================
-- RPC FUNCTION: mark_passenger_attendance
-- ====================================================
-- UPSERT-style function for marking passenger attendance.
-- Inserts new record or updates existing one on conflict.
-- ====================================================

CREATE OR REPLACE FUNCTION mark_passenger_attendance(
  p_route_session_id INTEGER,
  p_passenger_id INTEGER,
  p_status attendance_status,
  p_notes TEXT DEFAULT NULL,
  p_marked_by INTEGER DEFAULT NULL
)
RETURNS route_passenger_attendance AS $$
DECLARE
  v_result route_passenger_attendance;
BEGIN
  INSERT INTO route_passenger_attendance (
    route_session_id,
    passenger_id,
    attendance_status,
    notes,
    marked_by,
    marked_at
  )
  VALUES (
    p_route_session_id,
    p_passenger_id,
    p_status,
    p_notes,
    p_marked_by,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (route_session_id, passenger_id)
  DO UPDATE SET
    attendance_status = EXCLUDED.attendance_status,
    notes = EXCLUDED.notes,
    marked_by = EXCLUDED.marked_by,
    marked_at = CURRENT_TIMESTAMP
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_passenger_attendance TO authenticated;
GRANT EXECUTE ON FUNCTION mark_passenger_attendance TO anon;

-- Add function comment
COMMENT ON FUNCTION mark_passenger_attendance IS 
'UPSERT function for marking passenger attendance.
Inserts new attendance record or updates existing one if conflict on (route_session_id, passenger_id).
Parameters:
  - p_route_session_id: ID of the route session
  - p_passenger_id: ID of the passenger
  - p_status: Attendance status (present, absent, late, excused)
  - p_notes: Optional notes about the attendance
  - p_marked_by: Optional employee ID who marked the attendance
Returns: The created or updated attendance record.
Example: SELECT * FROM mark_passenger_attendance(1, 5, ''present'', ''On time'', 10);';

