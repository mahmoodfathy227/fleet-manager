-- vehicle_assignments was defined in old_migrations/001 but never added to the main
-- migrations chain. create_certificate_notifications (137) reads this table for
-- vehicle certificate notification recipients — without it, refresh fails with 42P01.

CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id),
  employee_id INTEGER REFERENCES employees(id),
  assigned_from DATE,
  assigned_to DATE,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_vehicle ON vehicle_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_employee ON vehicle_assignments(employee_id);

COMMENT ON TABLE vehicle_assignments IS 'Historical/active driver–vehicle assignments; used for certificate notification recipients when set';
