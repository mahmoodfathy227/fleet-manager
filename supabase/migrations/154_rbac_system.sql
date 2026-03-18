-- =====================================================
-- RBAC (Role-Based Access Control) for County Cars Dashboard
-- =====================================================
-- Creates roles, permissions, helper functions, seeds, and RLS policies.
-- Default deny: only explicitly allowed operations succeed.
-- =====================================================

-- =====================================================
-- 1. RBAC TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(active) WHERE active = true;

-- =====================================================
-- 2. HELPER FUNCTIONS (SECURITY DEFINER, safe search_path)
-- =====================================================

CREATE OR REPLACE FUNCTION auth_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id AND r.name = 'Full System Administrator'
    WHERE ur.user_id = auth.uid()
      AND ur.active = true
  );
$$;

CREATE OR REPLACE FUNCTION auth_has_permission(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id AND p.key = p_key
    WHERE ur.user_id = auth.uid()
      AND ur.active = true
  );
$$;

CREATE OR REPLACE FUNCTION auth_has_any_permission(p_keys TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id AND p.key = ANY(p_keys)
    WHERE ur.user_id = auth.uid()
      AND ur.active = true
  );
$$;

-- =====================================================
-- 3. SEED PERMISSIONS
-- =====================================================

INSERT INTO permissions (key, description) VALUES
  ('vehicles.read', 'View vehicles'),
  ('vehicles.write', 'Add/edit/delete vehicles'),
  ('vehicle_documents.read', 'View vehicle documents'),
  ('vehicle_documents.write', 'Upload/update vehicle documents (PHV, MOT, Insurance, Plates)'),
  ('vehicle_compliance.write', 'Edit vehicle compliance status'),
  ('employees.read', 'View employees'),
  ('employees.write', 'Add/edit employee profiles'),
  ('employee_documents.read', 'View employee documents'),
  ('employee_documents.write', 'Upload/update driver badges, licenses, school badges'),
  ('passengers.read', 'View passengers'),
  ('passengers.write', 'Add/edit passengers'),
  ('routes.read', 'View routes'),
  ('routes.write', 'Edit routes, assign drivers to vehicles, update route allocations'),
  ('compliance.read', 'View compliance dashboard'),
  ('compliance.write', 'Manage compliance'),
  ('reports.read', 'View operational reports'),
  ('accounting.read', 'View accounting summaries'),
  ('accounting.write', 'Add/edit invoices, payments, expenses, export financial reports'),
  ('roles.assign', 'Assign roles to users'),
  ('permissions.manage', 'Manage roles and permissions'),
  ('users.manage', 'Manage user accounts'),
  ('document_requirements.write', 'Manage document requirements'),
  ('admin.read', 'Access admin section')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 4. SEED ROLES
-- =====================================================

INSERT INTO roles (name, description, is_system) VALUES
  ('Fleet Access', 'Can manage vehicles and vehicle documents. No HR, accounting, or role assignment.', true),
  ('HR & Employee Compliance Access', 'Can manage employees and employee documents. No fleet or accounting.', true),
  ('View-Only Access', 'Read-only access to fleet, passengers, employees, compliance, accounting summaries.', true),
  ('Accounting & Finance Access', 'Can manage invoices, payments, expenses. Read-only reference to fleet/crews/passengers.', true),
  ('Operations Administrator', 'Full fleet, employee, passenger, compliance, routes. No accounting or role assignment.', true),
  ('Full System Administrator', 'Full access. Can assign roles and manage permissions.', true)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- =====================================================
-- 5. MAP ROLE_PERMISSIONS
-- =====================================================

