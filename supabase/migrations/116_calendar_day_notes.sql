-- Calendar day notes: one plain-text note per day (no link to routes/drivers/vehicles).
-- Used by Main Calendar page for day-level updates.

CREATE TABLE IF NOT EXISTS calendar_day_notes (
  id BIGSERIAL PRIMARY KEY,
  note_date DATE NOT NULL,
  note_text TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_date)
);

COMMENT ON TABLE calendar_day_notes IS 'One note per calendar day; plain text only. Used by Main Calendar.';
COMMENT ON COLUMN calendar_day_notes.note_date IS 'The date this note applies to (one note per day globally).';
COMMENT ON COLUMN calendar_day_notes.note_text IS 'Plain text content for the day.';
COMMENT ON COLUMN calendar_day_notes.created_by IS 'User (users.id) who created the note.';
COMMENT ON COLUMN calendar_day_notes.updated_by IS 'User (users.id) who last updated the note.';

CREATE INDEX IF NOT EXISTS idx_calendar_day_notes_note_date ON calendar_day_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_calendar_day_notes_created_at ON calendar_day_notes(created_at DESC);

-- Track which user has "seen" a day's note (so we can hide the unread dot for them)
CREATE TABLE IF NOT EXISTS calendar_day_note_views (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, note_date)
);

COMMENT ON TABLE calendar_day_note_views IS 'Marks which days a user has viewed so the unread indicator can be hidden for them.';

CREATE INDEX IF NOT EXISTS idx_calendar_day_note_views_user_date ON calendar_day_note_views(user_id, note_date);

-- RLS
ALTER TABLE calendar_day_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_day_note_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read calendar_day_notes" ON calendar_day_notes;
DROP POLICY IF EXISTS "Authenticated can insert calendar_day_notes" ON calendar_day_notes;
DROP POLICY IF EXISTS "Authenticated can update calendar_day_notes" ON calendar_day_notes;
DROP POLICY IF EXISTS "Authenticated can delete calendar_day_notes" ON calendar_day_notes;
CREATE POLICY "Authenticated can read calendar_day_notes"
  ON calendar_day_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert calendar_day_notes"
  ON calendar_day_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update calendar_day_notes"
  ON calendar_day_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete calendar_day_notes"
  ON calendar_day_notes FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read own calendar_day_note_views" ON calendar_day_note_views;
DROP POLICY IF EXISTS "Authenticated can insert own calendar_day_note_views" ON calendar_day_note_views;
DROP POLICY IF EXISTS "Authenticated can delete own calendar_day_note_views" ON calendar_day_note_views;
-- Resolve current user by JWT email (matches 077/099); avoids integer vs uuid if users.id/user_id types differ
CREATE POLICY "Authenticated can read own calendar_day_note_views"
  ON calendar_day_note_views FOR SELECT TO authenticated USING (user_id = (SELECT u.id FROM users u WHERE LOWER(u.email) = LOWER(auth.jwt() ->> 'email') LIMIT 1));
CREATE POLICY "Authenticated can insert own calendar_day_note_views"
  ON calendar_day_note_views FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT u.id FROM users u WHERE LOWER(u.email) = LOWER(auth.jwt() ->> 'email') LIMIT 1));
CREATE POLICY "Authenticated can delete own calendar_day_note_views"
  ON calendar_day_note_views FOR DELETE TO authenticated USING (user_id = (SELECT u.id FROM users u WHERE LOWER(u.email) = LOWER(auth.jwt() ->> 'email') LIMIT 1));
