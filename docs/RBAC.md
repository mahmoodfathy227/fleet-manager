# RBAC (Role-Based Access Control) - County Cars Dashboard

## Overview

RBAC is enforced at the **database level** via Supabase RLS. The frontend uses permissions for route guards and nav visibility, but RLS is the source of truth.

## Adding a New Permission

1. **Insert into `permissions` table:**
   ```sql
   INSERT INTO permissions (key, description) VALUES
   ('new_feature.read', 'View new feature');
   ```

2. **Assign to roles via `role_permissions`:**
   ```sql
   INSERT INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r, permissions p
   WHERE r.name = 'Operations Administrator' AND p.key = 'new_feature.read'
   ON CONFLICT (role_id, permission_id) DO NOTHING;
   ```

3. **Add RLS policy** on the relevant table(s):
   ```sql
   CREATE POLICY "rbac_new_feature_select" ON new_feature_table FOR SELECT TO authenticated
     USING (auth_has_permission('new_feature.read'));
   ```

4. **Update frontend** `lib/permissions.ts`:
   ```ts
   '/dashboard/new-feature': 'new_feature.read',
   ```

## Adding a New Role

1. **Insert into `roles` table:**
   ```sql
   INSERT INTO roles (name, description, is_system) VALUES
   ('Custom Role', 'Description', false);
   ```

2. **Assign permissions** via `role_permissions` (see above).

3. **Assign role to users** via `user_roles` (Super Admin only):
   ```sql
   INSERT INTO user_roles (user_id, role_id, active)
   VALUES ('auth-user-uuid', (SELECT id FROM roles WHERE name = 'Custom Role'), true);
   ```

## Preset Roles

| Role | Key Permissions |
|------|-----------------|
| Fleet Access | vehicles.*, vehicle_documents.*, vehicle_compliance.write, reports.read |
| HR & Employee Compliance | employees.*, employee_documents.*, compliance.* |
| View-Only Access | *.read on fleet, passengers, employees, compliance, accounting |
| Accounting & Finance | accounting.*, vehicles.read, employees.read, passengers.read |
| Operations Administrator | Full fleet, employees, passengers, routes, compliance; no accounting, no roles.assign |
| Full System Administrator | All permissions including roles.assign, permissions.manage |

## Helper Functions

- `auth_is_super_admin()` – true if user has Full System Administrator role
- `auth_has_permission(key)` – true if super admin or has that permission
- `auth_has_any_permission(keys[])` – true if super admin or has any of the keys

## RPC

- `get_my_permissions()` – returns `permission_key` for current user (for frontend)

## Security Notes

- Default deny: no policy = no access
- Super Admin bypasses all permission checks
- `auth_has_permission` / `auth_has_any_permission` use `SECURITY DEFINER` with `search_path = public`
- Storage policies use the same helpers for vehicle-docs, employee-docs, driver-docs, pa-docs, route-docs
