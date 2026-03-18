-- ====================================================
-- Fleet Management System - Seed Data
-- ====================================================
-- This file contains dummy data for testing and development

-- ====================================================
-- EMPLOYEES
-- ====================================================

INSERT INTO employees (id, full_name, role, employment_status, phone_number, personal_email, start_date, wheelchair_access) VALUES
(1, 'John Smith', 'Driver', 'Active', '555-0101', 'john.smith@email.com', '2020-01-15', false),
(2, 'Sarah Johnson', 'PA', 'Active', '555-0102', 'sarah.j@email.com', '2019-06-20', false),
(3, 'Michael Brown', 'Driver', 'Active', '555-0103', 'mbrown@email.com', '2021-03-10', false),
(4, 'Emily Davis', 'PA', 'Active', '555-0104', 'emily.davis@email.com', '2020-09-01', true),
(5, 'David Wilson', 'Driver', 'Active', '555-0105', 'dwilson@email.com', '2018-11-15', false),
(6, 'Lisa Martinez', 'PA', 'Active', '555-0106', 'lmartinez@email.com', '2021-01-20', false),
(7, 'James Anderson', 'Driver', 'On Leave', '555-0107', 'janderson@email.com', '2019-04-12', false),
(8, 'Jennifer Taylor', 'PA', 'Active', '555-0108', 'jtaylor@email.com', '2020-07-18', false),
(9, 'Robert Thomas', 'Admin', 'Active', '555-0109', 'rthomas@email.com', '2017-02-01', false),
(10, 'Maria Garcia', 'Driver', 'Active', '555-0110', 'mgarcia@email.com', '2021-05-30', false),
(11, 'William Lee', 'PA', 'Active', '555-0111', 'wlee@email.com', '2020-10-15', false),
(12, 'Patricia White', 'Driver', 'Active', '555-0112', 'pwhite@email.com', '2019-08-22', false),
(13, 'Christopher Harris', 'PA', 'Inactive', '555-0113', 'charris@email.com', '2018-03-05', false),
(14, 'Linda Clark', 'Driver', 'Active', '555-0114', 'lclark@email.com', '2021-09-12', false),
(15, 'Daniel Lewis', 'Other', 'Active', '555-0115', 'dlewis@email.com', '2020-12-01', false);

-- Reset sequence
SELECT setval('employees_id_seq', 15, true);

-- ====================================================
-- DRIVERS
-- ====================================================

INSERT INTO drivers (employee_id, tas_badge_number, tas_badge_expiry_date, taxi_badge_number, taxi_badge_expiry_date, dbs_expiry_date, psv_license) VALUES
(1, 'TAS-001', '2025-06-30', 'TAXI-101', '2025-08-15', '2025-12-31', true),
(3, 'TAS-002', '2025-09-30', 'TAXI-102', '2025-10-20', '2026-03-15', true),
(5, 'TAS-003', '2024-12-31', 'TAXI-103', '2025-05-10', '2025-11-20', true),
(7, 'TAS-004', '2025-07-15', 'TAXI-104', '2025-09-05', '2026-01-10', false),
(10, 'TAS-005', '2026-01-30', 'TAXI-105', '2026-02-28', '2026-06-30', true),
(12, 'TAS-006', '2025-11-15', 'TAXI-106', '2025-12-10', '2026-04-15', true),
(14, 'TAS-007', '2026-03-20', 'TAXI-107', '2026-04-25', '2026-08-30', true);

-- ====================================================
-- PASSENGER ASSISTANTS
-- ====================================================

INSERT INTO passenger_assistants (employee_id, tas_badge_number, tas_badge_expiry_date, dbs_expiry_date) VALUES
(2, 'TAS-PA-001', '2025-08-30', '2025-12-31'),
(4, 'TAS-PA-002', '2025-10-15', '2026-02-28'),
(6, 'TAS-PA-003', '2025-07-20', '2025-11-30'),
(8, 'TAS-PA-004', '2026-01-10', '2026-05-15'),
(11, 'TAS-PA-005', '2025-09-25', '2026-03-20'),
(13, 'TAS-PA-006', '2024-11-30', '2025-10-15');

-- ====================================================
-- SCHOOLS
-- ====================================================

