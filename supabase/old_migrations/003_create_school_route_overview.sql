-- ====================================================
-- School Route Overview View
-- ====================================================
-- This view provides a comprehensive overview of schools, routes, crew,
-- vehicles, and passengers in a single queryable structure.
--
-- Usage: SELECT * FROM school_route_overview WHERE school_id = <id>;

CREATE OR REPLACE VIEW school_route_overview AS
SELECT
  -- ============================================
  -- SCHOOL INFORMATION
  -- ============================================
  s.id AS school_id,
  s.name AS school_name,
  s.address AS school_address,
  s.created_at AS school_created_at,
  
  -- ============================================
  -- ROUTE INFORMATION
  -- ============================================
  r.id AS route_id,
  r.route_number,
  r.created_at AS route_created_at,
  
  -- ============================================
  -- CREW ASSIGNMENT
  -- ============================================
  c.id AS crew_id,
  c.created_at AS crew_assigned_at,
  
  -- ============================================
  -- DRIVER INFORMATION
  -- ============================================
  c.driver_id,
  driver_emp.full_name AS driver_name,
  driver_emp.phone_number AS driver_phone,
  driver_emp.personal_email AS driver_email,
  driver_emp.employment_status AS driver_status,
  driver_emp.wheelchair_access AS driver_wheelchair_trained,
  d.tas_badge_number AS driver_tas_badge,
  d.tas_badge_expiry_date AS driver_tas_expiry,
  d.taxi_badge_number AS driver_taxi_badge,
  d.taxi_badge_expiry_date AS driver_taxi_expiry,
  d.dbs_expiry_date AS driver_dbs_expiry,
  d.psv_license AS driver_psv_license,
  
  -- ============================================
  -- PASSENGER ASSISTANT INFORMATION
  -- ============================================
  c.pa_id,
  pa_emp.full_name AS pa_name,
  pa_emp.phone_number AS pa_phone,
  pa_emp.personal_email AS pa_email,
  pa_emp.employment_status AS pa_status,
  pa_emp.wheelchair_access AS pa_wheelchair_trained,
  pa.tas_badge_number AS pa_tas_badge,
  pa.tas_badge_expiry_date AS pa_tas_expiry,
  pa.dbs_expiry_date AS pa_dbs_expiry,
  
  -- ============================================
  -- VEHICLE INFORMATION (Assigned to Driver)
  -- ============================================
  v.id AS vehicle_id,
  v.vehicle_identifier,
  v.registration AS vehicle_registration,
  v.make AS vehicle_make,
  v.model AS vehicle_model,
  v.vehicle_type,
  v.ownership_type,
  v.tail_lift AS vehicle_tail_lift,
  v.off_the_road AS vehicle_off_road,
  v.mot_date AS vehicle_mot_date,
  v.tax_date AS vehicle_tax_date,
  v.insurance_expiry_date AS vehicle_insurance_expiry,
  va.assigned_from AS vehicle_assigned_from,
  
  -- ============================================
  -- VEHICLE CONFIGURATION
  -- ============================================
  vc.id AS vehicle_config_id,
  vc.configuration_name,
  vc.seats_total,
  vc.wheelchair_capacity,
  
  -- ============================================
  -- PASSENGERS (Aggregated as JSON)
  -- ============================================
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'dob', p.dob,
          'address', p.address,
          'sen_requirements', p.sen_requirements,
          'mobility_type', p.mobility_type,
          'seat_number', p.seat_number,
          'updated_at', p.updated_at
        )
        ORDER BY p.seat_number NULLS LAST, p.full_name
      )
      FROM passengers p
      WHERE p.route_id = r.id
    ),
    '[]'::jsonb
  ) AS passengers,
  
  -- ============================================
  -- PASSENGER STATISTICS
  -- ============================================
  (
    SELECT COUNT(*) 
    FROM passengers p 
    WHERE p.route_id = r.id
  ) AS total_passengers,
  
  (
    SELECT COUNT(*) 
    FROM passengers p 
    WHERE p.route_id = r.id 
    AND p.mobility_type = 'Wheelchair'
  ) AS wheelchair_passengers,
  
  (
    SELECT COUNT(*) 
    FROM passengers p 
    WHERE p.route_id = r.id 
    AND p.sen_requirements IS NOT NULL 
    AND p.sen_requirements != ''
  ) AS sen_passengers

-- ============================================
-- JOINS
-- ============================================
FROM schools s
LEFT JOIN routes r ON r.school_id = s.id
LEFT JOIN crew c ON c.route_id = r.id
LEFT JOIN drivers d ON d.employee_id = c.driver_id
LEFT JOIN employees driver_emp ON driver_emp.id = c.driver_id
LEFT JOIN passenger_assistants pa ON pa.employee_id = c.pa_id
LEFT JOIN employees pa_emp ON pa_emp.id = c.pa_id
LEFT JOIN vehicle_assignments va ON va.employee_id = c.driver_id AND va.active = true
LEFT JOIN vehicles v ON v.id = va.vehicle_id
LEFT JOIN vehicle_configurations vc ON vc.vehicle_id = v.id

-- Order by school and route for consistent results
ORDER BY s.name, r.route_number;

-- ====================================================
-- COMMENTS FOR DOCUMENTATION
-- ====================================================

COMMENT ON VIEW school_route_overview IS 
'Comprehensive view of schools, routes, crew, vehicles, and passengers. 
Query by school_id to get all routes and related information for a specific school.
Example: SELECT * FROM school_route_overview WHERE school_id = 1;';

-- ====================================================
-- GRANT PERMISSIONS
-- ====================================================
-- Allow authenticated users to read from this view
GRANT SELECT ON school_route_overview TO authenticated;
GRANT SELECT ON school_route_overview TO anon;

-- ====================================================
-- USAGE EXAMPLES
-- ====================================================

/*

-- Get all routes for a specific school
SELECT * FROM school_route_overview WHERE school_id = 1;

-- Get a specific route's complete information
SELECT * FROM school_route_overview WHERE route_id = 5;

-- Find routes with wheelchair passengers
SELECT 
  school_name, 
  route_number, 
  wheelchair_passengers,
  seats_total,
  wheelchair_capacity
FROM school_route_overview 
WHERE wheelchair_passengers > 0;

-- Check driver certifications expiring soon
SELECT 
  school_name,
  route_number,
  driver_name,
  driver_dbs_expiry,
  driver_tas_expiry
FROM school_route_overview
WHERE driver_dbs_expiry < CURRENT_DATE + INTERVAL '30 days'
   OR driver_tas_expiry < CURRENT_DATE + INTERVAL '30 days';

-- Find routes without crew assigned
SELECT 
  school_name, 
  route_number 
FROM school_route_overview 
WHERE crew_id IS NULL;

-- Get passenger details for a route
SELECT 
  route_number,
  total_passengers,
  passengers
FROM school_route_overview 
WHERE route_id = 3;

-- Check vehicle capacity vs passenger count
SELECT 
  school_name,
  route_number,
  total_passengers,
  wheelchair_passengers,
  seats_total,
  wheelchair_capacity,
  CASE 
    WHEN total_passengers > seats_total THEN 'OVERCAPACITY'
    WHEN wheelchair_passengers > wheelchair_capacity THEN 'WHEELCHAIR OVERCAPACITY'
    ELSE 'OK'
  END AS capacity_status
FROM school_route_overview
WHERE vehicle_id IS NOT NULL;

*/

