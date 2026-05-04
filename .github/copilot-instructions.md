# GitHub Copilot Instructions

> 📋 **Full architecture audit (tables, security, buckets, people model):** [`docs/ARCHITECTURE_AUDIT.md`](../docs/ARCHITECTURE_AUDIT.md) — read before proposing any structural change.

---

## Architecture Principles (Audited 23 April 2026)

These rules exist because of proven recurring mistakes. Do not skip them.

### Rule: Never duplicate compliance data in legacy columns

The `drivers` and `passenger_assistants` tables contain individual date/boolean columns for certificates (DBS, TAS, first aid, etc.). These are **legacy duplicates**. The single source of truth is `subject_documents`.

- **Never write to** `drivers.dbs_expiry_date`, `drivers.tas_badge_expiry_date`, `drivers.first_aid_certificate_expiry_date`, or any other legacy compliance column unless explicitly asked to sync them.
- **Always read compliance status** from `subject_documents` + `document_requirements`.
- `employees.can_work` is recomputed from `subject_documents` — it is NOT driven by any column in `drivers`.

### Rule: Enable RLS before adding any new table

The following tables currently have **NO RLS** and expose sensitive data to any client with the anon key. Do not add new tables without RLS.

Tables missing RLS (as of 23 April 2026): `employees`, `parent_contacts`, `passenger_parent_contacts`, `sms_verification_otps`, `next_of_kin`, `route_points`, `samsara_telemetry`, `vehicle_configurations`, `admin_notifications`, `parent_data`

Before writing ANY feature that touches these tables, note: their data is currently fully exposed. Any fix to these tables MUST include a RLS migration.

### Rule: Do not reference dead/empty tables

The following tables have 0 rows and are considered dead. Do NOT write code that reads from or writes to them:

`admin_notifications`, `certificate_types`, `certificates`, `driver_responses`, `driver_updates`, `incident_party_entries`, `next_of_kin`, `push_notifications`, `push_notification_recipients`, `route_session_seat_assignments`, `route_stop_events`, `samsara_logs`, `samsara_mapping_audit_log`, `samsara_sync_logs`, `samsara_vehicle_unmatched`, `seating_plan_seats`, `user_push_tokens`, `vehicle_assignments`, `vehicle_compliance_spare_assignments`, `vehicle_configurations`, `vehicle_pre_check_driver_responses`, `vehicle_telematics_latest`

Exception: `push_notifications` and `push_notification_recipients` will be activated when Firebase phase begins — document in code if touching them.

### Rule: Never add NOT NULL without resolving existing NULLs first

```sql
-- Wrong: will fail if any existing row has NULL
ALTER TABLE drivers ALTER COLUMN some_col SET NOT NULL;

-- Right: resolve NULLs in same migration, then add constraint
UPDATE drivers SET some_col = 'default' WHERE some_col IS NULL;
ALTER TABLE drivers ALTER COLUMN some_col SET NOT NULL;
```

### Rule: Storage buckets — no new public buckets for personal data

Current bucket problems (audited 23 April 2026):
- `VEHICLE_DOCUMENTS` (701 files), `DRIVER_DOCUMENTS` (139 files), `EMPLOYEE_DOCUMENTS` (12 files), `employee_personal_photos`, `employees_applications` — all **PUBLIC** with no mime/size limits on some.
- **Do NOT** upload personal data, compliance docs, or sensitive files to any public bucket.
- **Do NOT** create new public buckets without explicit approval.
- For file access auth: use **private buckets + RLS storage policies + short-lived signed URLs** generated server-side. Never use long-TTL or hardcoded public URLs for sensitive files.

### Rule: `public` schema ≠ publicly accessible

All 93 custom tables live in `public` schema. This is normal. The problem is missing RLS, not the schema name. Do not confuse the two.

### Rule: Do not use the `parent_data` table

`parent_data` (3 rows) is a legacy dead table with a `phone_number numeric` column (wrong type). Use `parent_contacts` (1,170 rows) — the active table.

### Rule: `employees` column `full_name` is the source of truth for all staff names

