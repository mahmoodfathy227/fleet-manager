-- Update school_route_overview view to use new route structure
-- Routes now have driver_id, passenger_assistant_id, and vehicle_id directly
-- No longer uses crew table

-- Drop the existing view first (required when changing column structure)
-- Use CASCADE to drop any dependent objects
DO $$ 
BEGIN
  DROP VIEW IF EXISTS school_route_overview CASCADE;
EXCEPTION 
  WHEN OTHERS THEN
    -- View might not exist, continue
    NULL;
END $$;

-- Recreate the view with the new structure
CREATE VIEW school_route_overview AS
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
  -- DRIVER INFORMATION (from routes.driver_id)
  -- ============================================
  r.driver_id,
  driver_emp.full_name AS driver_name,
  driver_emp.phone_number AS driver_phone,
  driver_emp.personal_email AS driver_email,
  driver_emp.employment_status AS driver_status,
  driver_emp.wheelchair_access AS driver_wheelchair_trained,
  d.tas_badge_number AS driver_tas_badge,
  d.tas_badge_expiry_date AS driver_tas_expiry,
  d.dbs_number AS driver_dbs_number,
  
  -- ============================================
  -- PASSENGER ASSISTANT INFORMATION (from routes.passenger_assistant_id)
  -- ============================================
  r.passenger_assistant_id AS pa_id,
  pa_emp.full_name AS pa_name,
  pa_emp.phone_number AS pa_phone,
  pa_emp.personal_email AS pa_email,
  pa_emp.employment_status AS pa_status,
  pa_emp.wheelchair_access AS pa_wheelchair_trained,
  pa.tas_badge_number AS pa_tas_badge,
  pa.tas_badge_expiry_date AS pa_tas_expiry,
  pa.dbs_number AS pa_dbs_number,
  
  -- ============================================
  -- VEHICLE INFORMATION (from routes.vehicle_id - direct assignment)
  -- ============================================
  r.vehicle_id,
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
LEFT JOIN drivers d ON d.employee_id = r.driver_id
LEFT JOIN employees driver_emp ON driver_emp.id = r.driver_id
LEFT JOIN passenger_assistants pa ON pa.employee_id = r.passenger_assistant_id
LEFT JOIN employees pa_emp ON pa_emp.id = r.passenger_assistant_id
LEFT JOIN vehicles v ON v.id = r.vehicle_id
LEFT JOIN vehicle_configurations vc ON vc.vehicle_id = v.id

-- Order by school and route for consistent results
ORDER BY s.name, r.route_number;

-- Update comment
COMMENT ON VIEW school_route_overview IS 
'Comprehensive view of schools, routes, crew, vehicles, and passengers. 
Uses new route structure with direct driver_id, passenger_assistant_id, and vehicle_id.
Query by school_id to get all routes and related information for a specific school.
Example: SELECT * FROM school_route_overview WHERE school_id = 1;';

-- Re-grant permissions after recreating the view
GRANT SELECT ON school_route_overview TO authenticated;
GRANT SELECT ON school_route_overview TO anon;

