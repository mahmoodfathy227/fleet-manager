-- Migration 185: vehicle_fuel_distance
-- One row per vehicle, always upserted by samsara-fuel-snapshot Edge Function.
-- Stores today's and this-week's distance/fuel aggregates from Samsara fuel-energy report.

CREATE TABLE IF NOT EXISTS vehicle_fuel_distance (
  vehicle_db_id          integer PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  samsara_vehicle_id     text,

  -- Today (midnight → now, UK date)
  distance_today_m       numeric DEFAULT 0,
  fuel_today_ml          numeric DEFAULT 0,
  engine_time_today_ms   bigint  DEFAULT 0,
  idle_time_today_ms     bigint  DEFAULT 0,
  carbon_today_kg        numeric DEFAULT 0,

  -- This week (Monday 00:00 → now)
  distance_week_m        numeric DEFAULT 0,
  fuel_week_ml           numeric DEFAULT 0,
  engine_time_week_ms    bigint  DEFAULT 0,
  idle_time_week_ms      bigint  DEFAULT 0,
  carbon_week_kg         numeric DEFAULT 0,

  -- Efficiency (from weekly window — more meaningful than single day)
  efficiency_mpg         numeric DEFAULT 0,

  updated_at             timestamptz DEFAULT now()
);

-- RLS: admins can read; Edge Function uses service role key so no INSERT policy needed
ALTER TABLE vehicle_fuel_distance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vehicle_fuel_distance"
  ON vehicle_fuel_distance FOR SELECT
  TO authenticated
  USING (true);
