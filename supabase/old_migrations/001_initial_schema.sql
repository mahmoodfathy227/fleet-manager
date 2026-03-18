-- ====================================================
-- Fleet Management System - Initial Schema Migration
-- ====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================
-- EMPLOYEES
-- ====================================================

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR NOT NULL,
  role VARCHAR, -- Driver, PA, Admin, Other
  employment_status VARCHAR,
  phone_number VARCHAR,
  personal_email VARCHAR,
  start_date DATE,
  end_date DATE,
  wheelchair_access BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- USERS
-- ====================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER UNIQUE REFERENCES employees(id),
  email VARCHAR NOT NULL,
  password_hash VARCHAR NOT NULL,
  role VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- PASSENGER ASSISTANTS
-- ====================================================

CREATE TABLE IF NOT EXISTS passenger_assistants (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id),
  tas_badge_number VARCHAR,
  tas_badge_expiry_date DATE,
  dbs_expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- PARENT CONTACTS
-- ====================================================

CREATE TABLE IF NOT EXISTS parent_contacts (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR NOT NULL,
  relationship VARCHAR,
  phone_number VARCHAR,
  email VARCHAR,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- DRIVERS
-- ====================================================

CREATE TABLE IF NOT EXISTS drivers (
  employee_id INTEGER PRIMARY KEY REFERENCES employees(id),
  tas_badge_number VARCHAR,
  tas_badge_expiry_date DATE,
  taxi_badge_number VARCHAR,
  taxi_badge_expiry_date DATE,
  dbs_expiry_date DATE,
  psv_license BOOLEAN,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- SCHOOLS
-- ====================================================

CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- ROUTES
-- (one route belongs to one school)
-- ====================================================

CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  route_number VARCHAR,
  school_id INTEGER REFERENCES schools(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_routes_school ON routes(school_id);

-- ====================================================
-- PASSENGERS
-- ====================================================

CREATE TABLE IF NOT EXISTS passengers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR NOT NULL,
  dob DATE,
  address TEXT,
  sen_requirements TEXT,
  school_id INTEGER REFERENCES schools(id),
  mobility_type VARCHAR,
  route_id INTEGER REFERENCES routes(id),
  seat_number VARCHAR,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_passengers_school ON passengers(school_id);
CREATE INDEX IF NOT EXISTS idx_passengers_route ON passengers(route_id);

-- ====================================================
-- PASSENGER ↔ PARENT CONTACTS (M:N)
-- ====================================================

CREATE TABLE IF NOT EXISTS passenger_parent_contacts (
  id SERIAL PRIMARY KEY,
  passenger_id INTEGER REFERENCES passengers(id),
  parent_contact_id INTEGER REFERENCES parent_contacts(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_passenger_parent_passenger ON passenger_parent_contacts(passenger_id);
CREATE INDEX IF NOT EXISTS idx_passenger_parent_contact ON passenger_parent_contacts(parent_contact_id);

-- ====================================================
-- CREW (driver + PA per route/school)
-- ====================================================

CREATE TABLE IF NOT EXISTS crew (
  id SERIAL PRIMARY KEY,
  pa_id INTEGER REFERENCES passenger_assistants(employee_id),
  driver_id INTEGER REFERENCES drivers(employee_id),
  route_id INTEGER REFERENCES routes(id),
  school_id INTEGER REFERENCES schools(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crew_pa ON crew(pa_id);
CREATE INDEX IF NOT EXISTS idx_crew_driver ON crew(driver_id);
CREATE INDEX IF NOT EXISTS idx_crew_route ON crew(route_id);

-- ====================================================
-- ROUTE POINTS
-- ====================================================

CREATE TABLE IF NOT EXISTS route_points (
  id SERIAL PRIMARY KEY,
  route_id INTEGER REFERENCES routes(id),
  point_name VARCHAR,
  address TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  stop_order INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_route_points_route ON route_points(route_id);

-- ====================================================
-- VEHICLES
-- ====================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  vehicle_identifier VARCHAR,
  registration VARCHAR,
  make VARCHAR,
  model VARCHAR,
  plate_number VARCHAR,
  plate_expiry_date DATE,
  vehicle_type VARCHAR,
  ownership_type VARCHAR,
  mot_date DATE,
  tax_date DATE,
  insurance_expiry_date DATE,
  tail_lift BOOLEAN,
  loler_expiry_date DATE,
  last_serviced DATE,
  service_booked_day DATE,
  first_aid_expiry DATE,
  fire_extinguisher_expiry DATE,
  taxi_license VARCHAR,
  taxi_registration_driver VARCHAR,
  spare_vehicle BOOLEAN,
  off_the_road BOOLEAN,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- VEHICLE CONFIGURATIONS
-- ====================================================

CREATE TABLE IF NOT EXISTS vehicle_configurations (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id),
  configuration_name VARCHAR,
  seats_total INTEGER,
  wheelchair_capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_configs_vehicle ON vehicle_configurations(vehicle_id);

-- ====================================================
-- VEHICLE ASSIGNMENTS
-- ====================================================

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

-- ====================================================
-- NEXT OF KIN
-- ====================================================

CREATE TABLE IF NOT EXISTS next_of_kin (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  full_name VARCHAR,
  relationship VARCHAR,
  phone_number VARCHAR,
  address TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_next_of_kin_employee ON next_of_kin(employee_id);

-- ====================================================
-- DOCUMENTS
-- ====================================================

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  uploaded_by INTEGER REFERENCES users(id),
  file_name VARCHAR,
  file_type VARCHAR,
  file_path VARCHAR,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_employee ON documents(employee_id);

-- ====================================================
-- INCIDENTS
-- ====================================================

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  route_id INTEGER REFERENCES routes(id),
  incident_type VARCHAR,
  description TEXT,
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incidents_employee ON incidents(employee_id);
CREATE INDEX IF NOT EXISTS idx_incidents_vehicle ON incidents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_incidents_route ON incidents(route_id);

-- ====================================================
-- AUDIT LOG
-- ====================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR,
  record_id INTEGER,
  action VARCHAR,
  changed_by INTEGER REFERENCES users(id),
  change_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);

-- ====================================================
-- Enable Row Level Security (RLS)
-- ====================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE passenger_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ====================================================
-- RLS Policies (Allow authenticated users to access data)
-- ====================================================

-- Employees
CREATE POLICY "Allow authenticated users to read employees" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert employees" ON employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update employees" ON employees FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete employees" ON employees FOR DELETE TO authenticated USING (true);

-- Users
CREATE POLICY "Allow authenticated users to read users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert users" ON users FOR INSERT TO authenticated WITH CHECK (true);

-- Schools
CREATE POLICY "Allow authenticated users to read schools" ON schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert schools" ON schools FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update schools" ON schools FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete schools" ON schools FOR DELETE TO authenticated USING (true);

-- Routes
CREATE POLICY "Allow authenticated users to read routes" ON routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert routes" ON routes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update routes" ON routes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete routes" ON routes FOR DELETE TO authenticated USING (true);

-- Passengers
CREATE POLICY "Allow authenticated users to read passengers" ON passengers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert passengers" ON passengers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update passengers" ON passengers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete passengers" ON passengers FOR DELETE TO authenticated USING (true);

-- Vehicles
CREATE POLICY "Allow authenticated users to read vehicles" ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert vehicles" ON vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update vehicles" ON vehicles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete vehicles" ON vehicles FOR DELETE TO authenticated USING (true);

-- Incidents
CREATE POLICY "Allow authenticated users to read incidents" ON incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert incidents" ON incidents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update incidents" ON incidents FOR UPDATE TO authenticated USING (true);

-- Documents
CREATE POLICY "Allow authenticated users to read documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert documents" ON documents FOR INSERT TO authenticated WITH CHECK (true);

-- Audit Log
CREATE POLICY "Allow authenticated users to read audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert audit_log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Passenger Assistants
CREATE POLICY "Allow authenticated users to read passenger_assistants" ON passenger_assistants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert passenger_assistants" ON passenger_assistants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update passenger_assistants" ON passenger_assistants FOR UPDATE TO authenticated USING (true);

-- Drivers
CREATE POLICY "Allow authenticated users to read drivers" ON drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert drivers" ON drivers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update drivers" ON drivers FOR UPDATE TO authenticated USING (true);

