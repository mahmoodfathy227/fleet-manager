-- Add priority_vehicle boolean column to routes table
-- Default false: existing routes are non-priority

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS priority_vehicle BOOLEAN NOT NULL DEFAULT FALSE;
