-- Add CASCADE DELETE for employees
-- This allows deleting employees and automatically deleting all related records

-- Drivers - ensure CASCADE is set so drivers are deleted when employees are deleted
ALTER TABLE drivers
DROP CONSTRAINT IF EXISTS drivers_employee_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'drivers'::regclass
        AND confrelid = 'employees'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE drivers DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE drivers
ADD CONSTRAINT drivers_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- Passenger Assistants - ensure CASCADE is set so PAs are deleted when employees are deleted
ALTER TABLE passenger_assistants
DROP CONSTRAINT IF EXISTS passenger_assistants_employee_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'passenger_assistants'::regclass
        AND confrelid = 'employees'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE passenger_assistants DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE passenger_assistants
ADD CONSTRAINT passenger_assistants_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- Vehicle Assignments - set to NULL when employee is deleted (preserve assignment history)
ALTER TABLE vehicle_assignments
DROP CONSTRAINT IF EXISTS vehicle_assignments_employee_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'vehicle_assignments'::regclass
        AND confrelid = 'employees'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE vehicle_assignments DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE vehicle_assignments
ADD CONSTRAINT vehicle_assignments_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Next of Kin - ensure CASCADE is set so next of kin records are deleted when employees are deleted
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'next_of_kin'
    ) THEN
        ALTER TABLE next_of_kin
        DROP CONSTRAINT IF EXISTS next_of_kin_employee_id_fkey;

        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'next_of_kin'::regclass
                AND confrelid = 'employees'::regclass
                AND contype = 'f'
            ) LOOP
                EXECUTE 'ALTER TABLE next_of_kin DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
            END LOOP;
        END;

        ALTER TABLE next_of_kin
        ADD CONSTRAINT next_of_kin_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Documents - set to NULL when employee is deleted (preserve document history)
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_employee_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'documents'::regclass
        AND confrelid = 'employees'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE documents DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE documents
ADD CONSTRAINT documents_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Incidents employee_id - set to NULL when employee is deleted (preserve incident history)
ALTER TABLE incidents
DROP CONSTRAINT IF EXISTS incidents_employee_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'incidents'::regclass
        AND confrelid = 'employees'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE incidents DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE incidents
ADD CONSTRAINT incidents_employee_id_fkey 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Note: incident_employees.employee_id already has ON DELETE CASCADE
-- (set in migration 012_incident_relations.sql)
-- This means when an employee is deleted, their entries in incident_employees are deleted
-- but the incident itself is preserved (via incidents.employee_id SET NULL above)

-- Call logs related_employee_id - set to NULL when employee is deleted (preserve call history)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'call_logs'
    ) THEN
        ALTER TABLE call_logs
        DROP CONSTRAINT IF EXISTS call_logs_related_employee_id_fkey;

        FOR r IN (
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'call_logs'::regclass
            AND confrelid = 'employees'::regclass
            AND contype = 'f'
        ) LOOP
            EXECUTE 'ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
        END LOOP;

        ALTER TABLE call_logs
        ADD CONSTRAINT call_logs_related_employee_id_fkey 
        FOREIGN KEY (related_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Note: routes.driver_id and routes.passenger_assistant_id already have ON DELETE SET NULL
-- (set in migration 021_add_crew_to_routes.sql)
-- When employee is deleted -> driver/PA is deleted (CASCADE) -> route.driver_id/pa_id is set to NULL (SET NULL)
-- So routes will be preserved, just with driver/PA unassigned

-- Route Sessions driver_id and passenger_assistant_id - ensure SET NULL is set
-- (should already have it from migration 016, but ensure it's correct)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'route_sessions'
    ) THEN
        -- Handle driver_id - drop all constraints that reference drivers, then add the correct one
        FOR r IN (
            SELECT conname
            FROM pg_constraint pc
            JOIN pg_class rel ON rel.oid = pc.confrelid
            WHERE pc.conrelid = 'route_sessions'::regclass
            AND pc.contype = 'f'
            AND rel.relname = 'drivers'
        ) LOOP
            EXECUTE 'ALTER TABLE route_sessions DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
        END LOOP;

        -- Add the constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'route_sessions'::regclass
            AND conname = 'route_sessions_driver_id_fkey'
        ) THEN
            ALTER TABLE route_sessions 
            ADD CONSTRAINT route_sessions_driver_id_fkey 
            FOREIGN KEY (driver_id) REFERENCES drivers(employee_id) ON DELETE SET NULL;
        END IF;

        -- Handle passenger_assistant_id - drop all constraints that reference passenger_assistants, then add the correct one
        FOR r IN (
            SELECT conname
            FROM pg_constraint pc
            JOIN pg_class rel ON rel.oid = pc.confrelid
            WHERE pc.conrelid = 'route_sessions'::regclass
            AND pc.contype = 'f'
            AND rel.relname = 'passenger_assistants'
        ) LOOP
            EXECUTE 'ALTER TABLE route_sessions DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
        END LOOP;

        -- Add the constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'route_sessions'::regclass
            AND conname = 'route_sessions_passenger_assistant_id_fkey'
        ) THEN
            ALTER TABLE route_sessions 
            ADD CONSTRAINT route_sessions_passenger_assistant_id_fkey 
            FOREIGN KEY (passenger_assistant_id) REFERENCES passenger_assistants(employee_id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Add comments
COMMENT ON CONSTRAINT drivers_employee_id_fkey ON drivers IS 'Cascade delete: deleting an employee will delete their driver record';
COMMENT ON CONSTRAINT passenger_assistants_employee_id_fkey ON passenger_assistants IS 'Cascade delete: deleting an employee will delete their passenger assistant record';
COMMENT ON CONSTRAINT vehicle_assignments_employee_id_fkey ON vehicle_assignments IS 'Set NULL on delete: deleting an employee will set employee_id to NULL in assignments (preserves assignment history)';
COMMENT ON CONSTRAINT documents_employee_id_fkey ON documents IS 'Set NULL on delete: deleting an employee will set employee_id to NULL in documents (preserves document history)';
COMMENT ON CONSTRAINT incidents_employee_id_fkey ON incidents IS 'Set NULL on delete: deleting an employee will set employee_id to NULL in incidents (preserves incident history)';

-- Comment on next_of_kin constraint (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'next_of_kin'
    ) THEN
        EXECUTE 'COMMENT ON CONSTRAINT next_of_kin_employee_id_fkey ON next_of_kin IS ''Cascade delete: deleting an employee will delete all their next of kin records''';
    END IF;
END $$;

-- Comment on call_logs constraint (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'call_logs'
    ) THEN
        EXECUTE 'COMMENT ON CONSTRAINT call_logs_related_employee_id_fkey ON call_logs IS ''Set NULL on delete: deleting an employee will set related_employee_id to NULL in call logs (preserves call history)''';
    END IF;
END $$;