INSERT INTO schools (id, name, address) VALUES
(1, 'Greenfield Primary School', '123 Oak Street, Greenfield, GF1 2AB'),
(2, 'Riverside Secondary School', '456 River Road, Riverside, RS2 3CD'),
(3, 'Meadowbrook Special School', '789 Meadow Lane, Meadowbrook, MB3 4EF'),
(4, 'Oakwood Academy', '321 Pine Avenue, Oakwood, OW4 5GH'),
(5, 'Sunnydale High School', '654 Sunshine Boulevard, Sunnydale, SD5 6IJ');

-- Reset sequence
SELECT setval('schools_id_seq', 5, true);

-- ====================================================
-- ROUTES
-- ====================================================

INSERT INTO routes (id, route_number, school_id) VALUES
(1, 'R-101', 1),
(2, 'R-102', 1),
(3, 'R-201', 2),
(4, 'R-202', 2),
(5, 'R-301', 3),
(6, 'R-302', 3),
(7, 'R-401', 4),
(8, 'R-501', 5);

-- Reset sequence
SELECT setval('routes_id_seq', 8, true);

-- ====================================================
-- VEHICLES
-- ====================================================

INSERT INTO vehicles (id, vehicle_identifier, registration, make, model, vehicle_type, ownership_type, mot_date, tax_date, insurance_expiry_date, tail_lift, spare_vehicle, off_the_road, notes) VALUES
(1, 'VAN-001', 'AB12 CDE', 'Ford', 'Transit Custom', 'Minibus', 'Owned', '2025-06-15', '2025-07-01', '2025-12-31', true, false, false, 'Main school run vehicle'),
(2, 'VAN-002', 'FG34 HIJ', 'Mercedes', 'Sprinter', 'Minibus', 'Leased', '2025-08-20', '2025-09-01', '2025-11-30', true, false, false, 'Wheelchair accessible'),
(3, 'VAN-003', 'KL56 MNO', 'Volkswagen', 'Crafter', 'Van', 'Owned', '2025-05-10', '2025-06-01', '2026-01-15', false, false, false, 'Standard transport'),
(4, 'VAN-004', 'PQ78 RST', 'Peugeot', 'Boxer', 'Minibus', 'Owned', '2025-09-25', '2025-10-01', '2026-02-28', true, false, false, 'High capacity vehicle'),
(5, 'VAN-005', 'UV90 WXY', 'Ford', 'Transit', 'Van', 'Rented', '2025-07-30', '2025-08-01', '2025-12-15', false, true, false, 'Spare vehicle'),
(6, 'VAN-006', 'ZA12 BCD', 'Renault', 'Master', 'Minibus', 'Owned', '2024-11-15', '2024-12-01', '2025-10-31', true, false, true, 'Currently off road for repairs'),
(7, 'VAN-007', 'EF34 GHI', 'Mercedes', 'Vito', 'Van', 'Owned', '2025-10-20', '2025-11-01', '2026-03-30', false, false, false, 'Compact vehicle for small routes'),
(8, 'VAN-008', 'JK56 LMN', 'Ford', 'Transit Custom', 'Minibus', 'Leased', '2026-01-10', '2026-02-01', '2026-05-15', true, false, false, 'New vehicle');

-- Reset sequence
SELECT setval('vehicles_id_seq', 8, true);

-- ====================================================
-- PASSENGERS
-- ====================================================

