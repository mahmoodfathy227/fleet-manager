-- Ensure Samsara tracking foundation exists even if earlier migration versions collided.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS samsara_vehicle_id TEXT,
  ADD COLUMN IF NOT EXISTS registration_normalized TEXT,
  ADD COLUMN IF NOT EXISTS samsara_last_mapping_sync_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_samsara_vehicle_id_unique
  ON public.vehicles(samsara_vehicle_id)
  WHERE samsara_vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_registration_normalized
  ON public.vehicles(registration_normalized);

CREATE OR REPLACE FUNCTION public.normalize_registration_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN REGEXP_REPLACE(UPPER(input_text), '[^A-Z0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.set_vehicle_registration_normalized()
RETURNS TRIGGER AS $$
BEGIN
  NEW.registration_normalized := public.normalize_registration_text(NEW.registration);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_vehicle_registration_normalized ON public.vehicles;
CREATE TRIGGER trigger_set_vehicle_registration_normalized
  BEFORE INSERT OR UPDATE OF registration ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vehicle_registration_normalized();

UPDATE public.vehicles
SET registration_normalized = public.normalize_registration_text(registration)
WHERE registration IS NOT NULL
  AND (registration_normalized IS NULL OR registration_normalized = '');

CREATE TABLE IF NOT EXISTS public.vehicle_telematics_latest (
  vehicle_id INTEGER PRIMARY KEY REFERENCES public.vehicles(id) ON DELETE CASCADE,
  samsara_vehicle_id TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  heading NUMERIC(8, 2),
  speed_kph NUMERIC(10, 2),
  ignition_on BOOLEAN,
  odometer_km NUMERIC(14, 3),
  fuel_used_liters NUMERIC(14, 3),
  telematics_timestamp TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  data_source TEXT NOT NULL DEFAULT 'samsara',
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_telematics_latest_timestamp
  ON public.vehicle_telematics_latest(telematics_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.vehicle_telematics_history (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  samsara_vehicle_id TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  heading NUMERIC(8, 2),
  speed_kph NUMERIC(10, 2),
  ignition_on BOOLEAN,
  odometer_km NUMERIC(14, 3),
  fuel_used_liters NUMERIC(14, 3),
  telematics_timestamp TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_vehicle_telematics_history_vehicle_ts
  ON public.vehicle_telematics_history(vehicle_id, telematics_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.samsara_vehicle_unmatched (
  id BIGSERIAL PRIMARY KEY,
  external_vehicle_id TEXT NOT NULL UNIQUE,
  external_registration_raw TEXT,
  normalized_registration TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.samsara_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial_success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_matched INTEGER NOT NULL DEFAULT 0,
  records_unmatched INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.samsara_mapping_audit_log (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  old_samsara_vehicle_id TEXT,
  new_samsara_vehicle_id TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  changed_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.telematics_alert_thresholds (
  id SERIAL PRIMARY KEY,
  stale_minutes INTEGER NOT NULL DEFAULT 5,
  off_route_meters INTEGER NOT NULL DEFAULT 250,
  excessive_idle_minutes INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.telematics_alert_thresholds (id, stale_minutes, off_route_meters, excessive_idle_minutes)
VALUES (1, 5, 250, 10)
ON CONFLICT (id) DO NOTHING;