-- Fleet Access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Fleet Access'
  AND p.key IN ('vehicles.read','vehicles.write','vehicle_documents.read','vehicle_documents.write','vehicle_compliance.write','reports.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR & Employee Compliance Access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'HR & Employee Compliance Access'
  AND p.key IN ('employees.read','employees.write','employee_documents.read','employee_documents.write','compliance.read','compliance.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- View-Only Access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'View-Only Access'
  AND p.key IN ('vehicles.read','vehicle_documents.read','employees.read','employee_documents.read','passengers.read','routes.read','compliance.read','reports.read','accounting.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accounting & Finance Access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Accounting & Finance Access'
  AND p.key IN ('vehicles.read','employees.read','passengers.read','routes.read','accounting.read','accounting.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operations Administrator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Operations Administrator'
  AND p.key IN ('vehicles.read','vehicles.write','vehicle_documents.read','vehicle_documents.write','vehicle_compliance.write',
    'employees.read','employees.write','employee_documents.read','employee_documents.write',
    'passengers.read','passengers.write','routes.read','routes.write','compliance.read','compliance.write','reports.read','document_requirements.write','admin.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Full System Administrator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Full System Administrator'
  AND p.key IN (SELECT key FROM permissions)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- 6. ASSIGN SUPER ADMIN TO EXISTING ADMINS
-- =====================================================

INSERT INTO user_roles (user_id, role_id, active)
SELECT au.id, (SELECT id FROM roles WHERE name = 'Full System Administrator' LIMIT 1), true
FROM auth.users au
JOIN public.users u ON LOWER(u.email) = LOWER(au.email)
WHERE u.role = 'admin' AND u.approval_status = 'approved'
ON CONFLICT (user_id, role_id) DO UPDATE SET active = true;

-- =====================================================
-- 7. ENABLE RLS ON RBAC TABLES
-- =====================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- roles, permissions: read for authenticated (to show in UI)
DROP POLICY IF EXISTS "rbac_roles_select" ON roles;
CREATE POLICY "rbac_roles_select" ON roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rbac_permissions_select" ON permissions;
CREATE POLICY "rbac_permissions_select" ON permissions FOR SELECT TO authenticated USING (true);

-- role_permissions: read for authenticated
DROP POLICY IF EXISTS "rbac_role_permissions_select" ON role_permissions;
CREATE POLICY "rbac_role_permissions_select" ON role_permissions FOR SELECT TO authenticated USING (true);

-- role_permissions: write only for super admin
DROP POLICY IF EXISTS "rbac_role_permissions_all" ON role_permissions;
CREATE POLICY "rbac_role_permissions_insert" ON role_permissions FOR INSERT TO authenticated WITH CHECK (auth_is_super_admin());
CREATE POLICY "rbac_role_permissions_update" ON role_permissions FOR UPDATE TO authenticated USING (auth_is_super_admin()) WITH CHECK (auth_is_super_admin());
CREATE POLICY "rbac_role_permissions_delete" ON role_permissions FOR DELETE TO authenticated USING (auth_is_super_admin());

-- roles: write only for super admin
DROP POLICY IF EXISTS "rbac_roles_insert" ON roles;
DROP POLICY IF EXISTS "rbac_roles_update" ON roles;
DROP POLICY IF EXISTS "rbac_roles_delete" ON roles;
CREATE POLICY "rbac_roles_insert" ON roles FOR INSERT TO authenticated WITH CHECK (auth_is_super_admin());
CREATE POLICY "rbac_roles_update" ON roles FOR UPDATE TO authenticated USING (auth_is_super_admin()) WITH CHECK (auth_is_super_admin());
CREATE POLICY "rbac_roles_delete" ON roles FOR DELETE TO authenticated USING (auth_is_super_admin());

-- permissions: write only for super admin
DROP POLICY IF EXISTS "rbac_permissions_insert" ON permissions;
DROP POLICY IF EXISTS "rbac_permissions_update" ON permissions;
DROP POLICY IF EXISTS "rbac_permissions_delete" ON permissions;
CREATE POLICY "rbac_permissions_insert" ON permissions FOR INSERT TO authenticated WITH CHECK (auth_is_super_admin());
CREATE POLICY "rbac_permissions_update" ON permissions FOR UPDATE TO authenticated USING (auth_is_super_admin()) WITH CHECK (auth_is_super_admin());
CREATE POLICY "rbac_permissions_delete" ON permissions FOR DELETE TO authenticated USING (auth_is_super_admin());

-- user_roles: read own + super admin reads all; write only super admin
DROP POLICY IF EXISTS "rbac_user_roles_select_own" ON user_roles;
CREATE POLICY "rbac_user_roles_select_own" ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth_is_super_admin());

DROP POLICY IF EXISTS "rbac_user_roles_insert" ON user_roles;
DROP POLICY IF EXISTS "rbac_user_roles_update" ON user_roles;
DROP POLICY IF EXISTS "rbac_user_roles_delete" ON user_roles;
CREATE POLICY "rbac_user_roles_insert" ON user_roles FOR INSERT TO authenticated WITH CHECK (auth_is_super_admin());
CREATE POLICY "rbac_user_roles_update" ON user_roles FOR UPDATE TO authenticated USING (auth_is_super_admin()) WITH CHECK (auth_is_super_admin());
CREATE POLICY "rbac_user_roles_delete" ON user_roles FOR DELETE TO authenticated USING (auth_is_super_admin());

-- =====================================================
-- 8. RLS POLICIES FOR DOMAIN TABLES
-- =====================================================
-- Super admin: full access. Others: permission-based.
-- Keep existing QR/public policies for vehicles/vehicle_updates/storage.
-- =====================================================

-- Helper: allow if super admin OR has any of the given permissions
-- We use auth_has_any_permission(ARRAY['perm1','perm2']) in policies.

-- --- VEHICLES ---
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow authenticated users to delete vehicles" ON vehicles;
-- Keep QR token policies (086) - they use anon/public
-- Add RBAC for authenticated
CREATE POLICY "rbac_vehicles_select" ON vehicles FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicles.read','vehicles.write','vehicle_documents.read','vehicle_documents.write','vehicle_compliance.write','reports.read','accounting.read','passengers.read','employees.read','routes.read']));
CREATE POLICY "rbac_vehicles_insert" ON vehicles FOR INSERT TO authenticated WITH CHECK (auth_has_permission('vehicles.write'));
CREATE POLICY "rbac_vehicles_update" ON vehicles FOR UPDATE TO authenticated USING (auth_has_permission('vehicles.write')) WITH CHECK (auth_has_permission('vehicles.write'));
CREATE POLICY "rbac_vehicles_delete" ON vehicles FOR DELETE TO authenticated USING (auth_has_permission('vehicles.write'));

-- --- DOCUMENTS ---
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON documents;
CREATE POLICY "rbac_documents_select" ON documents FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicle_documents.read','vehicle_documents.write','employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_documents_insert" ON documents FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write']));
CREATE POLICY "rbac_documents_update" ON documents FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write'])) WITH CHECK (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write']));
CREATE POLICY "rbac_documents_delete" ON documents FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write']));

-- --- DRIVERS ---
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to insert drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to update drivers" ON drivers;
DROP POLICY IF EXISTS "Allow authenticated users to delete drivers" ON drivers;
CREATE POLICY "rbac_drivers_select" ON drivers FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['employees.read','employees.write','passengers.read','routes.read','routes.write','reports.read']));
CREATE POLICY "rbac_drivers_insert" ON drivers FOR INSERT TO authenticated WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_drivers_update" ON drivers FOR UPDATE TO authenticated USING (auth_has_permission('employees.write')) WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_drivers_delete" ON drivers FOR DELETE TO authenticated USING (auth_has_permission('employees.write'));

-- --- EMPLOYEES ---
DO $$ BEGIN
  ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DROP POLICY IF EXISTS "Allow authenticated users to read employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated users to insert employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated users to update employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated users to delete employees" ON employees;
CREATE POLICY "rbac_employees_select" ON employees FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['employees.read','employees.write','passengers.read','routes.read','routes.write','reports.read','accounting.read']));
CREATE POLICY "rbac_employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_employees_update" ON employees FOR UPDATE TO authenticated USING (auth_has_permission('employees.write')) WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_employees_delete" ON employees FOR DELETE TO authenticated USING (auth_has_permission('employees.write'));

-- --- PASSENGER_ASSISTANTS ---
DO $$ BEGIN
  ALTER TABLE passenger_assistants ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DROP POLICY IF EXISTS "Allow authenticated users to read passenger_assistants" ON passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated users to insert passenger_assistants" ON passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated users to update passenger_assistants" ON passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated users to delete passenger_assistants" ON passenger_assistants;
