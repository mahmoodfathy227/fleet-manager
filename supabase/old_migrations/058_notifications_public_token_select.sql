-- Allow public (anon) to fetch notifications by token for upload links
-- Note: clients still need the email_token in the filter; this policy permits anon select
-- so that token-based upload links work on devices not logged in.
DROP POLICY IF EXISTS "Allow anon select notifications by token" ON notifications;

CREATE POLICY "Allow anon select notifications by token"
  ON notifications
  FOR SELECT
  TO anon
  USING (email_token IS NOT NULL);
