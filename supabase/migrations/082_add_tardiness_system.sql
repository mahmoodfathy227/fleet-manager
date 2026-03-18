-- ====================================================
-- TARDINESS SYSTEM
-- ====================================================
-- Tracks driver tardiness reports with coordinator approval workflow
-- ====================================================

-- Create tardiness_reports table
CREATE TABLE IF NOT EXISTS tardiness_reports (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
  route_session_id INTEGER REFERENCES route_sessions(id) ON DELETE SET NULL,
  session_type VARCHAR, -- 'AM' or 'PM'
  session_date DATE NOT NULL,
  reason VARCHAR NOT NULL, -- Selected reason from dropdown
  additional_notes TEXT,
  status VARCHAR DEFAULT 'pending', -- 'pending', 'approved', 'declined'
  coordinator_id INTEGER REFERENCES employees(id) ON DELETE SET NULL, -- Coordinator who approved/declined
  coordinator_notes TEXT, -- Notes from coordinator
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tardiness_reports_driver ON tardiness_reports(driver_id);
CREATE INDEX IF NOT EXISTS idx_tardiness_reports_status ON tardiness_reports(status);
CREATE INDEX IF NOT EXISTS idx_tardiness_reports_route_session ON tardiness_reports(route_session_id);
CREATE INDEX IF NOT EXISTS idx_tardiness_reports_created_at ON tardiness_reports(created_at);

-- Enable Row Level Security
ALTER TABLE tardiness_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first so migration is idempotent if policies already exist)
DROP POLICY IF EXISTS "Allow authenticated users to read tardiness reports" ON tardiness_reports;
DROP POLICY IF EXISTS "Allow authenticated users to insert tardiness reports" ON tardiness_reports;
DROP POLICY IF EXISTS "Allow authenticated users to update tardiness reports" ON tardiness_reports;

CREATE POLICY "Allow authenticated users to read tardiness reports"
  ON tardiness_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert tardiness reports"
  ON tardiness_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update tardiness reports"
  ON tardiness_reports FOR UPDATE
  TO authenticated
  USING (true);

-- Add comments
COMMENT ON TABLE tardiness_reports IS 'Tracks driver tardiness reports with coordinator approval workflow';
COMMENT ON COLUMN tardiness_reports.status IS 'Status: pending (awaiting coordinator review), approved, declined';
COMMENT ON COLUMN tardiness_reports.reason IS 'Reason selected by driver for being late';

-- Update notifications table to support tardiness notifications
-- The notifications table already has the necessary structure, we just need to use it
-- with notification_type = 'driver_tardiness'

-- Create function to create tardiness notification for coordinators
CREATE OR REPLACE FUNCTION create_tardiness_notification(
  p_tardiness_report_id INTEGER,
  p_driver_id INTEGER,
  p_route_id INTEGER,
  p_reason VARCHAR
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id INTEGER;
  v_driver_name VARCHAR;
  v_route_number VARCHAR;
  v_coordinator_id INTEGER;
  v_coordinator_email VARCHAR;
  v_token VARCHAR;
  v_session_type VARCHAR;
  v_session_date DATE;
BEGIN
  -- Get driver name
  SELECT full_name INTO v_driver_name
  FROM employees
  WHERE id = p_driver_id;

  -- Get route number if route_id is provided
  IF p_route_id IS NOT NULL THEN
    SELECT route_number INTO v_route_number
    FROM routes
    WHERE id = p_route_id;
  END IF;

  -- Get session_type and session_date from tardiness report
  SELECT session_type, session_date
  INTO v_session_type, v_session_date
  FROM tardiness_reports
  WHERE id = p_tardiness_report_id;

  -- Find a coordinator (first active coordinator found)
  SELECT e.id, e.personal_email
  INTO v_coordinator_id, v_coordinator_email
  FROM employees e
  WHERE e.role = 'Coordinator'
    AND e.employment_status = 'Active'
  ORDER BY e.id
  LIMIT 1;

  -- If no coordinator found, return NULL (notification won't be created)
  IF v_coordinator_id IS NULL THEN
    RAISE EXCEPTION 'No active coordinator found to receive tardiness notification';
  END IF;

  -- Generate unique token
  BEGIN
    v_token := encode(gen_random_bytes(32), 'hex');
  EXCEPTION WHEN OTHERS THEN
    v_token := md5(p_tardiness_report_id::text || p_driver_id::text || CURRENT_TIMESTAMP::text || random()::text);
  END;

  -- Create notification for coordinators
  INSERT INTO notifications (
    notification_type,
    entity_type,
    entity_id,
    certificate_type, -- Reusing this field for tardiness_report_id
    certificate_name, -- Reusing this field for reason
    expiry_date, -- Reusing this field for session_date
    days_until_expiry, -- Reusing this field for route_id
    recipient_employee_id,
    recipient_email,
    status,
    email_token,
    details
  )
  VALUES (
    'driver_tardiness',
    'driver',
    p_driver_id,
    p_tardiness_report_id::VARCHAR, -- Store tardiness_report_id here
    p_reason, -- Store reason here
    COALESCE(v_session_date, CURRENT_DATE), -- Store session_date from tardiness report
    0, -- Placeholder
    v_coordinator_id,
    v_coordinator_email,
    'pending',
    v_token,
    jsonb_build_object(
      'tardiness_report_id', p_tardiness_report_id,
      'driver_id', p_driver_id,
      'driver_name', v_driver_name,
      'route_id', p_route_id,
      'route_number', v_route_number,
      'session_type', v_session_type,
      'session_date', v_session_date,
      'reason', p_reason,
      'reported_at', CURRENT_TIMESTAMP
    )
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_tardiness_notification(INTEGER, INTEGER, INTEGER, VARCHAR) TO authenticated;

COMMENT ON FUNCTION create_tardiness_notification IS 'Creates a notification for coordinators when a driver reports tardiness';