INSERT INTO passengers (id, full_name, dob, address, sen_requirements, school_id, mobility_type, route_id, seat_number) VALUES
(1, 'Oliver Thompson', '2010-03-15', '12 Elm Street, Greenfield', 'Autism Spectrum Disorder - requires consistent routine', 1, 'Ambulant', 1, 'A1'),
(2, 'Emma Wilson', '2009-07-22', '34 Maple Avenue, Greenfield', 'Wheelchair user', 1, 'Wheelchair', 1, 'W1'),
(3, 'Noah Martinez', '2011-01-10', '56 Oak Road, Greenfield', NULL, 1, 'Ambulant', 2, 'A2'),
(4, 'Sophia Anderson', '2008-11-05', '78 Pine Street, Riverside', 'ADHD - needs supervision', 2, 'Ambulant', 3, 'A3'),
(5, 'Liam Johnson', '2009-09-18', '90 Cedar Lane, Riverside', 'Uses walking frame', 2, 'Walker', 3, 'A4'),
(6, 'Isabella Garcia', '2010-05-30', '23 Birch Way, Riverside', NULL, 2, 'Ambulant', 4, 'A5'),
(7, 'Mason Rodriguez', '2008-12-12', '45 Willow Court, Meadowbrook', 'Cerebral Palsy - wheelchair user', 3, 'Wheelchair', 5, 'W2'),
(8, 'Ava Martinez', '2009-04-25', '67 Spruce Drive, Meadowbrook', 'Severe learning difficulties', 3, 'Ambulant', 5, 'A6'),
(9, 'Ethan Taylor', '2011-08-08', '89 Ash Close, Meadowbrook', 'Epilepsy - emergency medication on board', 3, 'Ambulant', 6, 'A7'),
(10, 'Charlotte Brown', '2010-02-14', '21 Poplar Street, Oakwood', NULL, 4, 'Ambulant', 7, 'A8'),
(11, 'James Davis', '2009-06-20', '43 Chestnut Road, Oakwood', 'Visual impairment', 4, 'Ambulant', 7, 'A9'),
(12, 'Amelia Wilson', '2008-10-03', '65 Beech Avenue, Sunnydale', 'Hearing impairment', 5, 'Ambulant', 8, 'A10'),
(13, 'Benjamin Lee', '2011-03-28', '87 Sycamore Lane, Sunnydale', NULL, 5, 'Ambulant', 8, 'A11'),
(14, 'Mia White', '2010-07-16', '19 Hickory Way, Greenfield', 'Anxiety disorder - needs reassurance', 1, 'Ambulant', 2, 'A12'),
(15, 'Lucas Harris', '2009-12-09', '31 Magnolia Drive, Riverside', 'Wheelchair user', 2, 'Wheelchair', 4, 'W3');

-- Reset sequence
SELECT setval('passengers_id_seq', 15, true);

-- ====================================================
-- PARENT CONTACTS
-- ====================================================

INSERT INTO parent_contacts (id, full_name, relationship, phone_number, email, address) VALUES
(1, 'Margaret Thompson', 'Mother', '555-1001', 'mthompson@email.com', '12 Elm Street, Greenfield'),
(2, 'Richard Thompson', 'Father', '555-1002', 'rthompson@email.com', '12 Elm Street, Greenfield'),
(3, 'Susan Wilson', 'Mother', '555-1003', 'swilson@email.com', '34 Maple Avenue, Greenfield'),
(4, 'Carlos Martinez', 'Father', '555-1004', 'cmartinez@email.com', '56 Oak Road, Greenfield'),
(5, 'Jennifer Anderson', 'Mother', '555-1005', 'janderson@email.com', '78 Pine Street, Riverside'),
(6, 'Patricia Johnson', 'Guardian', '555-1006', 'pjohnson@email.com', '90 Cedar Lane, Riverside'),
(7, 'Maria Garcia', 'Mother', '555-1007', 'mgarcia@email.com', '23 Birch Way, Riverside'),
(8, 'Roberto Rodriguez', 'Father', '555-1008', 'rrodriguez@email.com', '45 Willow Court, Meadowbrook'),
(9, 'Lisa Martinez', 'Mother', '555-1009', 'lmartinez@email.com', '67 Spruce Drive, Meadowbrook'),
(10, 'Mark Taylor', 'Father', '555-1010', 'mtaylor@email.com', '89 Ash Close, Meadowbrook');

-- Reset sequence
SELECT setval('parent_contacts_id_seq', 10, true);

-- ====================================================
-- PASSENGER-PARENT CONTACTS LINKING
-- ====================================================

INSERT INTO passenger_parent_contacts (passenger_id, parent_contact_id) VALUES
(1, 1), (1, 2),  -- Oliver has both parents
(2, 3),          -- Emma has mother
(3, 4),          -- Noah has father
(4, 5),          -- Sophia has mother
(5, 6),          -- Liam has guardian
(6, 7),          -- Isabella has mother
(7, 8),          -- Mason has father
(8, 9),          -- Ava has mother
(9, 10);         -- Ethan has father