CREATE POLICY "rbac_passenger_assistants_select" ON passenger_assistants FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['employees.read','employees.write','passengers.read','routes.read','routes.write','reports.read']));
CREATE POLICY "rbac_passenger_assistants_insert" ON passenger_assistants FOR INSERT TO authenticated WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_passenger_assistants_update" ON passenger_assistants FOR UPDATE TO authenticated USING (auth_has_permission('employees.write')) WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_passenger_assistants_delete" ON passenger_assistants FOR DELETE TO authenticated USING (auth_has_permission('employees.write'));

-- --- PASSENGERS ---
DO $$ BEGIN
  ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DROP POLICY IF EXISTS "Allow authenticated users to read passengers" ON passengers;
DROP POLICY IF EXISTS "Allow authenticated users to insert passengers" ON passengers;
DROP POLICY IF EXISTS "Allow authenticated users to update passengers" ON passengers;
DROP POLICY IF EXISTS "Allow authenticated users to delete passengers" ON passengers;
CREATE POLICY "rbac_passengers_select" ON passengers FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['passengers.read','passengers.write','reports.read','accounting.read']));
CREATE POLICY "rbac_passengers_insert" ON passengers FOR INSERT TO authenticated WITH CHECK (auth_has_permission('passengers.write'));
CREATE POLICY "rbac_passengers_update" ON passengers FOR UPDATE TO authenticated USING (auth_has_permission('passengers.write')) WITH CHECK (auth_has_permission('passengers.write'));
CREATE POLICY "rbac_passengers_delete" ON passengers FOR DELETE TO authenticated USING (auth_has_permission('passengers.write'));

-- --- ROUTES ---
DO $$ BEGIN
  ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DROP POLICY IF EXISTS "Allow authenticated users to read routes" ON routes;
DROP POLICY IF EXISTS "Allow authenticated users to insert routes" ON routes;
DROP POLICY IF EXISTS "Allow authenticated users to update routes" ON routes;
DROP POLICY IF EXISTS "Allow authenticated users to delete routes" ON routes;
CREATE POLICY "rbac_routes_select" ON routes FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['routes.read','routes.write','reports.read','accounting.read']));
CREATE POLICY "rbac_routes_insert" ON routes FOR INSERT TO authenticated WITH CHECK (auth_has_permission('routes.write'));
CREATE POLICY "rbac_routes_update" ON routes FOR UPDATE TO authenticated USING (auth_has_permission('routes.write')) WITH CHECK (auth_has_permission('routes.write'));
CREATE POLICY "rbac_routes_delete" ON routes FOR DELETE TO authenticated USING (auth_has_permission('routes.write'));

-- --- USERS (admin approval, role assignment) ---
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- Keep anon signup policy; replace admin update with RBAC
DROP POLICY IF EXISTS "Allow admins to update users" ON users;
CREATE POLICY "rbac_users_update" ON users FOR UPDATE TO authenticated
  USING (auth_has_permission('users.manage') OR auth_has_permission('roles.assign'))
  WITH CHECK (auth_has_permission('users.manage') OR auth_has_permission('roles.assign'));

DROP POLICY IF EXISTS "Allow authenticated users to read users" ON users;
CREATE POLICY "rbac_users_select" ON users FOR SELECT TO authenticated
  USING (auth_has_permission('users.manage') OR auth_has_permission('roles.assign') OR (LOWER(email) = LOWER(auth.jwt() ->> 'email')));

-- --- DOCUMENT_REQUIREMENTS ---
ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read document_requirements" ON document_requirements;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_requirements" ON document_requirements;
DROP POLICY IF EXISTS "Allow authenticated users to update document_requirements" ON document_requirements;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_requirements" ON document_requirements;
CREATE POLICY "rbac_document_requirements_select" ON document_requirements FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['document_requirements.write','employees.read','employees.write','vehicle_documents.read']));
CREATE POLICY "rbac_document_requirements_insert" ON document_requirements FOR INSERT TO authenticated WITH CHECK (auth_has_permission('document_requirements.write'));
CREATE POLICY "rbac_document_requirements_update" ON document_requirements FOR UPDATE TO authenticated USING (auth_has_permission('document_requirements.write')) WITH CHECK (auth_has_permission('document_requirements.write'));
CREATE POLICY "rbac_document_requirements_delete" ON document_requirements FOR DELETE TO authenticated USING (auth_has_permission('document_requirements.write'));

-- --- DOCUMENT LINK TABLES ---
ALTER TABLE document_driver_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pa_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_vehicle_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_subject_document_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read document_driver_links" ON document_driver_links;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_driver_links" ON document_driver_links;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_driver_links" ON document_driver_links;
CREATE POLICY "rbac_document_driver_links_select" ON document_driver_links FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_document_driver_links_insert" ON document_driver_links FOR INSERT TO authenticated WITH CHECK (auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_document_driver_links_delete" ON document_driver_links FOR DELETE TO authenticated USING (auth_has_permission('employee_documents.write'));

DROP POLICY IF EXISTS "Allow authenticated users to read document_pa_links" ON document_pa_links;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_pa_links" ON document_pa_links;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_pa_links" ON document_pa_links;
CREATE POLICY "rbac_document_pa_links_select" ON document_pa_links FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_document_pa_links_insert" ON document_pa_links FOR INSERT TO authenticated WITH CHECK (auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_document_pa_links_delete" ON document_pa_links FOR DELETE TO authenticated USING (auth_has_permission('employee_documents.write'));

DROP POLICY IF EXISTS "Allow authenticated users to read document_vehicle_links" ON document_vehicle_links;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_vehicle_links" ON document_vehicle_links;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_vehicle_links" ON document_vehicle_links;
CREATE POLICY "rbac_document_vehicle_links_select" ON document_vehicle_links FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicle_documents.read','vehicle_documents.write']));
CREATE POLICY "rbac_document_vehicle_links_insert" ON document_vehicle_links FOR INSERT TO authenticated WITH CHECK (auth_has_permission('vehicle_documents.write'));
CREATE POLICY "rbac_document_vehicle_links_delete" ON document_vehicle_links FOR DELETE TO authenticated USING (auth_has_permission('vehicle_documents.write'));

