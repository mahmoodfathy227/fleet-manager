-- Add CASCADE DELETE for schools
-- This allows deleting schools and automatically deleting all related routes, passengers, and crew

-- Drop existing foreign key constraints and recreate with CASCADE
-- Routes
ALTER TABLE routes
DROP CONSTRAINT IF EXISTS routes_school_id_fkey;

ALTER TABLE routes
ADD CONSTRAINT routes_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Passengers
ALTER TABLE passengers
DROP CONSTRAINT IF EXISTS passengers_school_id_fkey;

ALTER TABLE passengers
ADD CONSTRAINT passengers_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Crew
ALTER TABLE crew
DROP CONSTRAINT IF EXISTS crew_school_id_fkey;

ALTER TABLE crew
ADD CONSTRAINT crew_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Passengers route_id - add CASCADE so when routes are deleted, passengers are also deleted
-- (This ensures passengers are deleted when routes are deleted, even if school_id is somehow null)
ALTER TABLE passengers
DROP CONSTRAINT IF EXISTS passengers_route_id_fkey;

ALTER TABLE passengers
ADD CONSTRAINT passengers_route_id_fkey 
FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

-- Route Points - ensure CASCADE is set (may have been created without it in initial schema)
-- Drop all possible constraint names
ALTER TABLE route_points
DROP CONSTRAINT IF EXISTS route_points_route_id_fkey;

ALTER TABLE route_points
DROP CONSTRAINT IF EXISTS route_points_route_id_fkey1;

-- Try to find and drop any existing constraint
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'route_points'::regclass
        AND confrelid = 'routes'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE route_points DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE route_points
ADD CONSTRAINT route_points_route_id_fkey 
FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

-- Crew route_id - ensure CASCADE is set
ALTER TABLE crew
DROP CONSTRAINT IF EXISTS crew_route_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'crew'::regclass
        AND confrelid = 'routes'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE crew DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE crew
ADD CONSTRAINT crew_route_id_fkey 
FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

-- Incidents route_id - ensure CASCADE is set so incidents are deleted when routes are deleted
ALTER TABLE incidents
DROP CONSTRAINT IF EXISTS incidents_route_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'incidents'::regclass
        AND confrelid = 'routes'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE incidents DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE incidents
ADD CONSTRAINT incidents_route_id_fkey 
FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

-- Passenger Parent Contacts - ensure CASCADE is set so links are deleted when passengers are deleted
ALTER TABLE passenger_parent_contacts
DROP CONSTRAINT IF EXISTS passenger_parent_contacts_passenger_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'passenger_parent_contacts'::regclass
        AND confrelid = 'passengers'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE passenger_parent_contacts DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE passenger_parent_contacts
ADD CONSTRAINT passenger_parent_contacts_passenger_id_fkey 
FOREIGN KEY (passenger_id) REFERENCES passengers(id) ON DELETE CASCADE;

-- Call logs related_route_id - set to NULL when route is deleted (not CASCADE, as we want to keep call logs)
-- Only update if the table exists
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
        -- Drop existing constraint if it exists
        ALTER TABLE call_logs
        DROP CONSTRAINT IF EXISTS call_logs_related_route_id_fkey;

        -- Find and drop any existing constraint
        FOR r IN (
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'call_logs'::regclass
            AND confrelid = 'routes'::regclass
            AND contype = 'f'
        ) LOOP
            EXECUTE 'ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
        END LOOP;

        -- Add new constraint with SET NULL
        ALTER TABLE call_logs
        ADD CONSTRAINT call_logs_related_route_id_fkey 
        FOREIGN KEY (related_route_id) REFERENCES routes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Note: Routes have ON DELETE CASCADE for route_id in route_points, route_sessions, crew, and incidents
-- Call logs (if table exists) will have route_id set to NULL (not deleted) to preserve call history
-- So when a route is deleted, route_points and route_sessions will be automatically deleted
-- This means deleting a school will cascade to:
-- 1. Routes (deleted via school_id CASCADE)
-- 2. Passengers (deleted via school_id CASCADE, and also via route_id CASCADE when routes are deleted)
-- 3. Crew (deleted via school_id CASCADE)
-- 4. Route points (deleted via route_id CASCADE when routes are deleted)
-- 5. Route sessions (deleted via route_id CASCADE when routes are deleted)
-- 6. Passenger attendance (deleted via route_session_id CASCADE when route sessions are deleted)
-- 7. Incidents (deleted via route_id CASCADE when routes are deleted)
-- 8. Passenger-parent contact links (deleted via passenger_id CASCADE when passengers are deleted)

COMMENT ON CONSTRAINT routes_school_id_fkey ON routes IS 'Cascade delete: deleting a school will delete all its routes';
COMMENT ON CONSTRAINT passengers_school_id_fkey ON passengers IS 'Cascade delete: deleting a school will delete all its passengers';
COMMENT ON CONSTRAINT passengers_route_id_fkey ON passengers IS 'Cascade delete: deleting a route will delete all its passengers';
COMMENT ON CONSTRAINT route_points_route_id_fkey ON route_points IS 'Cascade delete: deleting a route will delete all its route points';
COMMENT ON CONSTRAINT crew_route_id_fkey ON crew IS 'Cascade delete: deleting a route will delete all its crew assignments';
COMMENT ON CONSTRAINT crew_school_id_fkey ON crew IS 'Cascade delete: deleting a school will delete all its crew assignments';
COMMENT ON CONSTRAINT incidents_route_id_fkey ON incidents IS 'Cascade delete: deleting a route will delete all incidents related to that route';
COMMENT ON CONSTRAINT passenger_parent_contacts_passenger_id_fkey ON passenger_parent_contacts IS 'Cascade delete: deleting a passenger will delete all parent contact links';
-- Comment on call_logs constraint (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'call_logs'
    ) THEN
        EXECUTE 'COMMENT ON CONSTRAINT call_logs_related_route_id_fkey ON call_logs IS ''Set NULL on delete: deleting a route will set related_route_id to NULL in call logs (preserves call history)''';
    END IF;
END $$;

