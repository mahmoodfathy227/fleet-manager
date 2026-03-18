-- ====================================================
-- Subject documents triggers and recompute functions
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
  ON CONFLICT (requirement_id, driver_employee_id) DO NOTHING;
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
  ON CONFLICT (requirement_id, pa_employee_id) DO NOTHING;
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
  ON CONFLICT (requirement_id, vehicle_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION recompute_employee_can_work(p_employee_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_role BOOLEAN;
  invalid_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM drivers d WHERE d.employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM passenger_assistants pa WHERE pa.employee_id = p_employee_id
  ) INTO has_role;

  IF NOT has_role THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM subject_documents sd
  JOIN document_requirements r ON r.id = sd.requirement_id
  WHERE r.is_required = TRUE
    AND r.criticality = 'critical'
    AND (
      (sd.subject_type = 'driver' AND sd.driver_employee_id = p_employee_id) OR
      (sd.subject_type = 'pa' AND sd.pa_employee_id = p_employee_id)
    )
    AND (
      sd.status IN ('missing', 'expired', 'rejected')
      OR (r.requires_expiry = TRUE AND (sd.expiry_date IS NULL OR sd.expiry_date < CURRENT_DATE))
    );

  UPDATE employees
  SET can_work = (invalid_count = 0)
  WHERE id = p_employee_id;
END;
$$;

CREATE OR REPLACE FUNCTION recompute_vehicle_operational(p_vehicle_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM subject_documents sd
  JOIN document_requirements r ON r.id = sd.requirement_id
  WHERE sd.subject_type = 'vehicle'
    AND sd.vehicle_id = p_vehicle_id
    AND r.is_required = TRUE
    AND r.criticality = 'critical'
    AND (
      sd.status IN ('missing', 'expired', 'rejected')
      OR (r.requires_expiry = TRUE AND (sd.expiry_date IS NULL OR sd.expiry_date < CURRENT_DATE))
    );

  IF invalid_count > 0 THEN
    UPDATE vehicles
    SET off_the_road = TRUE,
        off_the_road_auto = TRUE
    WHERE id = p_vehicle_id;
  ELSE
    UPDATE vehicles
    SET off_the_road = FALSE,
        off_the_road_auto = FALSE
    WHERE id = p_vehicle_id
      AND off_the_road_auto = TRUE;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_recompute_subject_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.subject_type = 'driver' THEN
      PERFORM recompute_employee_can_work(OLD.driver_employee_id);
    ELSIF OLD.subject_type = 'pa' THEN
      PERFORM recompute_employee_can_work(OLD.pa_employee_id);
    ELSIF OLD.subject_type = 'vehicle' THEN
      PERFORM recompute_vehicle_operational(OLD.vehicle_id);
    ELSIF OLD.subject_type = 'employee' THEN
      PERFORM recompute_employee_can_work(OLD.employee_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.subject_type = 'driver' THEN
    PERFORM recompute_employee_can_work(NEW.driver_employee_id);
  ELSIF NEW.subject_type = 'pa' THEN
    PERFORM recompute_employee_can_work(NEW.pa_employee_id);
  ELSIF NEW.subject_type = 'vehicle' THEN
    PERFORM recompute_vehicle_operational(NEW.vehicle_id);
  ELSIF NEW.subject_type = 'employee' THEN
    PERFORM recompute_employee_can_work(NEW.employee_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_ensure_driver_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM ensure_subject_documents_for_driver(NEW.employee_id);
  PERFORM recompute_employee_can_work(NEW.employee_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_ensure_pa_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM ensure_subject_documents_for_pa(NEW.employee_id);
  PERFORM recompute_employee_can_work(NEW.employee_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_ensure_vehicle_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM ensure_subject_documents_for_vehicle(NEW.id);
  PERFORM recompute_vehicle_operational(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_subject_documents_recompute ON subject_documents;
CREATE TRIGGER trigger_subject_documents_recompute
  AFTER INSERT OR UPDATE OR DELETE ON subject_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_subject_documents();

DROP TRIGGER IF EXISTS trigger_ensure_driver_documents ON drivers;
CREATE TRIGGER trigger_ensure_driver_documents
  AFTER INSERT ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ensure_driver_documents();

DROP TRIGGER IF EXISTS trigger_ensure_pa_documents ON passenger_assistants;
CREATE TRIGGER trigger_ensure_pa_documents
  AFTER INSERT ON passenger_assistants
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ensure_pa_documents();

DROP TRIGGER IF EXISTS trigger_ensure_vehicle_documents ON vehicles;
CREATE TRIGGER trigger_ensure_vehicle_documents
  AFTER INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ensure_vehicle_documents();