DROP POLICY IF EXISTS "Allow authenticated users to read document_subject_document_links" ON document_subject_document_links;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_subject_document_links" ON document_subject_document_links;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_subject_document_links" ON document_subject_document_links;
CREATE POLICY "rbac_document_subject_document_links_select" ON document_subject_document_links FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicle_documents.read','vehicle_documents.write','employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_document_subject_document_links_insert" ON document_subject_document_links FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write']));
CREATE POLICY "rbac_document_subject_document_links_delete" ON document_subject_document_links FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write']));

-- --- SUBJECT_DOCUMENTS ---
ALTER TABLE subject_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read subject_documents" ON subject_documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert subject_documents" ON subject_documents;
DROP POLICY IF EXISTS "Allow authenticated users to update subject_documents" ON subject_documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete subject_documents" ON subject_documents;
CREATE POLICY "rbac_subject_documents_select" ON subject_documents FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['vehicle_documents.read','employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_subject_documents_insert" ON subject_documents FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write']));
CREATE POLICY "rbac_subject_documents_update" ON subject_documents FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write'])) WITH CHECK (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write']));
CREATE POLICY "rbac_subject_documents_delete" ON subject_documents FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['vehicle_documents.write','employee_documents.write']));

-- --- NOTIFICATIONS ---
DO $$ BEGIN
  ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DROP POLICY IF EXISTS "Allow authenticated users to read notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to update notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to delete notifications" ON notifications;
CREATE POLICY "rbac_notifications_select" ON notifications FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['compliance.read','compliance.write','reports.read']));
CREATE POLICY "rbac_notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['compliance.read','compliance.write']));
CREATE POLICY "rbac_notifications_update" ON notifications FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['compliance.read','compliance.write'])) WITH CHECK (auth_has_any_permission(ARRAY['compliance.read','compliance.write']));
CREATE POLICY "rbac_notifications_delete" ON notifications FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['compliance.read','compliance.write']));

-- --- CERTIFICATES ---
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read certificates" ON certificates;
DROP POLICY IF EXISTS "Allow authenticated users to insert certificates" ON certificates;
DROP POLICY IF EXISTS "Allow authenticated users to update certificates" ON certificates;
DROP POLICY IF EXISTS "Allow authenticated users to delete certificates" ON certificates;
CREATE POLICY "rbac_certificates_select" ON certificates FOR SELECT TO authenticated
  USING (auth_has_any_permission(ARRAY['employee_documents.read','employee_documents.write','compliance.read']));
CREATE POLICY "rbac_certificates_insert" ON certificates FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['employee_documents.write']));
CREATE POLICY "rbac_certificates_update" ON certificates FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['employee_documents.write'])) WITH CHECK (auth_has_any_permission(ARRAY['employee_documents.write']));
CREATE POLICY "rbac_certificates_delete" ON certificates FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['employee_documents.write']));

-- --- COMPLIANCE_CASES ---
ALTER TABLE compliance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_case_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read compliance_cases" ON compliance_cases;
DROP POLICY IF EXISTS "Authenticated can insert compliance_cases" ON compliance_cases;
DROP POLICY IF EXISTS "Authenticated can update compliance_cases" ON compliance_cases;
DROP POLICY IF EXISTS "Authenticated can read compliance_case_updates" ON compliance_case_updates;
DROP POLICY IF EXISTS "Authenticated can insert compliance_case_updates" ON compliance_case_updates;
DROP POLICY IF EXISTS "Authenticated can update compliance_case_updates" ON compliance_case_updates;
CREATE POLICY "rbac_compliance_cases_select" ON compliance_cases FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['compliance.read','compliance.write']));
CREATE POLICY "rbac_compliance_cases_insert" ON compliance_cases FOR INSERT TO authenticated WITH CHECK (auth_has_permission('compliance.write'));
CREATE POLICY "rbac_compliance_cases_update" ON compliance_cases FOR UPDATE TO authenticated USING (auth_has_permission('compliance.write')) WITH CHECK (auth_has_permission('compliance.write'));
CREATE POLICY "rbac_compliance_case_updates_select" ON compliance_case_updates FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['compliance.read','compliance.write']));
CREATE POLICY "rbac_compliance_case_updates_insert" ON compliance_case_updates FOR INSERT TO authenticated WITH CHECK (auth_has_permission('compliance.write'));
CREATE POLICY "rbac_compliance_case_updates_update" ON compliance_case_updates FOR UPDATE TO authenticated USING (auth_has_permission('compliance.write')) WITH CHECK (auth_has_permission('compliance.write'));

-- --- ROUTE_SESSIONS, ROUTE_POINTS, etc. (operations) ---
DO $$ BEGIN
  ALTER TABLE route_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
DROP POLICY IF EXISTS "Allow authenticated to read route_sessions" ON route_sessions;
DROP POLICY IF EXISTS "Allow authenticated to insert route_sessions" ON route_sessions;
DROP POLICY IF EXISTS "Allow authenticated to update route_sessions" ON route_sessions;
DROP POLICY IF EXISTS "Allow authenticated to delete route_sessions" ON route_sessions;
CREATE POLICY "rbac_route_sessions_select" ON route_sessions FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write','reports.read']));
CREATE POLICY "rbac_route_sessions_insert" ON route_sessions FOR INSERT TO authenticated WITH CHECK (auth_has_permission('routes.write'));
CREATE POLICY "rbac_route_sessions_update" ON route_sessions FOR UPDATE TO authenticated USING (auth_has_permission('routes.write')) WITH CHECK (auth_has_permission('routes.write'));
CREATE POLICY "rbac_route_sessions_delete" ON route_sessions FOR DELETE TO authenticated USING (auth_has_permission('routes.write'));

