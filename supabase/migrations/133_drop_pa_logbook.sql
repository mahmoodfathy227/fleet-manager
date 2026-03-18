-- Remove logbook from passenger_assistants (PA only; drivers keep the column).
ALTER TABLE passenger_assistants DROP COLUMN IF EXISTS logbook;