`drivers.full_name` and `drivers.email` and `drivers.phone` exist but are legacy duplicates (only 2/17 rows populated). Use `employees.full_name`, `employees.personal_email`, `employees.phone_number`.

---

## Pre-Implementation Checklist

Before writing, editing, or deleting **any** line of code in this codebase:

1. **Verify the Supabase table schema** — confirm every column referenced in a query or insert actually exists in the live database (`information_schema.columns`). Never assume a migration has been applied.
2. **Verify API endpoints** — confirm the route handler exists and accepts the expected method/params before calling it from the frontend.
3. **Check RLS policies** — confirm the authenticated user's permissions allow the intended operation (SELECT / INSERT / UPDATE / DELETE) on the affected table.
4. **Check storage buckets** — if a file upload is involved, confirm the target bucket exists and is accessible.

> Skipping these checks is the primary cause of runtime errors in this project (e.g. `PGRST204 column not found`, `400 Bad Request`, `Bucket not found`).

### Before writing any migration or schema change

Before proposing an `ALTER TABLE`, `CREATE TABLE`, `DROP`, or any DDL statement:

1. **Query the live DB via MCP** — use `mcp_supabase_execute_sql` to check what already exists in `information_schema.columns`, `information_schema.tables`, or `pg_proc`. The migration files in `supabase/migrations/` may not reflect production — cross-check against the live schema.
2. **Scan existing migrations** — search `supabase/migrations/` for any prior migration that already applies the same change (e.g. a DROP NOT NULL, an added column, a renamed function). If it was already applied, do NOT write it again.
3. **Check for conflicts** — if a migration adds a column that already exists, or drops a constraint that is already gone, it will fail when applied. Confirm first.

> The `notifications` table is a known example: 6 legacy columns were declared NOT NULL in early migrations, then made nullable in a later one. The live DB is nullable. Any tool or agent that reads only the CREATE TABLE migration will see a false NOT NULL and suggest an unnecessary fix.

---

## Pre-Commit Checklist

> ⛔ **NEVER stage, commit, or push code unless the user has explicitly tested the change and explicitly asked you to commit.** Do not suggest a commit message, do not run `git add`, do not run `git commit`, do not run `git push` — until the user says so. Finishing implementation is not a trigger to commit. A passing build is not a trigger to commit. Only an explicit instruction from the user is.

**Before committing and pushing any code change, you MUST run a production build and verify it succeeds with zero errors.**

```bash
npm run build
```

- If the build fails, fix all errors before committing. **Never commit broken code.**
- A missing import, a wrong type, or a deleted export will cause a 5xx error on the live dashboard for all users — the same as a runtime crash.
- TypeScript errors that are suppressed in dev mode are **fatal** in `next build`. Do not assume `tsc` passing locally means the build will pass.
- After build succeeds, stage and commit. Only then push.

> A broken import was pushed previously and caused a full dashboard 5xx outage. This rule exists to prevent that.

### Backend Architecture — Where Logic Lives

Every feature that must be accessible outside the dashboard (mobile app, Postman, third-party) **must be implemented in Supabase**, not in Next.js API routes.

| Layer | Use when |
|-------|----------|
| **PostgREST direct** (`/rest/v1/table`) | Simple CRUD where RLS alone is sufficient |
| **RPC** (`/rest/v1/rpc/fn`) | Business logic that lives entirely in the DB — atomic multi-table writes, validation against DB state, computed reads, SECURITY DEFINER operations. No external calls. |
| **Edge Function** (`/functions/v1/name`) | Business logic that must leave the DB — external HTTP calls (Firebase, Samsara, email), webhook receivers, Deno/Node runtime required |
| **Next.js `/api/` routes** | Dashboard-only orchestration (calling Supabase from server-side for the web UI). **Never** the source of truth for a feature — mobile cannot use cookie-based auth. |

> **Rule:** If a feature can be triggered from outside the dashboard (mobile app, cron, webhook), its backend logic must live in an RPC or Edge Function — not in a Next.js route.

---

