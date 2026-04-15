-- Migration 184: Add engine_state to vehicles_realtime
-- Part of the Live Tracking Overhaul (Phase 1)
-- Needed to drive status-based marker icons on the live map:
--   'Off'  → gray marker
--   'Idle' → amber marker
--   'On'   → green directional arrow (when speed > 3 kph)

ALTER TABLE vehicles_realtime
  ADD COLUMN IF NOT EXISTS engine_state TEXT;

COMMENT ON COLUMN vehicles_realtime.engine_state IS
  'Engine status from Samsara: Off | On | Idle. NULL = unknown / not yet polled.';
