-- Remove private_hire_badge from passenger_assistants (PA only; drivers keep the column).
ALTER TABLE passenger_assistants DROP COLUMN IF EXISTS private_hire_badge;
