-- Add CASCADE DELETE for vehicles
-- This allows deleting vehicles and automatically deleting all related configurations and updates

-- Vehicle Configurations - ensure CASCADE is set so configurations are deleted when vehicles are deleted
ALTER TABLE vehicle_configurations
DROP CONSTRAINT IF EXISTS vehicle_configurations_vehicle_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'vehicle_configurations'::regclass
        AND confrelid = 'vehicles'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE vehicle_configurations DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE vehicle_configurations
ADD CONSTRAINT vehicle_configurations_vehicle_id_fkey 
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

-- Vehicle Updates - ensure CASCADE is set (should already have it from migration 014, but ensure it's correct)
ALTER TABLE vehicle_updates
DROP CONSTRAINT IF EXISTS vehicle_updates_vehicle_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'vehicle_updates'::regclass
        AND confrelid = 'vehicles'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE vehicle_updates DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE vehicle_updates
ADD CONSTRAINT vehicle_updates_vehicle_id_fkey 
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

-- Vehicle Locations - ensure CASCADE is set
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicle_locations'
    ) THEN
        ALTER TABLE vehicle_locations
        DROP CONSTRAINT IF EXISTS vehicle_locations_vehicle_id_fkey;

        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'vehicle_locations'::regclass
                AND confrelid = 'vehicles'::regclass
                AND contype = 'f'
            ) LOOP
                EXECUTE 'ALTER TABLE vehicle_locations DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
            END LOOP;
        END;

        ALTER TABLE vehicle_locations
        ADD CONSTRAINT vehicle_locations_vehicle_id_fkey 
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Vehicle Assignments - set to NULL when vehicle is deleted (preserve assignment history)
ALTER TABLE vehicle_assignments
DROP CONSTRAINT IF EXISTS vehicle_assignments_vehicle_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'vehicle_assignments'::regclass
        AND confrelid = 'vehicles'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE vehicle_assignments DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE vehicle_assignments
ADD CONSTRAINT vehicle_assignments_vehicle_id_fkey 
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- Routes vehicle_id - set to NULL when vehicle is deleted (preserve route, just unassign vehicle)
ALTER TABLE routes
DROP CONSTRAINT IF EXISTS routes_vehicle_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'routes'::regclass
        AND confrelid = 'vehicles'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE routes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE routes
ADD CONSTRAINT routes_vehicle_id_fkey 
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- Incidents vehicle_id - set to NULL when vehicle is deleted (preserve incident history)
ALTER TABLE incidents
DROP CONSTRAINT IF EXISTS incidents_vehicle_id_fkey;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'incidents'::regclass
        AND confrelid = 'vehicles'::regclass
        AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE incidents DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE incidents
ADD CONSTRAINT incidents_vehicle_id_fkey 
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON CONSTRAINT vehicle_configurations_vehicle_id_fkey ON vehicle_configurations IS 'Cascade delete: deleting a vehicle will delete all its configurations';
COMMENT ON CONSTRAINT vehicle_updates_vehicle_id_fkey ON vehicle_updates IS 'Cascade delete: deleting a vehicle will delete all its updates';
COMMENT ON CONSTRAINT vehicle_assignments_vehicle_id_fkey ON vehicle_assignments IS 'Set NULL on delete: deleting a vehicle will set vehicle_id to NULL in assignments (preserves assignment history)';
COMMENT ON CONSTRAINT routes_vehicle_id_fkey ON routes IS 'Set NULL on delete: deleting a vehicle will set vehicle_id to NULL in routes (preserves route, just unassigns vehicle)';
COMMENT ON CONSTRAINT incidents_vehicle_id_fkey ON incidents IS 'Set NULL on delete: deleting a vehicle will set vehicle_id to NULL in incidents (preserves incident history)';

-- Comment on vehicle_locations constraint (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicle_locations'
    ) THEN
        EXECUTE 'COMMENT ON CONSTRAINT vehicle_locations_vehicle_id_fkey ON vehicle_locations IS ''Cascade delete: deleting a vehicle will delete all its location records''';
    END IF;
END $$;

