-- Migration 183: Keep vehicles.mot_date / tax_date in sync with subject_documents
-- When a vehicle's mot_date or tax_date is updated, automatically update the
-- corresponding subject_documents row's expiry_date and status.

CREATE OR REPLACE FUNCTION sync_vehicle_dates_to_subject_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mot_req_id  UUID := 'c37c2cbb-96b1-45af-8eeb-4cf537db36f2';
  tax_req_id  UUID := '2e27a557-5b9c-49fc-9fe4-f80cc2f5400a';
BEGIN
  -- Skip on INSERT (trigger_ensure_vehicle_documents handles the initial row creation)
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Sync MOT date
  IF NEW.mot_date IS DISTINCT FROM OLD.mot_date THEN
    UPDATE subject_documents
    SET
      expiry_date = NEW.mot_date,
      status      = CASE
                      WHEN NEW.mot_date IS NULL                 THEN 'missing'
                      WHEN NEW.mot_date < CURRENT_DATE          THEN 'expired'
                      ELSE 'valid'
                    END,
      updated_at  = NOW()
    WHERE subject_type = 'vehicle'
      AND vehicle_id   = NEW.id
      AND requirement_id = mot_req_id;

    RAISE DEBUG '[sync_vehicle_dates] vehicle % mot_date -> %', NEW.id, NEW.mot_date;
  END IF;

  -- Sync TAX date
  IF NEW.tax_date IS DISTINCT FROM OLD.tax_date THEN
    UPDATE subject_documents
    SET
      expiry_date = NEW.tax_date,
      status      = CASE
                      WHEN NEW.tax_date IS NULL                 THEN 'missing'
                      WHEN NEW.tax_date < CURRENT_DATE          THEN 'expired'
                      ELSE 'valid'
                    END,
      updated_at  = NOW()
    WHERE subject_type = 'vehicle'
      AND vehicle_id   = NEW.id
      AND requirement_id = tax_req_id;

    RAISE DEBUG '[sync_vehicle_dates] vehicle % tax_date -> %', NEW.id, NEW.tax_date;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_vehicle_dates ON vehicles;

CREATE TRIGGER trigger_sync_vehicle_dates
  AFTER UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION sync_vehicle_dates_to_subject_documents();
