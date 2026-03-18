-- ====================================================================
-- Seed Data: Certificate Tracking Demo
-- ====================================================================
-- This script creates sample data to demonstrate the complete
-- certificate tracking system with various expiry statuses.
-- ====================================================================

-- Clear existing data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE vehicle_locations CASCADE;
-- TRUNCATE TABLE passenger_assistants CASCADE;
-- TRUNCATE TABLE drivers CASCADE;
-- TRUNCATE TABLE employees CASCADE;
-- TRUNCATE TABLE vehicles CASCADE;
-- TRUNCATE TABLE schools CASCADE;

-- ====================================================================
-- SAMPLE EMPLOYEES
-- ====================================================================

INSERT INTO employees (full_name, first_name, last_name, role, employment_status, phone_number, personal_email, start_date, can_work)
VALUES
  ('John Smith', 'John', 'Smith', 'Driver', 'Active', '07700 900001', 'john.smith@email.com', '2020-01-15', TRUE),
  ('Sarah Johnson', 'Sarah', 'Johnson', 'Driver', 'Active', '07700 900002', 'sarah.j@email.com', '2019-06-20', FALSE), -- Will be flagged - expired cert
  ('Michael Brown', 'Michael', 'Brown', 'Driver', 'Active', '07700 900003', 'michael.b@email.com', '2021-03-10', TRUE),
  ('Emma Davis', 'Emma', 'Davis', 'Driver', 'Active', '07700 900004', 'emma.d@email.com', '2020-09-05', TRUE),
  ('James Wilson', 'James', 'Wilson', 'Passenger Assistant', 'Active', '07700 900005', 'james.w@email.com', '2021-01-15', TRUE),
  ('Lisa Taylor', 'Lisa', 'Taylor', 'Passenger Assistant', 'Active', '07700 900006', 'lisa.t@email.com', '2020-05-20', FALSE), -- Will be flagged
  ('David Anderson', 'David', 'Anderson', 'Driver', 'Active', '07700 900007', 'david.a@email.com', '2019-11-30', TRUE),
  ('Sophie Martin', 'Sophie', 'Martin', 'Passenger Assistant', 'Active', '07700 900008', 'sophie.m@email.com', '2021-07-12', TRUE)
ON CONFLICT (personal_email) DO NOTHING;

-- ====================================================================
-- SAMPLE DRIVERS WITH VARIOUS CERTIFICATE STATUSES
-- ====================================================================

-- Driver 1: John Smith - All certificates VALID (30+ days)
INSERT INTO drivers (
  employee_id, 
  tas_badge_number, tas_badge_expiry_date,
  taxi_badge_number, taxi_badge_expiry_date,
  dbs_expiry_date,
  first_aid_certificate_expiry_date,
  passport_expiry_date,
  driving_license_expiry_date,
  cpc_expiry_date,
  utility_bill_date,
  vehicle_insurance_expiry_date,
  mot_expiry_date,
  psv_license,
  birth_certificate, marriage_certificate, photo_taken,
  private_hire_badge, paper_licence, taxi_plate_photo, logbook,
  safeguarding_training_completed, safeguarding_training_date,
  tas_pats_training_completed, tas_pats_training_date,
  psa_training_completed, psa_training_date,
  additional_notes
)
SELECT 
  e.id,
  'TAS-001', CURRENT_DATE + INTERVAL '120 days',
  'TAXI-001', CURRENT_DATE + INTERVAL '150 days',
  CURRENT_DATE + INTERVAL '180 days',
  CURRENT_DATE + INTERVAL '90 days',
  CURRENT_DATE + INTERVAL '365 days',
  CURRENT_DATE + INTERVAL '400 days',
  CURRENT_DATE + INTERVAL '200 days',
  CURRENT_DATE + INTERVAL '60 days',
  CURRENT_DATE + INTERVAL '180 days',
  CURRENT_DATE + INTERVAL '90 days',
  TRUE,
  TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  TRUE, CURRENT_DATE - INTERVAL '30 days',
  TRUE, CURRENT_DATE - INTERVAL '45 days',
  TRUE, CURRENT_DATE - INTERVAL '60 days',
  'Excellent driver. Very reliable and punctual.'
FROM employees e
WHERE e.first_name = 'John' AND e.last_name = 'Smith';

