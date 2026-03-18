-- Allow public (anon) select of notifications by email_token for upload links
-- This keeps existing authenticated policy intact.

DROP POLICY IF EXISTS "Allow public read notifications by token" ON notifications;

CREATE POLICY "Allow public read notifications by token"
  ON notifications
  FOR SELECT
  TO public
  USING (email_token IS NOT NULL);

