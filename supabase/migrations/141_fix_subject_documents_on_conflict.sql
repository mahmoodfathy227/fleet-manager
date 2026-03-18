-- ====================================================
-- Fix ON CONFLICT for partial unique indexes on subject_documents
-- ====================================================
-- PostgreSQL requires the partial index WHERE clause to be specified
-- in ON CONFLICT when using partial unique indexes.
-- ====================================================

CREATE OR REPLACE FUNCTION ensure_subject_documents_for_driver(p_employee_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subject_documents (requirement_id, subject_type, driver_employee_id, status)
  SELECT r.id, 'driver', p_employee_id, 'missing'
  FROM document_requirements r
  WHERE r.subject_type = 'driver'
    AND r.is_active = TRUE
  ON CONFLICT (requirement_id, driver_employee_id) WHERE (driver_employee_id IS NOT NULL) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_subject_documents_for_pa(p_employee_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subject_documents (requirement_id, subject_type, pa_employee_id, status)
  SELECT r.id, 'pa', p_employee_id, 'missing'
  FROM document_requirements r
  WHERE r.subject_type = 'pa'
    AND r.is_active = TRUE
  ON CONFLICT (requirement_id, pa_employee_id) WHERE (pa_employee_id IS NOT NULL) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_subject_documents_for_vehicle(p_vehicle_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subject_documents (requirement_id, subject_type, vehicle_id, status)
  SELECT r.id, 'vehicle', p_vehicle_id, 'missing'
  FROM document_requirements r
  WHERE r.subject_type = 'vehicle'
    AND r.is_active = TRUE
  ON CONFLICT (requirement_id, vehicle_id) WHERE (vehicle_id IS NOT NULL) DO NOTHING;
END;
$$;