-- Driver 2: Sarah Johnson - EXPIRED DBS (flagged - cannot work)
INSERT INTO drivers (
  employee_id,
  tas_badge_number, tas_badge_expiry_date,
  taxi_badge_number, taxi_badge_expiry_date,
  dbs_expiry_date, -- EXPIRED
  first_aid_certificate_expiry_date,
  passport_expiry_date,
  driving_license_expiry_date,
  cpc_expiry_date,
  utility_bill_date,
  vehicle_insurance_expiry_date,
  mot_expiry_date,
  psv_license,
  birth_certificate, marriage_certificate, photo_taken,
  private_hire_badge, paper_licence, taxi_plate_photo, logbook,
  safeguarding_training_completed, safeguarding_training_date,
  tas_pats_training_completed,
  psa_training_completed, psa_training_date,
  additional_notes
)
SELECT 
  e.id,
  'TAS-002', CURRENT_DATE + INTERVAL '45 days',
  'TAXI-002', CURRENT_DATE + INTERVAL '60 days',
  CURRENT_DATE - INTERVAL '15 days', -- EXPIRED!
  CURRENT_DATE + INTERVAL '120 days',
  CURRENT_DATE + INTERVAL '200 days',
  CURRENT_DATE + INTERVAL '300 days',
  CURRENT_DATE + INTERVAL '180 days',
  CURRENT_DATE + INTERVAL '30 days',
  CURRENT_DATE + INTERVAL '90 days',
  CURRENT_DATE + INTERVAL '100 days',
  FALSE,
  TRUE, FALSE, TRUE,
  TRUE, TRUE, FALSE, TRUE,
  TRUE, CURRENT_DATE - INTERVAL '90 days',
  FALSE, -- Not completed
  TRUE, CURRENT_DATE - INTERVAL '120 days',
  'DBS EXPIRED - Needs urgent renewal before can work again.'
FROM employees e
WHERE e.first_name = 'Sarah' AND e.last_name = 'Johnson';

-- Driver 3: Michael Brown - CRITICAL certificates (14 days)
INSERT INTO drivers (
  employee_id,
  tas_badge_number, tas_badge_expiry_date, -- CRITICAL
  taxi_badge_number, taxi_badge_expiry_date,
  dbs_expiry_date,
  first_aid_certificate_expiry_date, -- CRITICAL
  passport_expiry_date,
  driving_license_expiry_date,
  cpc_expiry_date,
  utility_bill_date,
  vehicle_insurance_expiry_date,
  mot_expiry_date,
  psv_license,
  birth_certificate, marriage_certificate, photo_taken,
  private_hire_badge, paper_licence, taxi_plate_photo, logbook,
  safeguarding_training_completed, safeguarding_training_date,
  tas_pats_training_completed, tas_pats_training_date,
  psa_training_completed, psa_training_date,
  additional_notes
)
SELECT 
  e.id,
  'TAS-003', CURRENT_DATE + INTERVAL '10 days', -- CRITICAL (orange)
  'TAXI-003', CURRENT_DATE + INTERVAL '90 days',
  CURRENT_DATE + INTERVAL '150 days',
  CURRENT_DATE + INTERVAL '12 days', -- CRITICAL (orange)
  CURRENT_DATE + INTERVAL '250 days',
  CURRENT_DATE + INTERVAL '320 days',
  CURRENT_DATE + INTERVAL '180 days',
  CURRENT_DATE + INTERVAL '40 days',
  CURRENT_DATE + INTERVAL '120 days',
  CURRENT_DATE + INTERVAL '95 days',
  TRUE,
  TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  TRUE, CURRENT_DATE - INTERVAL '20 days',
  TRUE, CURRENT_DATE - INTERVAL '40 days',
  TRUE, CURRENT_DATE - INTERVAL '50 days',
  'Multiple certificates expiring soon - schedule renewals urgently.'
FROM employees e
WHERE e.first_name = 'Michael' AND e.last_name = 'Brown';