-- ====================================================
-- CREW ASSIGNMENTS
-- ====================================================

INSERT INTO crew (pa_id, driver_id, route_id, school_id) VALUES
(2, 1, 1, 1),   -- Route R-101: Driver John Smith, PA Sarah Johnson
(4, 3, 2, 1),   -- Route R-102: Driver Michael Brown, PA Emily Davis
(6, 5, 3, 2),   -- Route R-201: Driver David Wilson, PA Lisa Martinez
(8, 10, 4, 2),  -- Route R-202: Driver Maria Garcia, PA Jennifer Taylor
(2, 12, 5, 3),  -- Route R-301: Driver Patricia White, PA Sarah Johnson
(4, 14, 6, 3),  -- Route R-302: Driver Linda Clark, PA Emily Davis
(6, 1, 7, 4),   -- Route R-401: Driver John Smith, PA Lisa Martinez
(8, 3, 8, 5);   -- Route R-501: Driver Michael Brown, PA Jennifer Taylor

-- ====================================================
-- ROUTE POINTS
-- ====================================================

INSERT INTO route_points (route_id, point_name, address, latitude, longitude, stop_order) VALUES
-- Route R-101
(1, 'School Gate', '123 Oak Street, Greenfield', 51.5074, -0.1278, 1),
(1, 'Elm Street Stop', '12 Elm Street, Greenfield', 51.5084, -0.1288, 2),
(1, 'Maple Avenue Corner', '34 Maple Avenue, Greenfield', 51.5094, -0.1298, 3),

-- Route R-102
(2, 'School Gate', '123 Oak Street, Greenfield', 51.5074, -0.1278, 1),
(2, 'Oak Road Junction', '56 Oak Road, Greenfield', 51.5104, -0.1308, 2),
(2, 'Hickory Way Stop', '19 Hickory Way, Greenfield', 51.5114, -0.1318, 3),

-- Route R-201
(3, 'School Main Entrance', '456 River Road, Riverside', 51.5200, -0.1400, 1),
(3, 'Pine Street Pickup', '78 Pine Street, Riverside', 51.5210, -0.1410, 2),
(3, 'Cedar Lane Stop', '90 Cedar Lane, Riverside', 51.5220, -0.1420, 3),

-- Route R-301
(5, 'Meadowbrook Entrance', '789 Meadow Lane, Meadowbrook', 51.5300, -0.1500, 1),
(5, 'Willow Court Stop', '45 Willow Court, Meadowbrook', 51.5310, -0.1510, 2),
(5, 'Spruce Drive Pickup', '67 Spruce Drive, Meadowbrook', 51.5320, -0.1520, 3);

-- ====================================================
-- VEHICLE CONFIGURATIONS
-- ====================================================

INSERT INTO vehicle_configurations (vehicle_id, configuration_name, seats_total, wheelchair_capacity) VALUES
(1, 'Standard Minibus', 16, 2),
(2, 'Wheelchair Accessible', 12, 4),
(3, 'Standard Van', 8, 0),
(4, 'High Capacity Minibus', 20, 2),
(5, 'Small Van', 6, 0),
(6, 'Wheelchair Accessible', 14, 3),
(7, 'Compact Van', 8, 0),
(8, 'Standard Minibus', 16, 2);

-- ====================================================
-- VEHICLE ASSIGNMENTS
-- ====================================================

INSERT INTO vehicle_assignments (vehicle_id, employee_id, assigned_from, assigned_to, active) VALUES
(1, 1, '2024-01-01', NULL, true),    -- VAN-001 assigned to John Smith
(2, 3, '2024-02-01', NULL, true),    -- VAN-002 assigned to Michael Brown
(3, 5, '2024-01-15', NULL, true),    -- VAN-003 assigned to David Wilson
(4, 10, '2024-03-01', NULL, true),   -- VAN-004 assigned to Maria Garcia
(7, 12, '2024-04-01', NULL, true),   -- VAN-007 assigned to Patricia White
(8, 14, '2024-05-01', NULL, true),   -- VAN-008 assigned to Linda Clark
(1, 7, '2023-06-01', '2024-01-01', false);  -- Historical assignment

-- ====================================================
-- NEXT OF KIN
-- ====================================================