-- --- REMAINING OPERATIONAL TABLES (route_updates, vehicle_breakdowns, etc.) ---
-- Use generic "operations" permission set: routes.write, vehicles.write, compliance.write, reports.read
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['route_updates','vehicle_breakdowns','route_session_seat_assignments','vehicle_seating_plans','seating_plan_seats','vehicle_pre_checks','driver_responses','vehicle_pre_check_driver_responses','tardiness_reports','driver_updates','field_audit_log','coordinator_school_assignments','route_passenger_assistants','parent_absence_reports','incident_party_entries','calendar_day_notes','call_logs','appointments','appointment_bookings','appointment_slots','schools','incidents','vehicle_updates'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE') THEN
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      END IF;
    EXCEPTION WHEN undefined_table THEN NULL;
    WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Drop and recreate policies for key operational tables (simplified - allow if has routes/vehicles/reports)
-- We use a catch-all: auth_has_any_permission for read/write operations
-- For brevity, create a generic policy pattern for tables that need "operations" access

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON route_updates;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON route_updates;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON route_updates;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON route_updates;
CREATE POLICY "rbac_route_updates_select" ON route_updates FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write','vehicles.read','vehicles.write','reports.read']));
CREATE POLICY "rbac_route_updates_insert" ON route_updates FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['routes.write','vehicles.write']));
CREATE POLICY "rbac_route_updates_update" ON route_updates FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write','vehicles.write'])) WITH CHECK (auth_has_any_permission(ARRAY['routes.write','vehicles.write']));
CREATE POLICY "rbac_route_updates_delete" ON route_updates FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write','vehicles.write']));

DROP POLICY IF EXISTS "Authenticated users can view breakdowns" ON vehicle_breakdowns;
DROP POLICY IF EXISTS "Authenticated users can manage breakdowns" ON vehicle_breakdowns;
CREATE POLICY "rbac_vehicle_breakdowns_select" ON vehicle_breakdowns FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write','vehicles.read','vehicles.write','reports.read']));
CREATE POLICY "rbac_vehicle_breakdowns_insert" ON vehicle_breakdowns FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['routes.write','vehicles.write']));
CREATE POLICY "rbac_vehicle_breakdowns_update" ON vehicle_breakdowns FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write','vehicles.write'])) WITH CHECK (auth_has_any_permission(ARRAY['routes.write','vehicles.write']));
CREATE POLICY "rbac_vehicle_breakdowns_delete" ON vehicle_breakdowns FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write','vehicles.write']));

DROP POLICY IF EXISTS "Authenticated users can view seat assignments" ON route_session_seat_assignments;
DROP POLICY IF EXISTS "Authenticated users can manage seat assignments" ON route_session_seat_assignments;
CREATE POLICY "rbac_seat_assignments_select" ON route_session_seat_assignments FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write','passengers.read','passengers.write']));
CREATE POLICY "rbac_seat_assignments_insert" ON route_session_seat_assignments FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['routes.write','passengers.write']));
CREATE POLICY "rbac_seat_assignments_update" ON route_session_seat_assignments FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write','passengers.write'])) WITH CHECK (auth_has_any_permission(ARRAY['routes.write','passengers.write']));
CREATE POLICY "rbac_seat_assignments_delete" ON route_session_seat_assignments FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write','passengers.write']));

DROP POLICY IF EXISTS "Authenticated users can view seating plans" ON vehicle_seating_plans;
DROP POLICY IF EXISTS "Authenticated users can manage seating plans" ON vehicle_seating_plans;
CREATE POLICY "rbac_seating_plans_select" ON vehicle_seating_plans FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['vehicles.read','vehicles.write']));
CREATE POLICY "rbac_seating_plans_insert" ON vehicle_seating_plans FOR INSERT TO authenticated WITH CHECK (auth_has_permission('vehicles.write'));
CREATE POLICY "rbac_seating_plans_update" ON vehicle_seating_plans FOR UPDATE TO authenticated USING (auth_has_permission('vehicles.write')) WITH CHECK (auth_has_permission('vehicles.write'));
CREATE POLICY "rbac_seating_plans_delete" ON vehicle_seating_plans FOR DELETE TO authenticated USING (auth_has_permission('vehicles.write'));

DROP POLICY IF EXISTS "Authenticated users can view seat details" ON seating_plan_seats;
DROP POLICY IF EXISTS "Authenticated users can manage seat details" ON seating_plan_seats;
CREATE POLICY "rbac_seating_seats_select" ON seating_plan_seats FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['vehicles.read','vehicles.write']));
CREATE POLICY "rbac_seating_seats_insert" ON seating_plan_seats FOR INSERT TO authenticated WITH CHECK (auth_has_permission('vehicles.write'));
CREATE POLICY "rbac_seating_seats_update" ON seating_plan_seats FOR UPDATE TO authenticated USING (auth_has_permission('vehicles.write')) WITH CHECK (auth_has_permission('vehicles.write'));
CREATE POLICY "rbac_seating_seats_delete" ON seating_plan_seats FOR DELETE TO authenticated USING (auth_has_permission('vehicles.write'));

DROP POLICY IF EXISTS "Allow authenticated users to read vehicle pre checks" ON vehicle_pre_checks;
DROP POLICY IF EXISTS "Allow authenticated users to insert vehicle pre checks" ON vehicle_pre_checks;
DROP POLICY IF EXISTS "Allow authenticated users to update vehicle pre checks" ON vehicle_pre_checks;
DROP POLICY IF EXISTS "Allow anonymous users to insert vehicle pre checks" ON vehicle_pre_checks;
CREATE POLICY "rbac_vehicle_pre_checks_select" ON vehicle_pre_checks FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write','vehicles.read','reports.read']));
CREATE POLICY "rbac_vehicle_pre_checks_insert" ON vehicle_pre_checks FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['routes.write','vehicles.write']));
CREATE POLICY "rbac_vehicle_pre_checks_insert_anon" ON vehicle_pre_checks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "rbac_vehicle_pre_checks_update" ON vehicle_pre_checks FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write','vehicles.write']));

DROP POLICY IF EXISTS "Allow authenticated read driver_responses" ON driver_responses;
DROP POLICY IF EXISTS "Allow authenticated insert driver_responses" ON driver_responses;
DROP POLICY IF EXISTS "Allow authenticated update driver_responses" ON driver_responses;
CREATE POLICY "rbac_driver_responses_select" ON driver_responses FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write','employees.read','reports.read']));
CREATE POLICY "rbac_driver_responses_insert" ON driver_responses FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['routes.write','employees.write']));
CREATE POLICY "rbac_driver_responses_update" ON driver_responses FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write','employees.write']));

