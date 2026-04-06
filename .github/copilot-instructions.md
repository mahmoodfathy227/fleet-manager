# GitHub Copilot Instructions

## Pre-Implementation Checklist

Before writing, editing, or deleting **any** line of code in this codebase:

1. **Verify the Supabase table schema** — confirm every column referenced in a query or insert actually exists in the live database (`information_schema.columns`). Never assume a migration has been applied.
2. **Verify API endpoints** — confirm the route handler exists and accepts the expected method/params before calling it from the frontend.
3. **Check RLS policies** — confirm the authenticated user's permissions allow the intended operation (SELECT / INSERT / UPDATE / DELETE) on the affected table.
4. **Check storage buckets** — if a file upload is involved, confirm the target bucket exists and is accessible.

> Skipping these checks is the primary cause of runtime errors in this project (e.g. `PGRST204 column not found`, `400 Bad Request`, `Bucket not found`).

---

## Pre-Commit Checklist

**Before committing and pushing any code change, you MUST run a production build and verify it succeeds with zero errors.**

```bash
npm run build
```

- If the build fails, fix all errors before committing. **Never commit broken code.**
- A missing import, a wrong type, or a deleted export will cause a 5xx error on the live dashboard for all users — the same as a runtime crash.
- TypeScript errors that are suppressed in dev mode are **fatal** in `next build`. Do not assume `tsc` passing locally means the build will pass.
- After build succeeds, stage and commit. Only then push.

> A broken import was pushed previously and caused a full dashboard 5xx outage. This rule exists to prevent that.

### Supabase MCP — Read-Only

The Supabase MCP tool is connected in **read-only mode**. This means:

- `mcp_supabase_execute_sql` can only run `SELECT` queries — do **not** attempt `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, or any other write operation through it.
- All schema changes (migrations, function definitions, RLS policies, cron jobs) must be written as a `.sql` migration file in `supabase/migrations/` and applied **manually** by the developer via the Supabase dashboard SQL editor or the Supabase CLI.
- Always save the SQL to a migration file first, then instruct the developer to run it — never try to apply it directly via MCP.

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

## Known Technical Debt (updated as reviewed)

### Notifications System (reviewed 31 March 2026)

Four notification-related tables exist. Three are effectively dead:

| Table | Status | Issue |
|-------|--------|-------|
| `notifications` | ✅ Active — dashboard reads this | 6 compliance-specific columns are NOT NULL but meaningless for non-compliance types (breakdown, tardiness). Existing inserts abuse these columns with dummy values. **ALTER TABLE DROP NOT NULL fix is required.** |
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

1. Edit the JSON directly in `docs/apidog/FleetManager.postman_collection.json`
2. Follow the existing structure — each request has `name`, `request` (method, header, url, body), and `description`
3. Add the AI draft disclaimer to any new entry description:
   ```
   > ⚠️ AI-GENERATED DRAFT — NOT YET REVIEWED
   ```
4. When a human has verified an entry, replace the disclaimer with:
   ```
   > ✅ Reviewed by [Name] on [Date] — [Confirmed correct / Notes]
   ```
5. **Never** put real credentials (project ref, anon key, service role key) in the file — always use `{{variable}}` placeholders

### Architecture reminder (for writing descriptions)

- **RLS policies** = data visibility layer (who sees which rows) — document in the folder `description`
- **Edge Functions** = business logic layer (validation, time gates, ownership checks) — document step by step in the request `description`
- **RPCs** = DB-side logic (complex queries, atomic multi-table ops) — document input params and side effects
- **Next.js API routes** = thin orchestration layer calling Supabase — document what tables/RPCs they touch