INSERT INTO next_of_kin (employee_id, full_name, relationship, phone_number, address) VALUES
(1, 'Jane Smith', 'Spouse', '555-2001', '100 Driver Street, City'),
(2, 'Tom Johnson', 'Spouse', '555-2002', '200 PA Avenue, Town'),
(3, 'Laura Brown', 'Partner', '555-2003', '300 Employee Road, Village'),
(5, 'Anna Wilson', 'Spouse', '555-2005', '500 Fleet Lane, City'),
(10, 'Juan Garcia', 'Spouse', '555-2010', '1000 Transport Road, Town');

-- ====================================================
-- INCIDENTS
-- ====================================================

INSERT INTO incidents (employee_id, vehicle_id, route_id, incident_type, description, reported_at, resolved) VALUES
(1, 1, 1, 'Breakdown', 'Vehicle experienced engine warning light on route. Returned to depot safely. Mechanics investigating.', '2024-11-10 08:30:00', true),
(3, 2, 3, 'Safety Issue', 'Seatbelt malfunction reported on seat A4. Passenger moved to different seat. Vehicle sent for repair.', '2024-11-12 07:45:00', true),
(10, 4, 4, 'Accident', 'Minor collision in school car park. No injuries. Damage to rear bumper. Police report filed.', '2024-11-13 15:20:00', false),
(5, 3, NULL, 'Complaint', 'Parent complaint about pickup time being 10 minutes late. Traffic delay on main road.', '2024-11-14 16:00:00', true),
(12, 7, 7, 'Safety Issue', 'First aid kit found to be expired. Replaced immediately. Training reminder sent to all drivers.', '2024-11-08 09:00:00', true),
(14, 8, 8, 'Other', 'Wheelchair clamp required adjustment. Passenger experienced minor discomfort. Fixed on-site.', '2024-11-01 14:30:00', true);

-- ====================================================
-- DOCUMENTS (Metadata only)
-- ====================================================

-- Note: We'll create document records without actual uploaded_by references for now
INSERT INTO documents (employee_id, file_name, file_type, file_path, uploaded_at) VALUES
(1, 'driving_license_john_smith.pdf', 'application/pdf', '/documents/licenses/driving_license_john_smith.pdf', '2024-01-15 10:00:00'),
(1, 'dbs_certificate_john_smith.pdf', 'application/pdf', '/documents/dbs/dbs_certificate_john_smith.pdf', '2024-01-15 10:05:00'),
(2, 'tas_badge_sarah_johnson.pdf', 'application/pdf', '/documents/badges/tas_badge_sarah_johnson.pdf', '2024-02-01 11:00:00'),
(3, 'driving_license_michael_brown.pdf', 'application/pdf', '/documents/licenses/driving_license_michael_brown.pdf', '2024-03-10 09:30:00'),
(5, 'psv_license_david_wilson.pdf', 'application/pdf', '/documents/licenses/psv_license_david_wilson.pdf', '2024-04-12 14:00:00'),
(10, 'taxi_badge_maria_garcia.pdf', 'application/pdf', '/documents/badges/taxi_badge_maria_garcia.pdf', '2024-05-30 10:30:00');

-- ====================================================
-- Summary Information
-- ====================================================

-- Print summary of inserted data
DO $$
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'SEED DATA SUCCESSFULLY INSERTED';
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Employees: 15 (7 Drivers, 6 PAs, 1 Admin, 1 Other)';
  RAISE NOTICE 'Schools: 5';
  RAISE NOTICE 'Routes: 8';
  RAISE NOTICE 'Vehicles: 8';
  RAISE NOTICE 'Passengers: 15';
  RAISE NOTICE 'Parent Contacts: 10';
  RAISE NOTICE 'Crew Assignments: 8';
  RAISE NOTICE 'Route Points: 12';
  RAISE NOTICE 'Vehicle Configurations: 8';
  RAISE NOTICE 'Vehicle Assignments: 7';
  RAISE NOTICE 'Next of Kin: 5';
  RAISE NOTICE 'Incidents: 6';
  RAISE NOTICE 'Documents: 6';
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'You can now sign up and explore the dashboard!';
  RAISE NOTICE '====================================================';
END $$;

