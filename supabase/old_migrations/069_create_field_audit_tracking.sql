-- ====================================================
-- Field-Level Audit Tracking
-- Tracks individual field changes for vehicles
-- ====================================================

-- Create field_audit_log table
CREATE TABLE IF NOT EXISTS field_audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR NOT NULL,
  record_id INTEGER NOT NULL,
  field_name VARCHAR NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  change_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  action VARCHAR NOT NULL CHECK (action IN ('CREATE', 'UPDATE'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_field_audit_table_record ON field_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_field_audit_field ON field_audit_log(table_name, record_id, field_name);
CREATE INDEX IF NOT EXISTS idx_field_audit_time ON field_audit_log(change_time DESC);

-- Enable Row Level Security
ALTER TABLE field_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON field_audit_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON field_audit_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE field_audit_log IS 'Tracks individual field changes for audit purposes';
COMMENT ON COLUMN field_audit_log.table_name IS 'Name of the table being audited';
COMMENT ON COLUMN field_audit_log.record_id IS 'ID of the record being changed';
COMMENT ON COLUMN field_audit_log.field_name IS 'Name of the field being changed';
COMMENT ON COLUMN field_audit_log.old_value IS 'Previous value of the field';
COMMENT ON COLUMN field_audit_log.new_value IS 'New value of the field';
COMMENT ON COLUMN field_audit_log.changed_by IS 'User who made the change';
COMMENT ON COLUMN field_audit_log.action IS 'Type of action: CREATE or UPDATE';

-- Function to log field changes for vehicles
CREATE OR REPLACE FUNCTION log_vehicle_field_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id INTEGER;
  field_name TEXT;
  old_val TEXT;
  new_val TEXT;
  current_user_email TEXT;
BEGIN
  -- Get current user email from auth context
  SELECT email INTO current_user_email
  FROM auth.users
  WHERE id = auth.uid()
  LIMIT 1;

  -- Get user ID from users table
  IF current_user_email IS NOT NULL THEN
    SELECT id INTO current_user_id
    FROM users
    WHERE email = current_user_email
    LIMIT 1;
  END IF;

  -- If this is an INSERT (CREATE), log all fields
  IF TG_OP = 'INSERT' THEN
    FOR field_name IN 
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' 
      AND column_name NOT IN ('id', 'created_at', 'updated_at')
    LOOP
      EXECUTE format('SELECT $1.%I', field_name) INTO new_val USING NEW;
      IF new_val IS NOT NULL THEN
        INSERT INTO field_audit_log (table_name, record_id, field_name, old_value, new_value, changed_by, action)
        VALUES ('vehicles', NEW.id, field_name, NULL, new_val::TEXT, current_user_id, 'CREATE');
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- If this is an UPDATE, log only changed fields
  IF TG_OP = 'UPDATE' THEN
    FOR field_name IN 
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' 
      AND column_name NOT IN ('id', 'created_at', 'updated_at')
    LOOP
      EXECUTE format('SELECT $1.%I, $2.%I', field_name, field_name) INTO old_val, new_val USING OLD, NEW;
      
      -- Only log if the value actually changed
      IF (old_val IS DISTINCT FROM new_val) THEN
        INSERT INTO field_audit_log (table_name, record_id, field_name, old_value, new_value, changed_by, action)
        VALUES ('vehicles', NEW.id, field_name, old_val::TEXT, new_val::TEXT, current_user_id, 'UPDATE');
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for vehicles table
DROP TRIGGER IF EXISTS trigger_log_vehicle_field_changes ON vehicles;
CREATE TRIGGER trigger_log_vehicle_field_changes
  AFTER INSERT OR UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION log_vehicle_field_changes();