DROP POLICY IF EXISTS "Allow authenticated read vpc_driver_responses" ON vehicle_pre_check_driver_responses;
DROP POLICY IF EXISTS "Allow authenticated insert vpc_driver_responses" ON vehicle_pre_check_driver_responses;
DROP POLICY IF EXISTS "Allow authenticated delete vpc_driver_responses" ON vehicle_pre_check_driver_responses;
CREATE POLICY "rbac_vpc_driver_responses_select" ON vehicle_pre_check_driver_responses FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write','reports.read']));
CREATE POLICY "rbac_vpc_driver_responses_insert" ON vehicle_pre_check_driver_responses FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['routes.write']));
CREATE POLICY "rbac_vpc_driver_responses_delete" ON vehicle_pre_check_driver_responses FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write']));

DROP POLICY IF EXISTS "Allow authenticated users to read tardiness reports" ON tardiness_reports;
DROP POLICY IF EXISTS "Allow authenticated users to insert tardiness reports" ON tardiness_reports;
DROP POLICY IF EXISTS "Allow authenticated users to update tardiness reports" ON tardiness_reports;
CREATE POLICY "rbac_tardiness_select" ON tardiness_reports FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['employees.read','employees.write','reports.read']));
CREATE POLICY "rbac_tardiness_insert" ON tardiness_reports FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['employees.write']));
CREATE POLICY "rbac_tardiness_update" ON tardiness_reports FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['employees.write']));

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON driver_updates;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON driver_updates;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON driver_updates;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON driver_updates;
CREATE POLICY "rbac_driver_updates_select" ON driver_updates FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['employees.read','employees.write']));
CREATE POLICY "rbac_driver_updates_insert" ON driver_updates FOR INSERT TO authenticated WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_driver_updates_update" ON driver_updates FOR UPDATE TO authenticated USING (auth_has_permission('employees.write'));
CREATE POLICY "rbac_driver_updates_delete" ON driver_updates FOR DELETE TO authenticated USING (auth_has_permission('employees.write'));

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON field_audit_log;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON field_audit_log;
CREATE POLICY "rbac_field_audit_select" ON field_audit_log FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['vehicles.read','vehicles.write','routes.read','routes.write','employees.read','employees.write']));
CREATE POLICY "rbac_field_audit_insert" ON field_audit_log FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to read coordinator school assignments" ON coordinator_school_assignments;
DROP POLICY IF EXISTS "Allow authenticated to insert coordinator school assignments" ON coordinator_school_assignments;
DROP POLICY IF EXISTS "Allow authenticated to update coordinator school assignments" ON coordinator_school_assignments;
DROP POLICY IF EXISTS "Allow authenticated to delete coordinator school assignments" ON coordinator_school_assignments;
CREATE POLICY "rbac_coordinator_assignments_select" ON coordinator_school_assignments FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['employees.read','employees.write','routes.read','routes.write']));
CREATE POLICY "rbac_coordinator_assignments_insert" ON coordinator_school_assignments FOR INSERT TO authenticated WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_coordinator_assignments_update" ON coordinator_school_assignments FOR UPDATE TO authenticated USING (auth_has_permission('employees.write')) WITH CHECK (auth_has_permission('employees.write'));
CREATE POLICY "rbac_coordinator_assignments_delete" ON coordinator_school_assignments FOR DELETE TO authenticated USING (auth_has_permission('employees.write'));

DROP POLICY IF EXISTS "Allow authenticated to read route passenger assistants" ON route_passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated to insert route passenger assistants" ON route_passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated to update route passenger assistants" ON route_passenger_assistants;
DROP POLICY IF EXISTS "Allow authenticated to delete route passenger assistants" ON route_passenger_assistants;
CREATE POLICY "rbac_rpa_select" ON route_passenger_assistants FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write']));
CREATE POLICY "rbac_rpa_insert" ON route_passenger_assistants FOR INSERT TO authenticated WITH CHECK (auth_has_permission('routes.write'));
CREATE POLICY "rbac_rpa_update" ON route_passenger_assistants FOR UPDATE TO authenticated USING (auth_has_permission('routes.write')) WITH CHECK (auth_has_permission('routes.write'));
CREATE POLICY "rbac_rpa_delete" ON route_passenger_assistants FOR DELETE TO authenticated USING (auth_has_permission('routes.write'));

DROP POLICY IF EXISTS "Allow authenticated users to read parent absence reports" ON parent_absence_reports;
DROP POLICY IF EXISTS "Allow authenticated users to insert parent absence reports" ON parent_absence_reports;
DROP POLICY IF EXISTS "Allow authenticated users to update parent absence reports" ON parent_absence_reports;
DROP POLICY IF EXISTS "Allow authenticated users to delete parent absence reports" ON parent_absence_reports;
CREATE POLICY "rbac_parent_absence_select" ON parent_absence_reports FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['passengers.read','passengers.write','reports.read']));
CREATE POLICY "rbac_parent_absence_insert" ON parent_absence_reports FOR INSERT TO authenticated WITH CHECK (auth_has_permission('passengers.write'));
CREATE POLICY "rbac_parent_absence_update" ON parent_absence_reports FOR UPDATE TO authenticated USING (auth_has_permission('passengers.write')) WITH CHECK (auth_has_permission('passengers.write'));
CREATE POLICY "rbac_parent_absence_delete" ON parent_absence_reports FOR DELETE TO authenticated USING (auth_has_permission('passengers.write'));

DROP POLICY IF EXISTS "Authenticated can read incident party entries" ON incident_party_entries;
DROP POLICY IF EXISTS "Authenticated can insert incident party entries" ON incident_party_entries;
DROP POLICY IF EXISTS "Authenticated can update incident party entries" ON incident_party_entries;
DROP POLICY IF EXISTS "Authenticated can delete incident party entries" ON incident_party_entries;
CREATE POLICY "rbac_incident_party_select" ON incident_party_entries FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['routes.read','routes.write','reports.read']));
CREATE POLICY "rbac_incident_party_insert" ON incident_party_entries FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['routes.write']));
CREATE POLICY "rbac_incident_party_update" ON incident_party_entries FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write'])) WITH CHECK (auth_has_any_permission(ARRAY['routes.write']));
CREATE POLICY "rbac_incident_party_delete" ON incident_party_entries FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['routes.write']));