-- Driver 4: Emma Davis - WARNING certificates (30 days)
INSERT INTO drivers (
  employee_id,
  tas_badge_number, tas_badge_expiry_date,
  taxi_badge_number, taxi_badge_expiry_date, -- WARNING
  dbs_expiry_date,
  first_aid_certificate_expiry_date,
  passport_expiry_date, -- WARNING
  driving_license_expiry_date,
  cpc_expiry_date, -- WARNING
  utility_bill_date,
  vehicle_insurance_expiry_date,
  mot_expiry_date,
  psv_license,
  birth_certificate, marriage_certificate, photo_taken,
  private_hire_badge, paper_licence, taxi_plate_photo, logbook,
  safeguarding_training_completed, safeguarding_training_date,
  tas_pats_training_completed, tas_pats_training_date,
  psa_training_completed,
  additional_notes
)
SELECT 
  e.id,
  'TAS-004', CURRENT_DATE + INTERVAL '120 days',
  'TAXI-004', CURRENT_DATE + INTERVAL '25 days', -- WARNING (yellow)
  CURRENT_DATE + INTERVAL '200 days',
  CURRENT_DATE + INTERVAL '150 days',
  CURRENT_DATE + INTERVAL '28 days', -- WARNING (yellow)
  CURRENT_DATE + INTERVAL '380 days',
  CURRENT_DATE + INTERVAL '22 days', -- WARNING (yellow)
  CURRENT_DATE + INTERVAL '45 days',
  CURRENT_DATE + INTERVAL '160 days',
  CURRENT_DATE + INTERVAL '110 days',
  TRUE,
  TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  TRUE, CURRENT_DATE - INTERVAL '15 days',
  TRUE, CURRENT_DATE - INTERVAL '25 days',
  FALSE, -- Not completed
  'Several certificates expiring within 30 days. Plan renewals.'
FROM employees e
WHERE e.first_name = 'Emma' AND e.last_name = 'Davis';

-- Driver 5: David Anderson - Mixed status + incomplete documents
INSERT INTO drivers (
  employee_id,
  tas_badge_number, tas_badge_expiry_date,
  taxi_badge_number, taxi_badge_expiry_date,
  dbs_expiry_date,
  first_aid_certificate_expiry_date,
  passport_expiry_date,
  driving_license_expiry_date,
  cpc_expiry_date,
  utility_bill_date,
  vehicle_insurance_expiry_date,
  mot_expiry_date,
  psv_license,
  birth_certificate, marriage_certificate, photo_taken,
  private_hire_badge, paper_licence, taxi_plate_photo, logbook,
  safeguarding_training_completed, safeguarding_training_date,
  tas_pats_training_completed,
  psa_training_completed,
  additional_notes
)
SELECT 
  e.id,
  'TAS-007', CURRENT_DATE + INTERVAL '180 days',
  'TAXI-007', CURRENT_DATE + INTERVAL '200 days',
  CURRENT_DATE + INTERVAL '250 days',
  CURRENT_DATE + INTERVAL '100 days',
  CURRENT_DATE + INTERVAL '365 days',
  CURRENT_DATE + INTERVAL '450 days',
  CURRENT_DATE + INTERVAL '190 days',
  CURRENT_DATE + INTERVAL '50 days',
  CURRENT_DATE + INTERVAL '170 days',
  CURRENT_DATE + INTERVAL '120 days',
  TRUE,
  TRUE, FALSE, TRUE, -- Missing marriage certificate
  TRUE, TRUE, FALSE, TRUE, -- Missing taxi plate photo
  TRUE, CURRENT_DATE - INTERVAL '10 days',
  FALSE, -- Not completed
  FALSE, -- Not completed
  'New driver - needs to complete TAS PATS and PSA training. Missing some documents.'
FROM employees e
WHERE e.first_name = 'David' AND e.last_name = 'Anderson';

-- ====================================================================
-- SAMPLE PASSENGER ASSISTANTS
-- ====================================================================

-- PA 1: James Wilson - All valid
INSERT INTO passenger_assistants (
  employee_id,
  tas_badge_number,
  tas_badge_expiry_date,
  dbs_expiry_date
)
SELECT 
  e.id,
  'PA-TAS-001',
  CURRENT_DATE + INTERVAL '150 days',
  CURRENT_DATE + INTERVAL '200 days'
FROM employees e
WHERE e.first_name = 'James' AND e.last_name = 'Wilson';

-- PA 2: Lisa Taylor - EXPIRED TAS Badge (flagged - cannot work)
INSERT INTO passenger_assistants (
  employee_id,
  tas_badge_number,
  tas_badge_expiry_date, -- EXPIRED
  dbs_expiry_date
)
SELECT 
  e.id,
  'PA-TAS-002',
  CURRENT_DATE - INTERVAL '20 days', -- EXPIRED!
  CURRENT_DATE + INTERVAL '120 days'
FROM employees e
WHERE e.first_name = 'Lisa' AND e.last_name = 'Taylor';

