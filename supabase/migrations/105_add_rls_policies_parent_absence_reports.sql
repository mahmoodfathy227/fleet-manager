-- ====================================================
-- Add RLS Policies for parent_absence_reports table
-- Ensures authenticated users can update parent absence reports
-- ====================================================

-- Enable Row Level Security if not already enabled
ALTER TABLE parent_absence_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to read parent absence reports" ON parent_absence_reports;
DROP POLICY IF EXISTS "Allow authenticated users to insert parent absence reports" ON parent_absence_reports;
DROP POLICY IF EXISTS "Allow authenticated users to update parent absence reports" ON parent_absence_reports;
DROP POLICY IF EXISTS "Allow authenticated users to delete parent absence reports" ON parent_absence_reports;

-- Create RLS Policies for authenticated users
CREATE POLICY "Allow authenticated users to read parent absence reports" 
  ON parent_absence_reports FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to insert parent absence reports" 
  ON parent_absence_reports FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update parent absence reports" 
  ON parent_absence_reports FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete parent absence reports" 
  ON parent_absence_reports FOR DELETE 
  TO authenticated 
  USING (true);

-- Add helpful comments
COMMENT ON POLICY "Allow authenticated users to read parent absence reports" ON parent_absence_reports IS 
  'Allows authenticated users to read all parent absence reports';
COMMENT ON POLICY "Allow authenticated users to insert parent absence reports" ON parent_absence_reports IS 
  'Allows authenticated users to insert new parent absence reports';
COMMENT ON POLICY "Allow authenticated users to update parent absence reports" ON parent_absence_reports IS 
  'Allows authenticated users to update parent absence reports (e.g., acknowledge them)';
COMMENT ON POLICY "Allow authenticated users to delete parent absence reports" ON parent_absence_reports IS 
  'Allows authenticated users to delete parent absence reports';