-- calendar_day_notes: broad read for reports; write for self or admin
DROP POLICY IF EXISTS "Authenticated can read calendar_day_notes" ON calendar_day_notes;
DROP POLICY IF EXISTS "Authenticated can insert calendar_day_notes" ON calendar_day_notes;
DROP POLICY IF EXISTS "Authenticated can update calendar_day_notes" ON calendar_day_notes;
DROP POLICY IF EXISTS "Authenticated can delete calendar_day_notes" ON calendar_day_notes;
CREATE POLICY "rbac_calendar_notes_select" ON calendar_day_notes FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['reports.read','compliance.read']));
CREATE POLICY "rbac_calendar_notes_insert" ON calendar_day_notes FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['reports.read']));
CREATE POLICY "rbac_calendar_notes_update" ON calendar_day_notes FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['reports.read']));
CREATE POLICY "rbac_calendar_notes_delete" ON calendar_day_notes FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY['reports.read']));

-- calendar_day_note_views: own records only
DROP POLICY IF EXISTS "Authenticated can read own calendar_day_note_views" ON calendar_day_note_views;
DROP POLICY IF EXISTS "Authenticated can insert own calendar_day_note_views" ON calendar_day_note_views;
DROP POLICY IF EXISTS "Authenticated can delete own calendar_day_note_views" ON calendar_day_note_views;
CREATE POLICY "rbac_calendar_views_select" ON calendar_day_note_views FOR SELECT TO authenticated USING (user_id = (SELECT u.id FROM users u WHERE LOWER(u.email) = LOWER(auth.jwt() ->> 'email') LIMIT 1));
CREATE POLICY "rbac_calendar_views_insert" ON calendar_day_note_views FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT u.id FROM users u WHERE LOWER(u.email) = LOWER(auth.jwt() ->> 'email') LIMIT 1));
CREATE POLICY "rbac_calendar_views_delete" ON calendar_day_note_views FOR DELETE TO authenticated USING (user_id = (SELECT u.id FROM users u WHERE LOWER(u.email) = LOWER(auth.jwt() ->> 'email') LIMIT 1));

-- daily_route_summaries (view - skip), call_logs, schools, incidents, appointments, vehicle_updates
DO $$
DECLARE
  r_tables RECORD;
BEGIN
  FOR r_tables IN
    SELECT unnest(ARRAY['call_logs','schools','incidents','appointment_bookings','appointment_slots']) AS t
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated users to read %s" ON %I', r_tables.t, r_tables.t);
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = r_tables.t AND table_type = 'BASE TABLE') THEN
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r_tables.t);
      END IF;
    EXCEPTION WHEN undefined_table THEN NULL;
    WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Add RBAC policies for remaining tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_route_summaries' AND table_type = 'BASE TABLE') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated to read daily_route_summaries" ON daily_route_summaries';
    EXECUTE 'CREATE POLICY "rbac_daily_summaries_select" ON daily_route_summaries FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY[''reports.read'']))';
    EXECUTE 'CREATE POLICY "rbac_daily_summaries_insert" ON daily_route_summaries FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY[''reports.read'']))';
    EXECUTE 'CREATE POLICY "rbac_daily_summaries_update" ON daily_route_summaries FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY[''reports.read'']))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='call_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated to read call_logs" ON call_logs';
    EXECUTE 'CREATE POLICY "rbac_call_logs_select" ON call_logs FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY[''passengers.read'',''passengers.write'',''employees.read'',''reports.read'']))';
    EXECUTE 'CREATE POLICY "rbac_call_logs_insert" ON call_logs FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY[''passengers.write'']))';
    EXECUTE 'CREATE POLICY "rbac_call_logs_update" ON call_logs FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY[''passengers.write'']))';
    EXECUTE 'CREATE POLICY "rbac_call_logs_delete" ON call_logs FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY[''passengers.write'']))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schools') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated to read schools" ON schools';
    EXECUTE 'CREATE POLICY "rbac_schools_select" ON schools FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY[''routes.read'',''routes.write'',''passengers.read'']))';
    EXECUTE 'CREATE POLICY "rbac_schools_insert" ON schools FOR INSERT TO authenticated WITH CHECK (auth_has_permission(''routes.write''))';
    EXECUTE 'CREATE POLICY "rbac_schools_update" ON schools FOR UPDATE TO authenticated USING (auth_has_permission(''routes.write''))';
    EXECUTE 'CREATE POLICY "rbac_schools_delete" ON schools FOR DELETE TO authenticated USING (auth_has_permission(''routes.write''))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='incidents') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated to read incidents" ON incidents';
    EXECUTE 'CREATE POLICY "rbac_incidents_select" ON incidents FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY[''routes.read'',''routes.write'',''reports.read'']))';
    EXECUTE 'CREATE POLICY "rbac_incidents_insert" ON incidents FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY[''routes.write'']))';
    EXECUTE 'CREATE POLICY "rbac_incidents_update" ON incidents FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY[''routes.write'']))';
    EXECUTE 'CREATE POLICY "rbac_incidents_delete" ON incidents FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY[''routes.write'']))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='appointment_bookings') THEN
    EXECUTE 'CREATE POLICY "rbac_appointment_bookings_select" ON appointment_bookings FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY[''passengers.read'',''passengers.write'',''routes.read'']))';
    EXECUTE 'CREATE POLICY "rbac_appointment_bookings_insert" ON appointment_bookings FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY[''passengers.write'']))';
    EXECUTE 'CREATE POLICY "rbac_appointment_bookings_update" ON appointment_bookings FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY[''passengers.write'']))';
    EXECUTE 'CREATE POLICY "rbac_appointment_bookings_delete" ON appointment_bookings FOR DELETE TO authenticated USING (auth_has_any_permission(ARRAY[''passengers.write'']))';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='appointment_slots') THEN
    EXECUTE 'CREATE POLICY "rbac_appointment_slots_select" ON appointment_slots FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY[''passengers.read'',''passengers.write'']))';
    EXECUTE 'CREATE POLICY "rbac_appointment_slots_insert" ON appointment_slots FOR INSERT TO authenticated WITH CHECK (auth_has_permission(''passengers.write''))';
    EXECUTE 'CREATE POLICY "rbac_appointment_slots_update" ON appointment_slots FOR UPDATE TO authenticated USING (auth_has_permission(''passengers.write''))';
    EXECUTE 'CREATE POLICY "rbac_appointment_slots_delete" ON appointment_slots FOR DELETE TO authenticated USING (auth_has_permission(''passengers.write''))';
  END IF;