-- PA 3: Sophie Martin - Critical (14 days)
INSERT INTO passenger_assistants (
  employee_id,
  tas_badge_number,
  tas_badge_expiry_date,
  dbs_expiry_date -- CRITICAL
)
SELECT 
  e.id,
  'PA-TAS-003',
  CURRENT_DATE + INTERVAL '100 days',
  CURRENT_DATE + INTERVAL '13 days' -- CRITICAL (orange)
FROM employees e
WHERE e.first_name = 'Sophie' AND e.last_name = 'Martin';

-- ====================================================================
-- SAMPLE SCHOOLS
-- ====================================================================

INSERT INTO schools (school_name, address, postcode, contact_number, contact_email)
VALUES
  ('Greenfield Primary School', '123 High Street, London', 'SW1A 1AA', '020 7946 0001', 'admin@greenfield.sch.uk'),
  ('Riverside Academy', '456 Park Road, Manchester', 'M1 1AA', '0161 496 0002', 'office@riverside.ac.uk'),
  ('Oakwood School', '789 Church Lane, Birmingham', 'B1 1AA', '0121 496 0003', 'info@oakwood.sch.uk')
ON CONFLICT DO NOTHING;

-- ====================================================================
-- SAMPLE VEHICLES WITH VARIOUS CERTIFICATE STATUSES
-- ====================================================================

-- Vehicle 1: All valid certificates
INSERT INTO vehicles (
  vehicle_identifier, registration, make, model, vehicle_type, ownership_type,
  plate_expiry_date, insurance_expiry_date, mot_date, tax_date,
  loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry,
  spare_vehicle, off_the_road, tail_lift
)
VALUES
  ('VAN-001', 'AB12 CDE', 'Ford', 'Transit', 'Minibus', 'Owned',
   CURRENT_DATE + INTERVAL '180 days',
   CURRENT_DATE + INTERVAL '200 days',
   CURRENT_DATE + INTERVAL '150 days',
   CURRENT_DATE + INTERVAL '120 days',
   CURRENT_DATE + INTERVAL '90 days',
   CURRENT_DATE + INTERVAL '100 days',
   CURRENT_DATE + INTERVAL '80 days',
   FALSE, FALSE, TRUE);

-- Vehicle 2: EXPIRED MOT (VOR - cannot operate)
INSERT INTO vehicles (
  vehicle_identifier, registration, make, model, vehicle_type, ownership_type,
  plate_expiry_date, insurance_expiry_date, mot_date, tax_date,
  loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry,
  spare_vehicle, off_the_road, tail_lift
)
VALUES
  ('VAN-002', 'CD34 EFG', 'Mercedes', 'Sprinter', 'Minibus', 'Leased',
   CURRENT_DATE + INTERVAL '120 days',
   CURRENT_DATE + INTERVAL '150 days',
   CURRENT_DATE - INTERVAL '10 days', -- EXPIRED MOT!
   CURRENT_DATE + INTERVAL '90 days',
   CURRENT_DATE + INTERVAL '60 days',
   CURRENT_DATE + INTERVAL '70 days',
   CURRENT_DATE + INTERVAL '50 days',
   FALSE, TRUE, TRUE); -- VOR = TRUE

-- Vehicle 3: Critical certificates (14 days)
INSERT INTO vehicles (
  vehicle_identifier, registration, make, model, vehicle_type, ownership_type,
  plate_expiry_date, insurance_expiry_date, mot_date, tax_date,
  loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry,
  spare_vehicle, off_the_road, tail_lift
)
VALUES
  ('VAN-003', 'EF56 GHI', 'Volkswagen', 'Crafter', 'Minibus', 'Owned',
   CURRENT_DATE + INTERVAL '200 days',
   CURRENT_DATE + INTERVAL '12 days', -- CRITICAL
   CURRENT_DATE + INTERVAL '150 days',
   CURRENT_DATE + INTERVAL '13 days', -- CRITICAL
   CURRENT_DATE + INTERVAL '90 days',
   CURRENT_DATE + INTERVAL '100 days',
   CURRENT_DATE + INTERVAL '80 days',
   FALSE, FALSE, TRUE);

