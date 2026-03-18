-- Allow multiple notes/updates per day, each with their own timestamp.
-- Drop the one-note-per-day constraint.

ALTER TABLE calendar_day_notes DROP CONSTRAINT IF EXISTS calendar_day_notes_note_date_key;

COMMENT ON TABLE calendar_day_notes IS 'Day-level updates for the calendar; multiple updates per day allowed, each with created_at/updated_at timestamps.';
COMMENT ON COLUMN calendar_day_notes.note_date IS 'The date this update applies to.';

-- Order by created_at for consistent listing (index already exists on note_date; add composite for day + time)
CREATE INDEX IF NOT EXISTS idx_calendar_day_notes_date_created_at ON calendar_day_notes(note_date, created_at DESC);
