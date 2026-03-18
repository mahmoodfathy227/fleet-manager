-- ====================================================
-- CALL LOGS
-- ====================================================
-- Track phone calls related to fleet operations
-- (parent inquiries, incident reports, schedule changes, etc.)

CREATE TABLE IF NOT EXISTS call_logs (
  id SERIAL PRIMARY KEY,
  call_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  caller_name VARCHAR,
  caller_phone VARCHAR,
  caller_type VARCHAR, -- Parent, School, Employee, Other
  call_type VARCHAR, -- Inquiry, Complaint, Incident Report, Schedule Change, Other
  related_passenger_id INTEGER REFERENCES passengers(id) ON DELETE SET NULL,
  related_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  related_route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
  related_incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL,
  subject VARCHAR NOT NULL,
  notes TEXT,
  action_required BOOLEAN DEFAULT FALSE,
  action_taken TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR, -- Low, Medium, High, Urgent
  status VARCHAR DEFAULT 'Open', -- Open, In Progress, Resolved, Closed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_call_logs_date ON call_logs(call_date);
CREATE INDEX IF NOT EXISTS idx_call_logs_passenger ON call_logs(related_passenger_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_employee ON call_logs(related_employee_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_route ON call_logs(related_route_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_priority ON call_logs(priority);

-- Enable Row Level Security
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read call_logs" ON call_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert call_logs" ON call_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update call_logs" ON call_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete call_logs" ON call_logs FOR DELETE TO authenticated USING (true);

-- Add comment
COMMENT ON TABLE call_logs IS 'Tracks all phone calls related to fleet operations including inquiries, complaints, and incident reports';

-- ====================================================
-- Sample data (optional - for testing)
-- ====================================================

INSERT INTO call_logs (caller_name, caller_phone, caller_type, call_type, subject, notes, priority, status, action_required, related_passenger_id) VALUES
('Margaret Thompson', '555-1001', 'Parent', 'Inquiry', 'Question about pickup time', 'Parent asked if pickup time could be moved 15 minutes earlier due to after-school activity. Explained current schedule constraints.', 'Low', 'Resolved', false, 1),
('Susan Wilson', '555-1003', 'Parent', 'Complaint', 'Late pickup yesterday', 'Route R-101 was 20 minutes late yesterday. Weather delays on main road. Parent understanding after explanation.', 'Medium', 'Resolved', false, 2),
('Greenfield Primary', '555-2001', 'School', 'Schedule Change', 'Early dismissal next Friday', 'School closing early (1pm) for staff training. Need to adjust all Greenfield routes.', 'High', 'In Progress', true, NULL),
('Jennifer Anderson', '555-1005', 'Parent', 'Incident Report', 'Child forgot medication', 'Parent called to report child left medication at home. PA Jennifer Taylor confirmed child is safe and has emergency supplies on board.', 'High', 'Resolved', false, 4),
('Carlos Martinez', '555-1004', 'Parent', 'Inquiry', 'New wheelchair accessible vehicle', 'Asking about timeline for new wheelchair accessible vehicle. Informed expected delivery next month.', 'Low', 'Resolved', false, 3);

-- Print summary
DO $$
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'CALL LOGS TABLE CREATED';
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Table: call_logs';
  RAISE NOTICE 'Features: Track calls from parents, schools, employees';
  RAISE NOTICE 'Links to: passengers, employees, routes, incidents';
  RAISE NOTICE 'Sample data: 5 call log entries added';
  RAISE NOTICE '====================================================';
END $$;