-- Vehicle 4: Spare vehicle (available)
INSERT INTO vehicles (
  vehicle_identifier, registration, make, model, vehicle_type, ownership_type,
  plate_expiry_date, insurance_expiry_date, mot_date, tax_date,
  loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry,
  spare_vehicle, off_the_road, tail_lift
)
VALUES
  ('SPARE-001', 'GH78 IJK', 'Ford', 'Transit', 'Minibus', 'Owned',
   CURRENT_DATE + INTERVAL '180 days',
   CURRENT_DATE + INTERVAL '200 days',
   CURRENT_DATE + INTERVAL '150 days',
   CURRENT_DATE + INTERVAL '120 days',
   CURRENT_DATE + INTERVAL '90 days',
   CURRENT_DATE + INTERVAL '100 days',
   CURRENT_DATE + INTERVAL '80 days',
   TRUE, FALSE, TRUE); -- Spare vehicle

-- Vehicle 5: Spare vehicle with location
INSERT INTO vehicles (
  vehicle_identifier, registration, make, model, vehicle_type, ownership_type,
  plate_expiry_date, insurance_expiry_date, mot_date, tax_date,
  loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry,
  spare_vehicle, off_the_road, tail_lift
)
VALUES
  ('SPARE-002', 'IJ90 KLM', 'Mercedes', 'Sprinter', 'Minibus', 'Owned',
   CURRENT_DATE + INTERVAL '160 days',
   CURRENT_DATE + INTERVAL '180 days',
   CURRENT_DATE + INTERVAL '140 days',
   CURRENT_DATE + INTERVAL '110 days',
   CURRENT_DATE + INTERVAL '80 days',
   CURRENT_DATE + INTERVAL '90 days',
   CURRENT_DATE + INTERVAL '70 days',
   TRUE, FALSE, TRUE); -- Spare vehicle

-- ====================================================================
-- SAMPLE VEHICLE LOCATIONS (for spare vehicles)
-- ====================================================================

INSERT INTO vehicle_locations (vehicle_id, location_name, address, latitude, longitude, last_updated)
SELECT 
  v.id,
  'Main Depot - Bay 3',
  '123 Industrial Estate, London, SW1A 1BB',
  51.5074,
  -0.1278,
  CURRENT_TIMESTAMP - INTERVAL '2 days'
FROM vehicles v
WHERE v.vehicle_identifier = 'SPARE-002';

-- ====================================================================
-- RUN EXPIRY FLAGS UPDATE
-- ====================================================================
-- This will set can_work = FALSE for employees with expired certs
-- and off_the_road = TRUE for vehicles with expired certs

SELECT update_expiry_flags();

-- ====================================================================
-- SEED DATA COMPLETE!
-- ====================================================================

-- Summary of what was created:
DO $$
DECLARE
  emp_count INTEGER;
  driver_count INTEGER;
  pa_count INTEGER;
  vehicle_count INTEGER;
  flagged_emp INTEGER;
  vor_vehicles INTEGER;
BEGIN
  SELECT COUNT(*) INTO emp_count FROM employees;
  SELECT COUNT(*) INTO driver_count FROM drivers;
  SELECT COUNT(*) INTO pa_count FROM passenger_assistants;
  SELECT COUNT(*) INTO vehicle_count FROM vehicles;
  SELECT COUNT(*) INTO flagged_emp FROM employees WHERE can_work = FALSE;
  SELECT COUNT(*) INTO vor_vehicles FROM vehicles WHERE off_the_road = TRUE;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Seed Data Summary:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Employees: %', emp_count;
  RAISE NOTICE 'Drivers: %', driver_count;
  RAISE NOTICE 'Passenger Assistants: %', pa_count;
  RAISE NOTICE 'Vehicles: %', vehicle_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Flagged Employees (Cannot Work): %', flagged_emp;
  RAISE NOTICE 'VOR Vehicles: %', vor_vehicles;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Certificate Status Examples:';
  RAISE NOTICE '- Sarah Johnson: EXPIRED DBS (Cannot Work)';
  RAISE NOTICE '- Lisa Taylor: EXPIRED TAS Badge (Cannot Work)';
  RAISE NOTICE '- Michael Brown: CRITICAL certificates (14 days)';
  RAISE NOTICE '- Emma Davis: WARNING certificates (30 days)';
  RAISE NOTICE '- John Smith: All certificates VALID';
  RAISE NOTICE '';
  RAISE NOTICE '- VAN-002: EXPIRED MOT (VOR)';
  RAISE NOTICE '- VAN-003: CRITICAL certificates (14 days)';
  RAISE NOTICE '';
  RAISE NOTICE 'Navigate to /dashboard to see the demo!';
  RAISE NOTICE '========================================';
END $$;

