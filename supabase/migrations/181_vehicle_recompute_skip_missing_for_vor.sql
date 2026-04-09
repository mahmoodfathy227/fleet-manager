-- New vehicles get placeholder subject_documents with status 'missing'. Counting those as
-- invalid forced off_the_road immediately after INSERT. Only expired/rejected (or
-- required-expiry violations on non-missing rows) should auto-VOR.

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
      sd.status IN ('expired', 'rejected')
      OR (
        sd.status <> 'missing'
        AND r.requires_expiry = TRUE
        AND (sd.expiry_date IS NULL OR sd.expiry_date < CURRENT_DATE)
      )
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