END $$;

-- vehicle_updates: keep QR token policy; add RBAC for authenticated
DROP POLICY IF EXISTS "Allow authenticated users to read vehicle_updates" ON vehicle_updates;
DROP POLICY IF EXISTS "Allow authenticated users to insert vehicle_updates" ON vehicle_updates;
DROP POLICY IF EXISTS "Allow authenticated users to update vehicle_updates" ON vehicle_updates;
CREATE POLICY "rbac_vehicle_updates_select" ON vehicle_updates FOR SELECT TO authenticated USING (auth_has_any_permission(ARRAY['vehicles.read','vehicles.write','routes.read','routes.write','reports.read']));
CREATE POLICY "rbac_vehicle_updates_insert" ON vehicle_updates FOR INSERT TO authenticated WITH CHECK (auth_has_any_permission(ARRAY['vehicles.write','routes.write']));
CREATE POLICY "rbac_vehicle_updates_update" ON vehicle_updates FOR UPDATE TO authenticated USING (auth_has_any_permission(ARRAY['vehicles.write','routes.write']));

-- =====================================================
-- 9. RPC: get_my_permissions
-- =====================================================

CREATE OR REPLACE FUNCTION get_my_permissions()
RETURNS TABLE(permission_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.key
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
    AND ur.active = true
  UNION
  SELECT p.key
  FROM permissions p
  WHERE auth_is_super_admin();
$$;

COMMENT ON FUNCTION get_my_permissions IS 'Returns permission keys for the current user (for frontend route guards)';

-- =====================================================
-- 10. STORAGE POLICIES (RBAC-based)
-- =====================================================
-- Replaces permissive "authenticated" policies with permission checks.
-- Keeps QR token policies (088) and public read where needed.
-- =====================================================

-- VEHICLE_DOCUMENTS: read/write by permission (QR token policies from 088 remain)
DROP POLICY IF EXISTS "Allow authenticated uploads to VEHICLE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from VEHICLE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to VEHICLE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from VEHICLE_DOCUMENTS" ON storage.objects;
CREATE POLICY "rbac_storage_vehicle_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'VEHICLE_DOCUMENTS' AND auth_has_any_permission(ARRAY['vehicle_documents.read','vehicle_documents.write']));
CREATE POLICY "rbac_storage_vehicle_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'VEHICLE_DOCUMENTS' AND auth_has_permission('vehicle_documents.write'));
CREATE POLICY "rbac_storage_vehicle_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'VEHICLE_DOCUMENTS' AND auth_has_permission('vehicle_documents.write'))
  WITH CHECK (bucket_id = 'VEHICLE_DOCUMENTS' AND auth_has_permission('vehicle_documents.write'));
CREATE POLICY "rbac_storage_vehicle_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'VEHICLE_DOCUMENTS' AND auth_has_permission('vehicle_documents.write'));

-- EMPLOYEE_DOCUMENTS: read/write by permission
DROP POLICY IF EXISTS "Allow authenticated uploads to EMPLOYEE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from EMPLOYEE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to EMPLOYEE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from EMPLOYEE_DOCUMENTS" ON storage.objects;
CREATE POLICY "rbac_storage_employee_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'EMPLOYEE_DOCUMENTS' AND auth_has_any_permission(ARRAY['employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_storage_employee_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'EMPLOYEE_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_storage_employee_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'EMPLOYEE_DOCUMENTS' AND auth_has_permission('employee_documents.write'))
  WITH CHECK (bucket_id = 'EMPLOYEE_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_storage_employee_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'EMPLOYEE_DOCUMENTS' AND auth_has_permission('employee_documents.write'));

-- DRIVER_DOCUMENTS: read/write by permission (keep public read for viewing via URL)
DROP POLICY IF EXISTS "Allow authenticated uploads to DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to DRIVER_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from DRIVER_DOCUMENTS" ON storage.objects;
CREATE POLICY "rbac_storage_driver_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'DRIVER_DOCUMENTS' AND auth_has_any_permission(ARRAY['employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_storage_driver_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'DRIVER_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_storage_driver_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'DRIVER_DOCUMENTS' AND auth_has_permission('employee_documents.write'))
  WITH CHECK (bucket_id = 'DRIVER_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_storage_driver_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'DRIVER_DOCUMENTS' AND auth_has_permission('employee_documents.write'));

-- PA_DOCUMENTS: read/write by permission
DROP POLICY IF EXISTS "Allow authenticated uploads to PA_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from PA_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to PA_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from PA_DOCUMENTS" ON storage.objects;
CREATE POLICY "rbac_storage_pa_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'PA_DOCUMENTS' AND auth_has_any_permission(ARRAY['employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_storage_pa_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'PA_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_storage_pa_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'PA_DOCUMENTS' AND auth_has_permission('employee_documents.write'))
  WITH CHECK (bucket_id = 'PA_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_storage_pa_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'PA_DOCUMENTS' AND auth_has_permission('employee_documents.write'));

-- ROUTE_DOCUMENTS: used for assistant/PA badge photos; employee_documents permission
DROP POLICY IF EXISTS "Allow authenticated uploads to ROUTE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from ROUTE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to ROUTE_DOCUMENTS" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from ROUTE_DOCUMENTS" ON storage.objects;
CREATE POLICY "rbac_storage_route_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ROUTE_DOCUMENTS' AND auth_has_any_permission(ARRAY['employee_documents.read','employee_documents.write']));
CREATE POLICY "rbac_storage_route_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ROUTE_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_storage_route_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ROUTE_DOCUMENTS' AND auth_has_permission('employee_documents.write'))
  WITH CHECK (bucket_id = 'ROUTE_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
CREATE POLICY "rbac_storage_route_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ROUTE_DOCUMENTS' AND auth_has_permission('employee_documents.write'));