### Supabase MCP — Read-Only

The Supabase MCP tool is connected in **read-only mode**. This means:

- `mcp_supabase_execute_sql` can only run `SELECT` queries — do **not** attempt `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, or any other write operation through it.
- All schema changes (migrations, function definitions, RLS policies, cron jobs) must be written as a `.sql` migration file in `supabase/migrations/` and applied **manually** by the developer via the Supabase dashboard SQL editor or the Supabase CLI.
- Always save the SQL to a migration file first, then instruct the developer to run it — never try to apply it directly via MCP.

### MCP Setup for Team Members

The MCP configuration lives in `.vscode/mcp.json` (committed to git). It uses `npx @supabase/mcp-server-supabase` so it works on **any OS** (macOS, Linux, Windows) — the only prerequisite is Node.js.

**First-time setup for each developer:**

1. Go to https://supabase.com/dashboard/account/tokens and generate a Personal Access Token.
2. Open the workspace in VS Code. The MCP server will auto-start and prompt you for the token.
3. Paste your token when prompted. VS Code remembers it per session.

**Important:**
- The project ref (`ilpfknjpfmgvzjafqtls`) is hardcoded in `.vscode/mcp.json` — this is intentional and not secret.
- The access token is **personal** and **never** stored in git — it's prompted via `${input:...}`.
- If you also have a **user-level** Supabase MCP server defined in your global VS Code settings (`~/Library/Application Support/Code/User/.../mcp.json` or equivalent), **disable or remove it** to avoid conflicts with the workspace-level config. The workspace config takes priority but having both can cause duplicate server instances.
- If the MCP server fails to start, check that `npx` is available in your PATH and that your token is valid.

---

## Date Formatting

All dates displayed to users **must** use the format `21 March 2025` (day-month-year, full month name, no ordinal suffix).

### Use the centralised utility functions from `@/lib/utils`

| Need | Function | Output example |
|------|----------|----------------|
| Date only | `formatDate(value)` | `21 March 2025` |
| Date + time | `formatDateTime(value)` | `21 March 2025, 14:30` |
| HTML `<input type="date">` value | `formatDateForInput(value)` | `2025-03-21` (internal only) |
| HTML `<input type="datetime-local">` value | `formatDateTimeForInput(value)` | `2025-03-21T14:30` (internal only) |

### Rules

- **Always** import `formatDate` or `formatDateTime` from `@/lib/utils` for any user-visible date.
- **Never** use `.toLocaleDateString()` or `.toLocaleString()` without explicit locale and options.
- **Never** use `'en-US'` locale for displayed dates.
- **Never** use `month: 'short'` (e.g. `Mar`) for displayed dates — use `month: 'long'` (e.g. `March`).
- **Never** define a local `formatDate` or `formatDateTime` function inside a component — always use the shared utility.
- date-fns `format()` patterns must use `'d MMMM yyyy'` (not `'d MMM yyyy'`) for displayed dates.
- `YYYY-MM-DD` strings (e.g. from `toISOString().split('T')[0]`) are acceptable for **database writes and input values only** — never render them directly to the user.

### Exceptions

- TR5 / TR6 / TR7 official incident report form fields use `dd/MM/yyyy` as required by the form template — do not change these.

---

## Codebase Health Warning

This project was built incrementally without a consistent review process. Before implementing **any** feature, treat the existing codebase as **potentially unreliable**:

- Database schema may not match the local migration files — always query `information_schema.columns` first
- API routes may exist but accept wrong parameters, return wrong shapes, or have no RLS backing
- UI components may reference columns, tables, or RPCs that don't exist in production
- Multiple competing implementations may exist for the same feature (e.g. two auth systems, two compliance document systems, duplicate notification tables)

---

## External API References

| Service | Reference |
|---------|----------|
| **Samsara API** | [Samsara Public Postman Workspace](https://www.postman.com/samsara-api/samsara-api-s-public-workspace/documentation/eso9w2v/samsara-api?sideView=agentMode) — use this as the authoritative reference for all Samsara endpoint shapes, query params, and response schemas before writing any Samsara integration code. |

---

## Known Technical Debt (updated as reviewed)

### Notifications System (reviewed 31 March 2026)

Four notification-related tables exist. Three are effectively dead:

| Table | Status | Issue |
|-------|--------|-------|
| `notifications` | ✅ Active — dashboard reads this | 6 legacy compliance-specific columns (`certificate_type`, `certificate_name`, `expiry_date`, `days_until_expiry`, `entity_type`, `entity_id`) are all **already nullable in production** (confirmed 7 April 2026). |
| `admin_notifications` | ❌ Dead — 0 rows ever written, nothing reads it | Better designed (has `message` text, `read_at`, `read_by`) but orphaned. Do NOT use it; do NOT migrate to it without a full plan. |
| `push_notifications` | ❌ Dead — 0 rows, Firebase infra never activated | Firebase delivery tables. Ignore until Firebase phase begins. |
| `push_notification_recipients` | ❌ Dead — 0 rows | Same as above. |

**Rule:** All new notification types MUST insert into `notifications` only. Use the `details JSONB` column for type-specific payload. Do NOT stuff values into compliance-specific columns (`certificate_type`, `certificate_name`, `expiry_date`, `days_until_expiry`, `entity_type`, `entity_id`).

### Active notification types (April 2026)

| `notification_type` | Inserted by | `recipient_user_id` | Visible to |
|---|---|---|---|
| `certificate_expiry` | `create_certificate_notifications()` RPC (legacy) | NULL | Admins (RBAC) via old compliance columns |
| `vehicle_breakdown` | `report_vehicle_breakdown` RPC | NULL | Admins (RBAC) |
| `driver_tardiness` | `/api/tardiness` Next.js route | NULL | Admins (RBAC) |
| `trip_cancellation` | `cancel-trip` Edge Function | Parent's auth UUID | Parent + Admins |
| `trip_restored` | `restore-trip` Edge Function | Parent's auth UUID | Parent + Admins |
| `cert_expiry_reminder` | `create_cert_expiry_reminders()` RPC (migration 173) | Employee auth UUID (driver/PA) or NULL (vehicle) | Employee sees own; Admins see all via RBAC |
| `driver_at_stop` | `trg_notify_parent_on_stop_event` DB trigger (migration 175) | Parent's auth UUID | Parent |
| `child_picked_up` | `trg_notify_parent_on_stop_event` DB trigger (migration 175) | Parent's auth UUID | Parent |
| `child_dropped_off` | `trg_notify_parent_on_stop_event` DB trigger (migration 175) | Parent's auth UUID | Parent |
| `child_no_show` | `trg_notify_parent_on_stop_event` DB trigger (migration 175) | Parent's auth UUID | Parent |
| `trip_started` | `trg_notify_parents_on_session_change` DB trigger (migration 175) | Parent's auth UUID | Parent |
| `trip_completed` | `trg_notify_parents_on_session_change` DB trigger (migration 175) | Parent's auth UUID | Parent |
| `child_not_on_trip` | `trg_notify_parents_on_session_change` DB trigger (migration 175) | Parent's auth UUID | Parent |
| `new_agreement` | `POST /api/agreements` Next.js route (migration 178) | Parent / Driver / PA auth UUID | App user (parent, driver, or PA) |
| `admin_broadcast` | `send_admin_broadcast` RPC (migrations 179 + 180) | Each targeted user's auth UUID | App user (recipient) + Admins |

> ⚠️ **Push notification relay rule:** Whenever a new `notification_type` is added that has a non-null `recipient_user_id`, you MUST add a corresponding `case` to the `buildMessage()` function in `supabase/functions/push-notification-relay/index.ts`. Without this, the push will be silently skipped (`default: return null`). After editing, redeploy: `supabase functions deploy push-notification-relay --no-verify-jwt --project-ref ilpfknjpfmgvzjafqtls`

> 📄 **Full relay pipeline documentation** (architecture, Firestore schema, FCM payload, Flutter integration, deployment commands): [`docs/PUSH_NOTIFICATION_RELAY.md`](../docs/PUSH_NOTIFICATION_RELAY.md)

> 📄 **All notification types reference** (what each type means, producer, `details` JSONB shape, push template): [`docs/NOTIFICATION_TYPES.md`](../docs/NOTIFICATION_TYPES.md)

**`cert_expiry_reminder` details JSONB shape:**
```json
{
  "entity_type": "vehicle|driver|assistant|employee",
  "entity_id": 42,
  "cert_type": "mot_date",
  "cert_name": "MOT",
  "expiry_date": "2026-04-10",
  "severity": "expiring_soon|urgent|expired",
  "display_name": "Bus BUS-01 — MOT",
  "subject_document_id": "uuid-or-omitted"
}
```
Severity rules: `expiring_soon` = 8–30 days (weekly reminder), `urgent` = 1–7 days (daily), `expired` = past expiry up to 90 days (daily).
`days_until_expiry` is NOT stored — derive at render time from `expiry_date`.

### Parent Data Duplication (reviewed 31 March 2026)

Two competing parent tables exist:
- `parent_contacts` — active, linked to `passenger_parent_contacts` M:M junction, has `user_id` UUID (Supabase auth link). **Use this.**
- `parent_data` — legacy, 3 rows, `phone_number` stored as `numeric` type (wrong). Do NOT use.

### Dual Auth System (reviewed 31 March 2026)

- `users` table — legacy, int-keyed, stores `password_hash` directly. May still be active for dashboard login.
- `auth.users` (Supabase) + `user_roles` + `employees.user_id` (UUID) — the modern auth path.

Do NOT add new code that writes to the `users` table. Any new user-linked features must use the UUID-based path.

---

## Ongoing DB Review Process

The schema is being reviewed and corrected incrementally. Before implementing any feature in a given domain:

1. Check this file for any known issues in that domain
2. Query the live schema (`information_schema.columns`, `pg_proc` for RPCs) — do not trust migrations
3. Check which rows actually exist in relevant tables (`SELECT COUNT(*)`) — empty tables may be dead code
4. If you find a new design problem, document it in this file under "Known Technical Debt"

---

## API Documentation — docs/apidog/

The API collection is maintained at `docs/apidog/FleetManager.postman_collection.json` (Postman v2.1 format, importable into ApiDog).

### When to update the collection

Update `docs/apidog/FleetManager.postman_collection.json` whenever you:

| Change | What to update in the collection |
|--------|----------------------------------|
| Add a new Next.js API route (`app/api/**`) | Add a new request entry in the matching folder |
| Add or deploy a new Edge Function (`supabase/functions/**`) | Add a new request entry in the **Edge Functions** folder |
| Change a request body shape or add/remove a field | Update the `body.raw` JSON and the `description` field table |
| Add or change an RLS policy on a table | Update the policy table in the relevant folder's `description` |
| Add a new Postgres RPC | Add a new entry to the **RPC Functions** folder |
| Change response status codes or error messages | Update the **Expected responses** table in the request `description` |

### How to update

**ApiDog is the source of truth.** Do not edit the JSON file directly.

1. Add or update the endpoint **in ApiDog** (the live imported collection)
2. Test the endpoint in ApiDog
3. When ready to persist: **Export** the collection from ApiDog → overwrite `docs/apidog/FleetManager.postman_collection.json` → commit
4. **Never** re-import the JSON file into an ApiDog project that already has edits — this will overwrite your changes. Always export out, never import in again.
5. **Never** put real credentials (project ref, anon key, service role key) in the file — always use `{{variable}}` placeholders

### Architecture reminder (for writing descriptions)

- **RLS policies** = data visibility layer (who sees which rows) — document in the folder `description`
- **Edge Functions** = business logic layer (validation, time gates, ownership checks) — document step by step in the request `description`
- **RPCs** = DB-side logic (complex queries, atomic multi-table ops) — document input params and side effects
- **Next.js API routes** = thin orchestration layer calling Supabase — document what tables/RPCs they touch