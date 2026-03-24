-- ====================================================
-- Samsara integration foundation
-- ====================================================
-- Adds:
-- - vehicle linkage fields
-- - latest and history telematics tables
-- - unmatched mapping queue
-- - sync logs
-- - mapping audit log
-- - alert thresholds
-- ====================================================

-- Vehicle link fields
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS samsara_vehicle_id TEXT,
  ADD COLUMN IF NOT EXISTS registration_normalized TEXT,
  ADD COLUMN IF NOT EXISTS samsara_last_mapping_sync_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_samsara_vehicle_id_unique
  ON vehicles(samsara_vehicle_id)
  WHERE samsara_vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_registration_normalized
  ON vehicles(registration_normalized);

-- Normalize registrations consistently
CREATE OR REPLACE FUNCTION normalize_registration_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN REGEXP_REPLACE(UPPER(input_text), '[^A-Z0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_vehicle_registration_normalized()
RETURNS TRIGGER AS $$
BEGIN
  NEW.registration_normalized := normalize_registration_text(NEW.registration);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_vehicle_registration_normalized ON vehicles;
CREATE TRIGGER trigger_set_vehicle_registration_normalized
  BEFORE INSERT OR UPDATE OF registration
  ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION set_vehicle_registration_normalized();

UPDATE vehicles
SET registration_normalized = normalize_registration_text(registration)
WHERE registration IS NOT NULL
  AND (registration_normalized IS NULL OR registration_normalized = '');

-- Latest telematics snapshot
CREATE TABLE IF NOT EXISTS vehicle_telematics_latest (
  vehicle_id INTEGER PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
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
  ON vehicle_telematics_latest(telematics_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_telematics_latest_sync
  ON vehicle_telematics_latest(last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_telematics_latest_samsara_vehicle
  ON vehicle_telematics_latest(samsara_vehicle_id);

-- Telematics history (used for mileage/fuel aggregates)
CREATE TABLE IF NOT EXISTS vehicle_telematics_history (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
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
  ON vehicle_telematics_history(vehicle_id, telematics_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_telematics_history_ts
  ON vehicle_telematics_history(telematics_timestamp DESC);

-- Unmatched mappings queue
CREATE TABLE IF NOT EXISTS samsara_vehicle_unmatched (
  id BIGSERIAL PRIMARY KEY,
  external_vehicle_id TEXT NOT NULL UNIQUE,
  external_registration_raw TEXT,
  normalized_registration TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samsara_unmatched_status
  ON samsara_vehicle_unmatched(status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_samsara_unmatched_normalized
  ON samsara_vehicle_unmatched(normalized_registration);

-- Sync logs
CREATE TABLE IF NOT EXISTS samsara_sync_logs (
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

CREATE INDEX IF NOT EXISTS idx_samsara_sync_logs_started
  ON samsara_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_samsara_sync_logs_type_status
  ON samsara_sync_logs(sync_type, status);

-- Manual/auto mapping audit
CREATE TABLE IF NOT EXISTS samsara_mapping_audit_log (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  old_samsara_vehicle_id TEXT,
  new_samsara_vehicle_id TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samsara_mapping_audit_vehicle
  ON samsara_mapping_audit_log(vehicle_id, created_at DESC);

-- Threshold configuration
CREATE TABLE IF NOT EXISTS telematics_alert_thresholds (
  id SERIAL PRIMARY KEY,
  stale_minutes INTEGER NOT NULL DEFAULT 5,
  off_route_meters INTEGER NOT NULL DEFAULT 250,
  excessive_idle_minutes INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO telematics_alert_thresholds (id, stale_minutes, off_route_meters, excessive_idle_minutes)
VALUES (1, 5, 250, 10)
ON CONFLICT (id) DO NOTHING;

-- Updated-at helper trigger for new tables
CREATE OR REPLACE FUNCTION update_samsara_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vehicle_telematics_latest_updated_at ON vehicle_telematics_latest;
CREATE TRIGGER trigger_vehicle_telematics_latest_updated_at
  BEFORE UPDATE ON vehicle_telematics_latest
  FOR EACH ROW
  EXECUTE FUNCTION update_samsara_updated_at();

DROP TRIGGER IF EXISTS trigger_samsara_vehicle_unmatched_updated_at ON samsara_vehicle_unmatched;
CREATE TRIGGER trigger_samsara_vehicle_unmatched_updated_at
  BEFORE UPDATE ON samsara_vehicle_unmatched
  FOR EACH ROW
  EXECUTE FUNCTION update_samsara_updated_at();

DROP TRIGGER IF EXISTS trigger_telematics_alert_thresholds_updated_at ON telematics_alert_thresholds;
CREATE TRIGGER trigger_telematics_alert_thresholds_updated_at
  BEFORE UPDATE ON telematics_alert_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION update_samsara_updated_at();

-- RLS
ALTER TABLE vehicle_telematics_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_telematics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE samsara_vehicle_unmatched ENABLE ROW LEVEL SECURITY;
ALTER TABLE samsara_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE samsara_mapping_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE telematics_alert_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telematics_latest_select" ON vehicle_telematics_latest;
CREATE POLICY "telematics_latest_select"
  ON vehicle_telematics_latest FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "telematics_history_select" ON vehicle_telematics_history;
CREATE POLICY "telematics_history_select"
  ON vehicle_telematics_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "samsara_unmatched_read" ON samsara_vehicle_unmatched;
CREATE POLICY "samsara_unmatched_read"
  ON samsara_vehicle_unmatched FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "samsara_unmatched_write" ON samsara_vehicle_unmatched;
CREATE POLICY "samsara_unmatched_write"
  ON samsara_vehicle_unmatched FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "samsara_sync_logs_read" ON samsara_sync_logs;
CREATE POLICY "samsara_sync_logs_read"
  ON samsara_sync_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "samsara_sync_logs_write" ON samsara_sync_logs;
CREATE POLICY "samsara_sync_logs_write"
  ON samsara_sync_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "samsara_mapping_audit_read" ON samsara_mapping_audit_log;
CREATE POLICY "samsara_mapping_audit_read"
  ON samsara_mapping_audit_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "samsara_mapping_audit_write" ON samsara_mapping_audit_log;
CREATE POLICY "samsara_mapping_audit_write"
  ON samsara_mapping_audit_log FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "telematics_thresholds_read" ON telematics_alert_thresholds;
CREATE POLICY "telematics_thresholds_read"
  ON telematics_alert_thresholds FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "telematics_thresholds_write" ON telematics_alert_thresholds;
CREATE POLICY "telematics_thresholds_write"
  ON telematics_alert_thresholds FOR ALL TO authenticated USING (true) WITH CHECK (true);
