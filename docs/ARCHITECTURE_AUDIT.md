# Architecture Audit — Fleet Manager
> Conducted: 23 April 2026 | Status: ACTIVE — do not delete

---

## 1. Table Inventory (100 items in `public` schema)

All tables in `public` schema are **custom-created** by the dev team. Supabase system tables live in `auth.*`, `storage.*`, `extensions.*`, and `supabase_migrations` — none of those appear here.

### 1.1 Live & healthy tables (have meaningful data, actively used)

| Table | Rows | Notes |
|-------|------|-------|
| `vehicle_telematics_history` | 226,072 | Samsara telemetry archive |
| `field_audit_log` | 7,725 | Field-level change audit |
| `audit_log` | 2,085 | General audit |
| `parent_contacts` | 1,170 | ⚠️ **NO RLS** — sensitive personal data fully exposed |
| `passenger_parent_contacts` | 1,143 | ⚠️ **NO RLS** — junction table |
| `documents` | 859 | Old document store |
| `notifications` | 825 | Active notifications |
| `document_vehicle_links` | 678 | Vehicles↔Documents |
| `passengers` | 676 | SEN students |
| `subject_documents` | 303 | Newer compliance doc system |
| `route_sessions` | 253 | Trip sessions |
| `vehicles` | 172 | Fleet vehicles |
| `routes` | 164 | Transport routes |
| `document_driver_links` | 107 | Drivers↔Documents |
| `role_permissions` | 106 | RBAC config |
| `document_subject_document_links` | 96 | Cross-link table |
| `vehicles_realtime` | 89 | Samsara live data |
| `vehicle_fuel_distance` | 87 | Fuel/mileage records |
| `sms_verification_rate_limits` | 75 | Rate limiting |
| `users` | 52 | ⚠️ LEGACY auth — has `password_hash` column |
| `employees` | 49 | ⚠️ **NO RLS** — sensitive PII fully exposed |
| `permissions` | 39 | RBAC permissions |
| `parent_absence_reports` | 38 | Parent absence submissions |
| `document_requirements` | 30 | Compliance requirement definitions |
| `user_roles` | 27 | RBAC user→role mappings |
| `schools` | 21 | School records |

### 1.2 Low-data tables (alive but thin — may grow or may be dead)

| Table | Rows | Status |
|-------|------|--------|
| `compliance_cases` | 18 | Active |
| `drivers` | 17 | Active but has massive column bloat (see section 5) |
| `calendar_day_note_views` | 15 | Active |
| `vehicle_updates` | 15 | Active |
| `call_logs` | 15 | Active |
| `route_updates` | 14 | Active |
| `document_pa_links` | 12 | Active |
| `calendar_day_notes` | 11 | Active |
| `incident_employees` | 10 | Active |
| `tardiness_reports` | 10 | Active |
| `vehicle_seating_plans` | 8 | Active |
| `appointment_slots` | 8 | Active |
| `agreement_acceptances` | 7 | Active |
| `passenger_assistants` | 7 | Active but has same column bloat as `drivers` |
| `incidents` | 7 | Active |
| `route_points` | 7 | ⚠️ **NO RLS** |
| `roles` | 6 | Active |
| `vehicle_pre_checks` | 5 | Active |
| `employees_applications` | 5 | Active |
| `incident_passengers` | 5 | Active |
| `appointment_bookings` | 4 | Active |
| `agreements` | 4 | Active |
| `route_passenger_attendance` | 4 | Active |
| `route_spares` | 4 | Active |
| `parent_data` | 3 | ❌ **DEAD** — legacy, wrong schema (`phone_number` as numeric) |
| `vehicle_breakdowns` | 3 | Active |
| `email_summaries` | 3 | Active |
| `sms_verification_otps` | 3 | ⚠️ **NO RLS** — OTP secrets exposed! |
| `route_passenger_assistants` | 3 | Active |
| `maintenance_checks_question` | 3 | Active |
| `password_reset_rate_limits` | 2 | Active |
| `passenger_updates` | 2 | Active |
| `compliance_case_updates` | 2 | Active |
| `system_activities` | 2 | Active |
| `password_reset_otps` | 1 | Active |
| `coordinator_school_assignments` | 1 | Active |
| `samsara_telemetry` | 1 | ⚠️ **NO RLS** |
| `route_session_action_locks` | 1 | Active |
| `telematics_alert_thresholds` | 1 | Active |
| `document_expiry_tolerance` | 1 | Active |

### 1.3 Empty tables — confirmed dead (0 rows, never written to)

| Table | Verdict |
|-------|---------|
| `admin_notifications` | ❌ Dead — better design than `notifications` but never used |
| `certificate_types` | ❌ Dead — superseded by `document_requirements` |
| `certificates` | ❌ Dead — superseded by `subject_documents` |
| `driver_responses` | ❌ Dead — pre-check responses never used |
| `driver_updates` | ❌ Dead |
| `incident_party_entries` | ❌ Dead |
| `next_of_kin` | ❌ Dead — `employees.next_of_kin` text column used instead |
| `push_notifications` | ❌ Dead — Firebase not yet activated |
| `push_notification_recipients` | ❌ Dead |
| `route_session_seat_assignments` | ❌ Dead — `seating_plan_seats` used instead |
| `route_stop_events` | ❌ Dead |
| `samsara_logs` | ❌ Dead |
| `samsara_mapping_audit_log` | ❌ Dead |
| `samsara_sync_logs` | ❌ Dead |
| `samsara_vehicle_unmatched` | ❌ Dead |
| `seating_plan_seats` | ❌ Dead |
| `user_push_tokens` | ❌ Dead — Firebase not yet activated |
| `vehicle_assignments` | ❌ Dead |
| `vehicle_compliance_spare_assignments` | ❌ Dead |
| `vehicle_configurations` | ❌ Dead — ⚠️ also has NO RLS |
| `vehicle_pre_check_driver_responses` | ❌ Dead |
| `vehicle_telematics_latest` | ❌ Dead |

**Views (7 total — all computed read-only, no data stored):**
`daily_route_summaries`, `passenger_attendance_history`, `route_attendance_summary`, `route_service_history`, `route_session_seating_overview`, `school_route_overview`, `vehicle_substitution_matrix`

---

## 2. Critical Security Issues — Tables Without RLS

**Tables with `rls_enabled = false` (data accessible to ANY authenticated or anon user via PostgREST):**

| Table | Rows | Sensitivity | Action Required |
|-------|------|-------------|-----------------|
| `employees` | 49 | 🔴 CRITICAL — DOB, address, phone, email, user_id | Enable RLS + admin-only policy |
| `parent_contacts` | 1,170 | 🔴 CRITICAL — parent PII: name, phone, email, address | Enable RLS + admin-only policy |
| `passenger_parent_contacts` | 1,143 | 🟠 HIGH — links parents to SEN children | Enable RLS |
| `sms_verification_otps` | 3 | 🔴 CRITICAL — OTP codes in plaintext | Enable RLS — SELECT denied to all |
| `next_of_kin` | 0 | 🔴 CRITICAL — NOK sensitive data (empty but table is open) | Enable RLS |
| `route_points` | 7 | 🟡 MEDIUM — route/stop geographic data | Enable RLS |
| `samsara_telemetry` | 1 | 🟡 MEDIUM — vehicle telemetry | Enable RLS |
| `vehicle_configurations` | 0 | 🟡 LOW (empty) | Enable RLS |
| `admin_notifications` | 0 | 🟡 LOW (empty, dead) | Enable RLS or drop |
| `parent_data` | 3 | 🔴 HIGH — legacy parent PII (should be dropped) | Drop table |

> **Root cause:** The previous developer added columns/tables incrementally without consistently adding RLS. The absence of RLS does NOT block access — it means ALL rows are visible to anyone with the anon key who knows the table name.

---

## 3. Storage Buckets — Current State (11 buckets)

| Bucket | Public | Files | Mime Limits | Size Limit | Problem |
|--------|--------|-------|-------------|------------|---------|
| `VEHICLE_DOCUMENTS` | ✅ PUBLIC | 701 | ❌ None | ❌ None | MOT, insurance, sensitive vehicle docs — PUBLIC! |
| `DRIVER_DOCUMENTS` | ✅ PUBLIC | 139 | ❌ None | ❌ None | Driver compliance docs — PUBLIC with no limits! |
| `drivers` | 🔒 Private | 60 | ❌ None | 10MB | Name inconsistency (lowercase vs UPPER) |
| `PA_DOCUMENTS` | 🔒 Private | 23 | ❌ None | ❌ None | OK private, but no mime/size limits |
| `ROUTE_DOCUMENTS` | ✅ PUBLIC | 16 | image/*, pdf | 20MB | Acceptable — route sheets |
| `DOCUMENTS` | ✅ PUBLIC | 15 | jpg/png/gif/pdf | 10MB | Generic — purpose unclear |
| `EMPLOYEE_DOCUMENTS` | ✅ PUBLIC | 12 | jpg/png/gif/pdf | 10MB | Employee docs exposed |
| `employees_applications` | ✅ PUBLIC | 9 | ❌ None | ❌ None | CVs/applications PUBLIC |
| `icons` | 🔒 Private | 5 | ❌ None | ❌ None | OK — UI assets |
| `employee_personal_photos` | ✅ PUBLIC | 1 | ❌ None | ❌ None | Passport photos PUBLIC |
| `INCIDENT_DOCUMENTS` | ✅ PUBLIC | 0 | ❌ None | ❌ None | Incident evidence PUBLIC (when files uploaded) |

### Proposed Bucket Architecture (4 buckets)

Replace all 11 with 4 purpose-built buckets:

```
private-docs/         (private, pdf only, 25MB limit)
  └── vehicles/{vehicle_id}/          MOT, insurance, compliance
  └── employees/{employee_id}/        DBS, passport, driving licence
  └── passengers/{passenger_id}/      SEN assessments, care plans
  └── incidents/{incident_id}/        Evidence, reports

private-images/       (private, image types only, 5MB limit)
  └── employees/{employee_id}/profile.jpg
  └── passengers/{passenger_id}/photo.jpg
  └── vehicles/{vehicle_id}/photo.jpg

public-assets/        (public, image + pdf, 2MB limit)
  └── icons/
  └── templates/
  └── route-sheets/

videos/               (private, video types only, 200MB limit — for future pre-checks)
  └── pre-checks/{vehicle_id}/{date}/
```

### File Authorization Strategy

**Question: Is there something better than signed URLs for both dashboard + mobile app?**

Short answer: **No single silver bullet** — but the right approach depends on use case:

| Approach | Works on Dashboard | Works on Mobile App | Notes |
|----------|-------------------|--------------------|----|
| **Supabase signed URLs** (current) | ✅ | ✅ | Short-lived (1h). Must be regenerated. Standard choice. |
| **Private bucket + RLS Storage Policies** | ✅ | ✅ | RLS can restrict `storage.objects` by user/role. Combined with short signed URLs = best practice. |
| **Supabase Edge Function as proxy** | ✅ | ✅ | Download endpoint validates auth, streams file. Adds latency. Good for audit-logged downloads. |
| **Presigned URLs with long TTL** | ✅ | ✅ | ❌ Insecure — URL is shareable, not revokable |
| **Public bucket** | ✅ | ✅ | ❌ Zero auth — anyone with URL can access |

**Recommended approach:** Private buckets + RLS storage policies + 1-hour signed URLs generated server-side. The mobile app requests a signed URL from an Edge Function (which validates the JWT), uses it once to download. This is the standard Supabase pattern.

---

## 4. People Model — Current vs Proposed

### Current (fragmented, no unified identity)

```
employees (49 rows)           ← all staff (driver, PA, admin, coordinator...)
  └── drivers (17 rows)       ← driver-specific compliance cols (BLOATED)
  └── passenger_assistants    ← PA-specific compliance cols (BLOATED)

passengers (676 rows)         ← SEN students
  └── passenger_parent_contacts ← M:M to parent_contacts
      └── parent_contacts (1,170 rows) ← parents/guardians

users (52 rows)               ← LEGACY, has password_hash
auth.users                    ← modern Supabase auth
user_roles (27 rows)          ← RBAC
```

**Problems:**
- `drivers` and `passenger_assistants` duplicate compliance data that also lives in `subject_documents`
- Two auth systems (`users` with password_hash + `auth.users`)
- `parent_contacts` has no RLS
- No unified concept of "person with identity"
- `parent_data` (3 rows, wrong types) exists alongside `parent_contacts` (1,170 rows)

### Proposed Clean Model

```
People on the platform:
┌─────────────────────────────────────────────────────┐
│  CREW (employees)                                    │
│  employees table: id, full_name, role, user_id (FK  │
│    to auth.users), phone, email, dob, address,      │
│    employment_status, can_work                       │
│  role enum: 'driver' | 'assistant' | 'admin' |      │
│    'coordinator' | 'operations' | ...                │
│  subject_documents — ALL compliance docs here        │
│  (DROP drivers.* compliance cols, keep drivers table │
│   for driver-ONLY fields: spare_driver, self_employed│
│   qr_token only)                                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  PASSENGERS (SEN students)                           │
│  passengers table: id, full_name, dob, sen_needs,   │
│    mobility_type, school_id, route_id, ...           │
│  NO auth.users link (they don't log in)              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  CARERS (parents/guardians/hired contacts)           │
│  parent_contacts table (rename to: carers or         │
│    passenger_contacts): id, full_name, relationship, │
│    phone, email, address, user_id (→ auth.users)    │
│  passenger_parent_contacts: M:M junction             │
│  RELATIONSHIP field: 'parent' | 'guardian' |         │
│    'grandparent' | 'uncle' | 'aunt' | 'hired'        │
└─────────────────────────────────────────────────────┘
```

---

## 5. `drivers` Table — Column Bloat Analysis

17 rows, 43 columns. Major problems found:

| Column | Filled/17 | Problem |
|--------|-----------|---------|
| `full_name` | 2/17 | ❌ Duplicate — use `employees.full_name` |
| `email` | 2/17 | ❌ Duplicate — use `employees.personal_email` |
| `phone` | 1/17 | ❌ Duplicate — use `employees.phone_number` |
| `phone_number` | 1/17 | ❌ Duplicate of `phone` in same table! |
| `vehicle` | 1/17 | ❌ Text FK (should be `vehicle_id INT FK routes.vehicle_id`) |
| `documents_path` | 9/17 | ❌ Legacy path string — use storage buckets |
| `vehicle_insurance_expiry_date` | 0/17 | ❌ Vehicle data, not driver data — belongs on `vehicles` |
| `mot_expiry_date` | 0/17 | ❌ Vehicle data — belongs on `vehicles` |
| `taxi_badge_expiry_date` | 0/17 | ❌ Entirely null, unused |
| `taxi_badge_number` | 1/17 | ❌ Almost dead |
| `tas_badge_number` | 6/17 | ⚠️ Duplicate — `subject_documents` is source of truth |
| `tas_badge_expiry_date` | ~8/17 | ⚠️ Duplicate — same |
| `dbs_expiry_date` | ~12/17 | ⚠️ Duplicate — same |
| `first_aid_certificate_expiry_date` | varies | ⚠️ Duplicate — same |
| `passport_expiry_date` | varies | ⚠️ Duplicate — same |
| `driving_license_expiry_date` | varies | ⚠️ Duplicate — same |
| `safeguarding_training_completed` | varies | ⚠️ Duplicate — same |
| `psa_training_completed` | varies | ⚠️ Duplicate — same |
| `birth_certificate` | 17/17 | ⚠️ Boolean flag (all true?) — should be in subject_docs |
| `marriage_certificate` | 17/17 | ⚠️ Boolean flag — is this relevant? |
| `private_hire_badge` | 17/17 | ⚠️ Boolean flag |
| `paper_licence` | 17/17 | ⚠️ Boolean flag |
| `taxi_plate_photo` | 17/17 | ⚠️ Boolean flag |
| `logbook` | 17/17 | ⚠️ Boolean flag |

> **Root cause:** The previous developer kept adding individual date columns to `drivers` every time a new compliance requirement was added, instead of using the generic `subject_documents` system that was built AFTER. Both systems now exist in parallel and are inconsistently populated.

---

## 6. Document System — 8 Tables for One Concept

```
documents                        ← the physical file record (URL, name, type)
  ├── document_driver_links       ← which driver owns this document
  ├── document_pa_links           ← which PA owns this document
  ├── document_vehicle_links      ← which vehicle owns this document
  └── document_subject_document_links  ← link document → compliance slot

subject_documents                ← the compliance "slot" (requirement + status + expiry)
  └── document_requirements      ← defines what's required (per role/entity type)

document_expiry_tolerance        ← global config for "expiring soon" threshold
```

**Proposed clean design:**
```
compliance_requirements          ← what's needed (replaces document_requirements)
  id, requirement_key, entity_type, criticality, is_required, label

compliance_documents             ← replaces documents + subject_documents + all link tables
  id, entity_type (driver|vehicle|pa|passenger), entity_id,
  requirement_id (FK), status, expiry_date, file_url, file_bucket,
  uploaded_by (FK auth.users), uploaded_at, verified_by, verified_at
```

Two tables instead of eight. Entity identified by `(entity_type, entity_id)` pair.

---

## 7. Phased Remediation Plan

### Phase 1 — SECURITY (do first, no functionality impact)
> Can be done in a migration today

1. **Enable RLS on 10 exposed tables:**
   - `employees`, `parent_contacts`, `passenger_parent_contacts`, `sms_verification_otps`, `next_of_kin`, `route_points`, `samsara_telemetry`, `vehicle_configurations`, `admin_notifications`
   - Policy: `authenticated + admin role` for sensitive tables; `authenticated` for junction tables
   
2. **Make sensitive buckets private:**
   - `VEHICLE_DOCUMENTS` → private
   - `DRIVER_DOCUMENTS` → private  
   - `employee_personal_photos` → private
   - `employees_applications` → private
   - Update all file URL references to use signed URLs

3. **Add mime type + size limits to buckets lacking them**

### Phase 2 — DEAD CODE REMOVAL (reduces confusion, safe to do)

Drop empty dead tables (listed in 1.3). This requires:
1. Search codebase for any reference to the table name
2. Confirm 0 rows + no foreign keys pointing to it
3. Write DROP TABLE migration

Drop `parent_data` (3 rows, wrong types, superseded by `parent_contacts`).

### Phase 3 — DRIVERS TABLE CLEANUP (breaking change, needs care)

1. Remove columns that duplicate `employees.*` (`full_name`, `email`, `phone`, `phone_number`)
2. Remove `vehicle` (text), `documents_path` (legacy path)
3. Remove vehicle-specific columns (`vehicle_insurance_expiry_date`, `mot_expiry_date`)
4. Remove entirely-null columns (`taxi_badge_expiry_date`)
5. Decide fate of all compliance boolean/date columns — migrate data to `subject_documents` first, then drop

**Before adding NOT NULL to any column:** Check count of existing NULLs. If > 0, must provide a DEFAULT or migrate data before adding constraint.

### Phase 4 — UNIFIED DOCUMENT SYSTEM (long-term, biggest lift)

Consolidate 8 tables into 2. Requires:
1. Build migration script to move all rows to new schema
2. Update all queries (large surface area)
3. Test thoroughly before dropping old tables

### Phase 5 — BUCKET MIGRATION

Migrate files to new 4-bucket structure:
1. Copy files to new buckets using Supabase Storage API (Edge Function migration script)
2. Update all file URL references in `documents` / `subject_documents` tables
3. Delete old buckets
4. Update storage policies

---

## 8. Nullable FK Columns — Strategy

When a FK column is nullable and you want to make it required:

```sql
-- Step 1: Find rows with NULL FK
SELECT id FROM drivers WHERE some_fk_id IS NULL;

-- Step 2: Decide: delete orphans, assign a default, or backfill
-- Option A: delete orphaned rows
DELETE FROM drivers WHERE some_fk_id IS NULL;

-- Option B: assign a placeholder/default value first
UPDATE drivers SET some_fk_id = 1 WHERE some_fk_id IS NULL;

-- Step 3: Only then add NOT NULL constraint
ALTER TABLE drivers ALTER COLUMN some_fk_id SET NOT NULL;
```

> Rule: NEVER add NOT NULL in a migration without first resolving existing NULLs in the same migration.

---

## 9. All Schemas (12 total, audited 23 April 2026)

| Schema | Tables | Views | Functions | Owner | Purpose |
|--------|--------|-------|-----------|-------|---------|
| `public` | **88** | **7** | **82** | Us (custom) | All app tables — the only schema we own |
| `auth` | 23 | 0 | 4 | Supabase | auth.users, auth.sessions, auth.identities, MFA, SSO |
| `realtime` | 9 | 0 | 12 | Supabase | Realtime broadcast/presence subscriptions |
| `storage` | 8 | 0 | 22 | Supabase | storage.buckets, storage.objects, storage policies |
| `cron` | 2 | 0 | 7 | Supabase (pg_cron) | Scheduled cron jobs (pg_cron extension) |
| `net` | 2 | 0 | 12 | Supabase (pg_net) | HTTP requests from SQL (pg_net extension) |
| `supabase_functions` | 2 | 0 | 1 | Supabase | Edge Functions hook table |
| `supabase_migrations` | 2 | 0 | 0 | Supabase | Migration history tracking |
| `vault` | 1 | 1 | 5 | Supabase | Encrypted secrets storage |
| `extensions` | 0 | 2 | 55 | Supabase | PostgreSQL extension functions (uuid, crypto, etc.) |
| `graphql` | 0 | 0 | 6 | Supabase | pg_graphql internal |
| `graphql_public` | 0 | 0 | 1 | Supabase | GraphQL public entry point |

> We only own and edit `public`. All other schemas are managed by Supabase — never run DDL against them.

The `public` schema is **not inherently insecure** — the problem is missing RLS on specific tables, not the schema name. "Public schema" ≠ "publicly accessible".

---

## 10. `public` Schema — Full Statistics (23 April 2026)

| Metric | Value | Notes |
|--------|-------|-------|
| Base tables | **88** | All custom-created |
| Views | **7** | Read-only computed views |
| Functions / RPCs | **82** | PostgreSQL functions |
| FK constraints | **177** | No orphaned FKs found |
| Tables WITHOUT RLS | **10** | Security risk — see section 2 |
| Empty tables (0 rows) | **22** | Candidates for removal |
| Near-empty tables (1–10 rows) | **32** | Need review |
| Large tables (>100 rows) | **15** | Core operational data |
| Total rows across all tables | **~243,000** | Dominated by telemetry (226k rows) |

### Tables to Drop — Full Removal Candidates

**Category A — Confirmed dead, no live FK dependencies (safe to drop after app-team sign-off):**

| Table | Rows | FK Blocker? | Notes |
|-------|------|-------------|-------|
| `admin_notifications` | 0 | None | Better-designed than `notifications` but never used |
| `driver_updates` | 0 | None | Zero rows, zero code references |
| `incident_party_entries` | 0 | None | Zero rows |
| `next_of_kin` | 0 | None | `employees.next_of_kin` TEXT column used instead |
| `push_notification_recipients` | 0 | None | Firebase not activated |
| `push_notifications` | 0 | None | Firebase not activated |
| `route_session_seat_assignments` | 0 | None | `seating_plan_seats` used instead |
| `route_stop_events` | 0 | None | Zero rows |
| `samsara_logs` | 0 | None | Superseded by `vehicle_telematics_history` |
| `samsara_mapping_audit_log` | 0 | None | Zero rows |
| `samsara_sync_logs` | 0 | None | Zero rows |
| `samsara_vehicle_unmatched` | 0 | None | Zero rows |
| `seating_plan_seats` | 0 | None | Zero rows |
| `user_push_tokens` | 0 | None | Firebase not activated |
| `vehicle_assignments` | 0 | None | Zero rows |
| `vehicle_compliance_spare_assignments` | 0 | None | Zero rows |
| `vehicle_configurations` | 0 | None (NO RLS) | Zero rows |
| `vehicle_pre_check_driver_responses` | 0 | None | Both this and `driver_responses` are dead |
| `vehicle_telematics_latest` | 0 | None | Replaced by `vehicle_telematics_history` |

**Category B — Dead, but need to drop FK constraint on a live table first:**

| Table | Rows | FK Blocker | Action Required |
|-------|------|------------|-----------------|
| `certificates` | 0 | `notifications.certificate_id → certificates` (live table!) | Drop the nullable FK column or constraint on `notifications` first, then drop `certificates` |
| `certificate_types` | 0 | `certificates.certificate_type_id → certificate_types` (but `certificates` is also dead) | Drop `certificates` first, then `certificate_types` |
| `driver_responses` | 0 | `vehicle_pre_check_driver_responses.driver_response_id` (also dead) | Drop `vehicle_pre_check_driver_responses` first |

**Category C — Small data, possibly abandoned (need app-team confirmation):**

| Table | Rows | Last Activity | Suspicion |
|-------|------|---------------|-----------|
| `sms_verification_otps` | 3 | 2026-02-20 | Zero code references — Twilio now handles OTPs |
| `sms_verification_rate_limits` | 75 | 2026-03-10 | Zero code references — may be Twilio rate-limiter artefact |
| `password_reset_otps` | 1 | 2026-01-18 | Zero code references |
| `password_reset_rate_limits` | 2 | 2026-01-18 | Zero code references |
| `parent_data` | 3 | unknown | Legacy, wrong schema (`phone_number` as numeric). Use `parent_contacts` |

### Removal Summary

| Category | Count | Notes |
|----------|-------|-------|
| Category A — safe to drop | **19** | Confirmed dead, no blockers |
| Category B — drop after FK cleanup | **3** | Minor FK constraints to remove first |
| Category C — pending app-team confirmation | **5** | OTP tables + parent_data |
| **Total potential removals** | **27 tables** | 88 → **61 tables** (31% reduction) |

> The local migration files are all placeholder stubs — the actual schema lives only in the live database. All DROP TABLE migrations must be written fresh, applied manually via Supabase SQL editor or CLI.

---

## 11. Supabase Advisors — Full Findings (23 April 2026)

Results from Supabase Security Advisor + Performance Advisor (fetched via MCP).

---

### 11.1 Security Advisor — ERRORS 🔴

#### "Policy Exists RLS Disabled" (4 tables)

Policies were written but RLS was never switched on — the policies do nothing. This is worse than just missing RLS, because it creates a false sense of security.

| Table | Policies That Exist (but are inactive) | Fix |
|-------|----------------------------------------|-----|
| `employees` | `rbac_employees_select`, `rbac_employees_insert`, `rbac_employees_update`, `rbac_employees_delete`, `employees_allow_authenticated_insert_own_by_email`, `"read and insert for anon"` | `ALTER TABLE employees ENABLE ROW LEVEL SECURITY;` |
| `admin_notifications` | Allow authenticated: read, insert, update, delete | `ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;` (or drop the table) |
| `samsara_telemetry` | `"Allow public full access"`, `"Allow read access for all"` | `ALTER TABLE samsara_telemetry ENABLE ROW LEVEL SECURITY;` — then also review the "public full access" policy |
| `sms_verification_otps` | Allow anonymous: OTP generation, verification, deletion | `ALTER TABLE sms_verification_otps ENABLE ROW LEVEL SECURITY;` (or drop — Twilio handles OTPs now) |

> **Note on `employees`:** The anon `"read and insert for anon"` policy should be reviewed and likely removed — anonymous users should not be able to read employee PII.

#### "Security Definer View" (ALL 7 views)

Every single view is defined with `SECURITY DEFINER`, meaning it runs as the view creator (likely service role) and bypasses RLS on the underlying tables. Any authenticated user querying these views gets unfiltered data regardless of their role.

| View | Risk |
|------|------|
| `school_route_overview` | Bypasses RLS |
| `route_attendance_summary` | Bypasses RLS |
| `route_service_history` | Bypasses RLS |
| `route_session_seating_overview` | Bypasses RLS |
| `passenger_attendance_history` | Bypasses RLS |
| `vehicle_substitution_matrix` | Bypasses RLS |
| `daily_route_summaries` | Bypasses RLS |

Fix: recreate each view without `SECURITY DEFINER` (use `SECURITY INVOKER` instead, which is the default).

---

### 11.2 Security Advisor — WARNINGS 🟡

#### "Function Search Path Mutable" (~40+ functions)

Nearly every function in the DB omits `SET search_path = public`. This is a schema-poisoning SQL injection risk — a malicious user with CREATE SCHEMA access could shadow standard functions.

Full list of affected functions:

`update_vehicle_locations_updated_at`, `set_updated_audit_fields`, `update_email_summaries_updated_at`, `cleanup_expired_otps`, `get_driver_dashboard_payload_by_email`, `samsara_telemetry_broadcast_trigger`, `log_vehicle_field_changes`, `set_incident_party_entry_updated_at`, `mark_passenger_attendance`, `get_parent_children_summary`, `generate_route_sessions_next_45_weekdays`, `update_vehicle_seating_plan_timestamp`, `update_updated_at_column`, `notify_parent_on_stop_event`, `get_route_session_seating`, `notify_parents_on_session_change`, `sync_auth_users_to_public_users`, `update_vehicle_seating_plan`, `export_tas5_rows`, `find_substitution_vehicles`, `find_replacement_vehicle`, `update_seat_assignment_timestamp`, `get_route_crew_user_ids`, `unassign_passenger_seat`, `start_route_session_from_qr`, `update_route_updates_updated_at`, `assign_passenger_to_seat`, `report_vehicle_breakdown`, `assign_replacement_vehicle`, `cleanup_expired_sms_otps`

Fix pattern (apply to each function definition):
```sql
CREATE OR REPLACE FUNCTION public.my_function(...)
RETURNS ...
LANGUAGE plpgsql
SET search_path = public   -- add this line
AS $$
  ...
$$;
```

---

### 11.3 Security Advisor — INFO 🔵

#### "RLS Enabled No Policy" (tables with RLS on but zero policies — blocks ALL access)

| Table | Notes |
|-------|-------|
| `certificate_types` | Dead table — drop it (Cat B) |
| `samsara_logs` | Dead table — drop it (Cat A) |
| `samsara_mapping_audit_log` | Dead table — drop it (Cat A) |
| `samsara_sync_logs` | Dead table — drop it (Cat A) |
| `samsara_vehicle_unmatched` | Dead table — drop it (Cat A) |
| `telematics_alert_thresholds` | 1 row — add a read policy if still used, or drop |
| `vehicle_assignments` | Dead table — drop it (Cat A) |
| `vehicle_telematics_history` | Being truncated, will be dropped — fine |
| `vehicle_telematics_latest` | Dead table — drop it (Cat A) |

---

### 11.4 Performance Advisor — INFO 🔵

#### Unindexed Foreign Keys

Many FK columns lack a covering index, slowing down JOIN queries. Not critical at current data volumes but will hurt as data grows. Key ones to prioritise:

| Table | Unindexed FK |
|-------|-------------|
| `audit_log` | `changed_by` |
| `agreements` | `created_by` |
| `appointment_slots` | `created_by` |
| `call_logs` | `handled_by`, `related_incident_id` |
| `calendar_day_notes` | `created_by`, `updated_by` |
| `admin_notifications` | `read_by`, `related_activity_id` (dead table — drop instead) |

Fix pattern:
```sql
CREATE INDEX CONCURRENTLY idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX CONCURRENTLY idx_agreements_created_by ON agreements(created_by);
-- etc.
```

> Use `CONCURRENTLY` to avoid locking the table during index creation on live data.

---

### 11.5 Audit Tables — Who Writes to Them

| Table | Writer | Notes |
|-------|--------|-------|
| `audit_log` | `app/api/audit/route.ts` (Next.js) | General action log — writes `table_name`, `record_id`, `action`, `changed_by`. Currently looks up user via legacy `users` table. **Active — do not drop.** |
| `field_audit_log` | DB trigger `log_vehicle_field_changes` (fires on vehicle UPDATE) + API routes: `app/api/vehicles/[id]/field-audit`, `app/api/employees/[id]/field-audit`, `app/api/routes/[id]/field-audit` | Field-level diff log. **Active — do not drop.** |
| `samsara_mapping_audit_log` | `app/api/admin/samsara/mapping/resolve/route.ts` | 0 rows despite having a writer — the resolve endpoint may never have been called in production. **Dead in practice — Cat A drop candidate.** |

> **Note on `audit_log` writer:** `app/api/audit/route.ts` looks up the user's integer ID from the legacy `users` table via `email`. If the user exists only in `auth.users` (modern auth), the audit log is silently skipped with a warning. This means audit coverage is incomplete for any user not in the legacy table.

---

## 12. Backend Logic Map — Where Everything Lives (24 April 2026)

This section is the single reference for tracing "why did table X change?" or "what runs when Y happens?". The backend has **5 layers** — logic can hide in any of them.

```
LAYER 1 — DB Triggers        automatic, no caller needed, hardest to discover
LAYER 2 — DB RPCs            explicit .rpc('name') call from client
LAYER 3 — Edge Functions     HTTP-callable Deno functions in supabase/functions/
LAYER 4 — Next.js API Routes app/api/** — dashboard-only, not usable by mobile
LAYER 5 — PostgREST Direct   .from('table').select/insert/update/delete — RLS is the only gate
```

To trace a table change, check in this order:
1. Does the table have a trigger? → Check 12.1
2. Is there an RPC that writes to it? → Check 12.2
3. Is there an Edge Function? → Check 12.3
4. Is there a Next.js API route? → Check 12.4
5. Otherwise it's a direct PostgREST write from the client (Layer 5)

---

### 12.1 DB Triggers

> **How to find in Supabase Dashboard:** Database → Triggers

29 triggers active as of 24 April 2026.

| Table | Trigger Name | Timing | Event | Function Called | What It Does |
|-------|-------------|--------|-------|-----------------|--------------|
| `driver_updates` | `trigger_update_driver_updates_updated_at` | BEFORE | UPDATE | `update_updated_at_column` | Sets `updated_at = now()` — dead table |
| `drivers` | `trigger_driver_expiry_check` | AFTER | INSERT/UPDATE | `trigger_update_driver_expiry` | Sets `employees.can_work` based on `tas_badge_expiry_date` — ⚠️ reads legacy columns, competes with `trigger_subject_documents_recompute` |
| `drivers` | `trigger_ensure_driver_documents` | AFTER | INSERT | `trigger_ensure_driver_documents` | Calls `ensure_subject_documents_for_driver()` + `recompute_employee_can_work()` |
| `email_summaries` | `update_email_summaries_updated_at` | BEFORE | UPDATE | `update_email_summaries_updated_at` | Sets `updated_at = now()` |
| `employees` | `trigger_log_employee_field_changes` | AFTER | INSERT/UPDATE | `log_employee_field_changes` | Writes field-level diff to `field_audit_log` |
| `incident_party_entries` | `incident_party_entries_updated_at` | BEFORE | UPDATE | `set_incident_party_entry_updated_at` | Sets `updated_at = now()` — dead table |
| `maintenance_checks_question` | `trg_maintenance_checks_question_updated` | BEFORE | UPDATE | `set_updated_audit_fields` | Sets `updated_at`, `updated_by` |
| `notifications` | `push_notification_relay` ⚡ | AFTER | INSERT | `http_request` | **Calls the `push-notification-relay` Edge Function via HTTP — this is the push delivery trigger** |
| `passenger_assistants` | `trigger_ensure_pa_documents` | AFTER | INSERT | `trigger_ensure_pa_documents` | Calls `ensure_subject_documents_for_pa()` + `recompute_employee_can_work()` |
| `passenger_assistants` | `trigger_pa_expiry_check` | AFTER | INSERT/UPDATE | `trigger_update_pa_expiry` | Sets `employees.can_work` based on PA expiry dates — ⚠️ reads legacy columns, competes with `trigger_subject_documents_recompute` |
| `passenger_updates` | `trigger_update_passenger_updates_updated_at` | BEFORE | UPDATE | `update_updated_at_column` | Sets `updated_at = now()` |
| `route_session_seat_assignments` | `trigger_update_seat_assignment_timestamp` | BEFORE | UPDATE | `update_seat_assignment_timestamp` | Sets `updated_at = now()` |
| `route_sessions` | `trg_notify_parents_on_session_change` ⚡ | AFTER | INSERT/UPDATE | `notify_parents_on_session_change` | Inserts `trip_started` / `trip_completed` / `child_not_on_trip` notifications into `notifications` |
| `route_sessions` | `trigger_update_route_sessions_updated_at` | BEFORE | UPDATE | `update_updated_at_column` | Sets `updated_at = now()` |
| `route_spares` | `trigger_route_spares_audit` | BEFORE | UPDATE | `route_spares_audit` | Sets `updated_at = now()`, `updated_by = auth.uid()` |
| `route_spares` | `trigger_route_spares_deactivate_others` | BEFORE | INSERT | `route_spares_deactivate_others` | When a spare is activated, deactivates all other active spares for same route + spare_type |
| `route_stop_events` | `trg_notify_parent_on_stop_event` ⚠️ | AFTER | INSERT | `notify_parent_on_stop_event` | Inserts `driver_at_stop` / `child_picked_up` / `child_dropped_off` / `child_no_show` into `notifications` — **but `route_stop_events` is a dead table with 0 rows, so this trigger never fires** |
| `route_updates` | `trigger_update_route_updates_updated_at` | BEFORE | UPDATE | `update_route_updates_updated_at` | Sets `updated_at = now()` |
| `routes` | `trigger_log_route_field_changes` | AFTER | INSERT/UPDATE | `log_route_field_changes` | Writes field-level diff to `field_audit_log` |
| `subject_documents` | `trigger_subject_documents_recompute` | AFTER | INSERT/UPDATE/DELETE | `trigger_recompute_subject_documents` | Calls `recompute_employee_can_work()` or `recompute_vehicle_operational()` — keeps `employees.can_work` and `vehicles.off_the_road` in sync |
| `vehicle_breakdowns` | `trigger_update_breakdown_timestamp` | BEFORE | UPDATE | `update_breakdown_timestamp` | Sets `updated_at = now()` |
| `vehicle_seating_plans` | `trigger_update_vehicle_seating_plan_timestamp` | BEFORE | UPDATE | `update_vehicle_seating_plan_timestamp` | Sets `updated_at = now()` |
| `vehicle_updates` | `trigger_update_vehicle_updates_updated_at` | BEFORE | UPDATE | `update_updated_at_column` | Sets `updated_at = now()` |
| `vehicles` | `trigger_ensure_vehicle_documents` | AFTER | INSERT | `trigger_ensure_vehicle_documents` | Calls `ensure_subject_documents_for_vehicle()` + `recompute_vehicle_operational()` |
| `vehicles` | `trigger_log_vehicle_field_changes` | AFTER | INSERT/UPDATE | `log_vehicle_field_changes` | Writes field-level diff to `field_audit_log` |
| `vehicles` | `trigger_set_vehicle_registration_normalized` | BEFORE | INSERT/UPDATE | `set_vehicle_registration_normalized` | Normalises `registration` text into `registration_normalized` |
| `vehicles` | `trigger_sync_vehicle_dates` | AFTER | UPDATE | `sync_vehicle_dates_to_subject_documents` | When `mot_date` or `tax_date` changes, UPDATEs the corresponding `subject_documents` row |
| `vehicles` | `trigger_vehicle_expiry_check` | BEFORE | UPDATE | `trigger_update_vehicle_expiry` | Sets `off_the_road = TRUE` if any cert is expired; clears it if all valid |
| `vehicles` | `trigger_vehicle_expiry_check_insert` | BEFORE | INSERT | `trigger_update_vehicle_expiry` | On INSERT always sets `off_the_road = FALSE` |

#### 12.1.1 Key Trigger Chains

Follow these when debugging unexpected changes:

```
INSERT drivers
  → trigger_ensure_driver_documents
      → ensure_subject_documents_for_driver()   [creates subject_document rows]
      → recompute_employee_can_work()            [sets employees.can_work]
  → trigger_driver_expiry_check
      → trigger_update_driver_expiry()           [also sets employees.can_work from legacy columns]

UPDATE vehicles (mot_date or tax_date)
  → trigger_sync_vehicle_dates                  [syncs to subject_documents]
  → trigger_subject_documents_recompute         [recomputes vehicles.off_the_road]
  → trigger_vehicle_expiry_check                [also re-evaluates off_the_road]
  → trigger_log_vehicle_field_changes           [logs to field_audit_log]

INSERT notifications
  → push_notification_relay trigger
      → net.http_request() to push-notification-relay Edge Function
          → Firebase FCM push delivery
```

#### 12.1.2 Trigger Bugs

**⚠️ `trg_notify_parent_on_stop_event` is orphaned:**
This trigger fires on `route_stop_events` INSERT — but `route_stop_events` has 0 rows and is a dead table. Stop events (pick-up, drop-off, no-show) are currently recorded elsewhere or not at all. Parent real-time stop notifications **never fire**. This is a significant missing feature.

**⚠️ `employees.can_work` has two competing trigger writers:**
Both `trigger_update_driver_expiry` (reads `drivers.tas_badge_expiry_date`) and `recompute_employee_can_work()` (reads `subject_documents`) can independently update `employees.can_work`. They may disagree. The `recompute_employee_can_work()` path is the correct one (source of truth = `subject_documents`).

> **Confirmed 28 April 2026 via live DB query:** `trigger_driver_expiry_check` and `trigger_pa_expiry_check` already fire on INSERT/UPDATE (not INSERT-only as originally documented). The competing-writers problem still stands — both paths write `employees.can_work` from different sources.

#### 12.1.3 Trigger Remediation Decisions (29 April 2026)

All 29 triggers audited and assigned to one of five categories. Actions are scheduled in the phase plan (Section 13.6).

**Rule applied:** Triggers are only appropriate for data integrity (timestamps, `can_work` recompute, ensuring documents exist on INSERT). Business workflow (notifications, state transitions) must move to explicit Edge Functions — never hidden in triggers.

| Decision | Trigger(s) | Reason | Phase |
|---|---|---|---|
| ✅ **Keep as-is** | All timestamp/audit triggers (×18): `update_email_summaries_updated_at`, `trg_maintenance_checks_question_updated`, `trigger_log_employee_field_changes`, `trigger_update_passenger_updates_updated_at`, `trigger_update_route_sessions_updated_at`, `trigger_route_spares_audit`, `trigger_update_route_updates_updated_at`, `trigger_log_route_field_changes`, `trigger_update_breakdown_timestamp`, `trigger_update_vehicle_seating_plan_timestamp`, `trigger_update_vehicle_updates_updated_at`, `trigger_log_vehicle_field_changes`, `trigger_set_vehicle_registration_normalized`, `trigger_ensure_driver_documents`, `trigger_ensure_pa_documents`, `trigger_ensure_vehicle_documents`, `trigger_subject_documents_recompute`, `trigger_route_spares_deactivate_others` | Correct use of triggers: timestamps, audit logs, data integrity on INSERT | — |
| ⚠️ **Remove — legacy competing writers** | `trigger_driver_expiry_check`, `trigger_pa_expiry_check`, `trigger_vehicle_expiry_check`, `trigger_vehicle_expiry_check_insert` | Read from legacy columns (`drivers.tas_badge_expiry_date` etc.) and write `employees.can_work` / `vehicles.off_the_road`. Compete with `trigger_subject_documents_recompute` which is the correct path. Source of inconsistent compliance states. | Phase 1 |
| ❌ **Delete — replace with Edge Function** | `trg_notify_parents_on_session_change`, `trg_notify_parent_on_stop_event` | Business workflow (notification delivery) hidden in a trigger. `trg_notify_parent_on_stop_event` is also orphaned (fires on dead table `route_stop_events`). Replacement: explicit Edge Functions with proper auth, logging, and error handling. | Phase 7 |
| ⚠️ **Keep but fix** | `push_notification_relay` | Currently uses synchronous `net.http_request()` which blocks the transaction. Must switch to `net.http_request_queue()` (async, non-blocking). Otherwise a slow or failed Edge Function call can cause the originating DB write to timeout. | Phase 1 |
| 🗑️ **Delete — dead table triggers** | `trigger_update_driver_updates_updated_at`, `incident_party_entries_updated_at`, `trigger_update_seat_assignment_timestamp` | Fire on tables with 0 rows that are confirmed dead (`driver_updates`, `incident_party_entries`, `route_session_seat_assignments`). Remove to reduce schema noise. | Phase 4 |

---

### 12.2 DB RPCs — Callable Functions

> **How to call:** `supabase.rpc('function_name', { param: value })`
> **How to find in Supabase Dashboard:** Database → Functions

| Function | Parameters | Reads From | Writes To | Notes |
|----------|-----------|-----------|----------|-------|
| `get_driver_dashboard_payload_by_email` | `p_email` | `users`, `employees`, `drivers`, `vehicle_assignments`, `route_sessions`, `routes`, `schools`, `route_points`, `vehicles`, `vehicle_pre_checks`, `notifications`, `documents` | — | Large read-only payload for the mobile driver app. **⚠️ Reads from legacy `vehicle_assignments` (dead table) — returns empty vehicle if no assignment** |
| `get_parent_children_summary` | — | `parent_contacts`, `passenger_parent_contacts`, `passengers`, `routes`, `route_sessions`, `route_passenger_attendance` | — | For parent mobile app — returns attendance summary for their children. Scoped to `auth.uid()` |
| `get_route_crew_user_ids` | `p_route_id` | `routes`, `employees` | — | Returns auth UUIDs of driver + PA on a route |
| `get_route_session_seating` | `p_route_session_id` | `route_session_seat_assignments`, `passengers`, `users`, `employees` | — | Returns seat map for a session |
| `start_route_session_from_qr` | `p_qr_token`, `p_session_type` | `drivers`, `routes`, `route_sessions` | `route_sessions` | QR-scan trip start — finds driver by `qr_token`, looks up route, creates or returns session |
| `mark_passenger_attendance` | `p_route_session_id`, `p_passenger_id`, `p_status`, `p_notes`, `p_marked_by` | — | `route_passenger_attendance` (UPSERT) | Marks a passenger as present/absent/late/excused |
| `report_vehicle_breakdown` | `p_route_session_id`, `p_description`, `p_location` | `route_sessions`, `routes`, `vehicles` | `vehicles` (off_the_road=TRUE), `vehicle_updates`, `route_updates`, `vehicle_breakdowns`, `notifications` | Driver reports breakdown → sets vehicle VOR + creates admin notification |
| `assign_replacement_vehicle` | `p_breakdown_id`, `p_replacement_vehicle_id` | `vehicle_breakdowns`, `vehicles` | `vehicle_breakdowns`, `routes`, `route_updates`, `vehicle_updates` | Admin assigns replacement → updates route's vehicle |
| `find_replacement_vehicle` | `p_vehicle_id` | `vehicles`, `vehicle_seating_plans`, `route_sessions`, `routes` | — | Finds available spare vehicles with matching capacity. Returns exact match first, then closest |
| `find_substitution_vehicles` | `p_vehicle_id` | `vehicles`, `vehicle_seating_plans`, `route_sessions`, `routes` | — | Similar to `find_replacement_vehicle` but also returns non-spare vehicles |
| `update_vehicle_seating_plan` | `p_vehicle_id`, `p_name`, `p_total_capacity`, `p_rows`, `p_seats_per_row`, `p_wheelchair_spaces`, `p_notes` | `vehicles` | `vehicle_seating_plans` | Deactivates old plan, creates new active plan |
| `assign_passenger_to_seat` | `p_route_session_id`, `p_passenger_id`, `p_seat_number`, `p_seat_type`, `p_notes` | `route_sessions`, `passengers` | `route_session_seat_assignments` (UPSERT) | Assigns passenger to seat for a session |
| `unassign_passenger_seat` | `p_route_session_id`, `p_passenger_id` | — | `route_session_seat_assignments` (DELETE) | Removes seat assignment |
| `generate_route_sessions_next_45_weekdays` | — | `routes` | `route_sessions` | Bulk-generates future sessions for all active routes. ON CONFLICT DO NOTHING |
| `send_admin_broadcast` | `p_audience_type`, `p_title`, `p_body_md`, `p_target_user_id?`, `p_route_id?` | `user_roles`, `role_permissions`, `permissions`, `roles`, `parent_contacts`, `drivers`, `employees`, `passenger_assistants`, `route_points`, `passengers`, `passenger_parent_contacts`, `routes` | `notifications` | Sends broadcast to: single user, route parents, route crew, all parents, all drivers, all PAs. **RBAC-checked inside the function** |
| `create_cert_expiry_reminders` | — | `vehicles`, `drivers`, `employees`, `passenger_assistants`, `subject_documents`, `document_requirements`, `notifications` | `notifications` | Cron-called daily. Inserts `cert_expiry_reminder` notifications with dedup check |
| `update_expiry_flags` | — | `vehicles`, `drivers`, `employees`, `passenger_assistants` | `vehicles.off_the_road`, `employees.can_work` | Cron-called daily. Re-scans all expiry dates and flips flags. Safety net if trigger missed a change |
| `export_tas5_rows` | `p_school_id` | `routes`, `schools`, `vehicles`, `vehicle_seating_plans`, `drivers`, `employees`, `passenger_assistants` | — | Returns data for TAS5 form export |

---

### 12.3 Edge Functions

> **How to call:** `POST https://ilpfknjpfmgvzjafqtls.supabase.co/functions/v1/{name}`
> **How to find:** `supabase/functions/` folder in this repo

5 functions deployed as of 24 April 2026.

| Function | Triggered By | Reads From | Writes To | Notes |
|----------|-------------|-----------|----------|-------|
| `samsara-location-webhook` | HTTP POST (VPS poller, every ~5s) | Samsara API (external) | `vehicles_realtime` | Fetches live GPS data from Samsara and updates `vehicles_realtime`. The main WAL pressure source. |
| `samsara-fuel-snapshot` | HTTP POST (scheduled?) | Samsara API (external) | `vehicle_fuel_distance` | Snapshots fuel and mileage data from Samsara |
| `cancel-trip` | HTTP POST (from dashboard/app) | `route_sessions` | `route_sessions`, `notifications` | Cancels a session; inserts `trip_cancellation` notification for each parent on the route |
| `restore-trip` | HTTP POST (from dashboard/app) | `route_sessions` | `route_sessions`, `notifications` | Restores a cancelled session; inserts `trip_restored` notification |
| `push-notification-relay` | **DB trigger on `notifications` INSERT** (via `net.http_request`) | `notifications` | Firestore (external), FCM (external) | Reads the newly inserted notification, builds FCM payload, delivers push. If `notification_type` has no `case` in `buildMessage()`, push is silently skipped. |

---

### 12.4 Scheduled Cron Jobs

> **How to find:** Supabase Dashboard → Database → Cron Jobs (pg_cron extension)

5 jobs as of 24 April 2026.

| Job Name | Schedule | Command | Status | Notes |
|----------|----------|---------|--------|-------|
| `cert-expiry-reminders` | `0 0 * * *` (daily midnight) | `SELECT create_cert_expiry_reminders()` | ✅ Active | Generates compliance expiry notifications |
| `update-expiry-flags` | `0 0 * * *` (daily midnight) | `SELECT update_expiry_flags()` | ✅ Active | Rescans all expiry dates, flips `off_the_road` / `can_work` |
| `telematics-history-retention` | `0 2 * * *` (daily 2am) | `DELETE FROM vehicle_telematics_history WHERE telematics_timestamp < now() - 90 days` | ✅ Active | Cleans up old telemetry — keeps last 90 days |
| `samsara-poll-on-minute` | `* * * * *` (every minute) | Calls `samsara-location-webhook` Edge Function | ❌ **INACTIVE** | Was the original Samsara poller. Replaced by VPS external poller |
| `samsara-poll-half-minute` | `* * * * *` (every minute) | `pg_sleep(30)` then calls `samsara-location-webhook` | ❌ **INACTIVE** | **This is the source of 31% DB compute waste** — the `pg_sleep(1)` seen in performance advisor is this job's blocking sleep. Disabled but still occupying a slot |

> **Action required:** Delete `samsara-poll-half-minute` and `samsara-poll-on-minute` cron jobs from Supabase Dashboard → Database → Cron Jobs. They are inactive but the `pg_sleep` pattern was consuming 31% of DB query time when active — leave no risk of accidental re-enablement.

---

### 12.5 Key Next.js API Routes (Dashboard-Only Logic)

> **Note:** These routes are only accessible to the dashboard. The mobile app cannot use them (cookie-based auth). Any feature needed on mobile must use RPCs or Edge Functions instead.

| Route | Method | Tables Touched | Notes |
|-------|--------|----------------|-------|
| `app/api/audit/route.ts` | POST | READ `users`, WRITE `audit_log` | Logs general actions. ⚠️ Skips audit if user not in legacy `users` table |
| `app/api/route-sessions/[id]/stop-event/route.ts` | POST | READ `employees`, `route_sessions`, WRITE `route_stop_events` | Records a stop event — **but `route_stop_events` is dead (0 rows)**. The `trg_notify_parent_on_stop_event` trigger fires here but the data never arrives. This is why parent stop notifications don't work. |
| `app/api/agreements/route.ts` | POST | WRITE `agreements`, `notifications` | Creates agreements + notifies parties |
| `app/api/appointments/slots/route.ts` | GET/POST | READ/WRITE `appointment_slots`, `employees`, `users` | Appointment slot management |
| `app/api/appointments/book/route.ts` | POST | READ/WRITE `appointment_bookings`, `appointment_slots`, `vehicles`, `employees`, WRITE `notifications`, `system_activities` | Books an appointment slot |
| `app/api/tardiness/route.ts` | POST | WRITE `tardiness_reports`, `notifications` | Records tardiness, creates `driver_tardiness` notification |

---

### 12.6 How Computed Flags Are Written

#### 12.6.1 `employees.can_work`

This field is confusing because **three independent systems all write to it**. When debugging "why is this employee blocked?", check all three:

```
System 1 — DB Trigger (legacy, fires on INSERT only):
  INSERT drivers → trigger_update_driver_expiry
    Reads: drivers.tas_badge_expiry_date only
    Writes: employees.can_work = TRUE/FALSE

System 2 — DB Trigger (fires on subject_documents change):
  INSERT/UPDATE/DELETE subject_documents → trigger_recompute_subject_documents
    Calls: recompute_employee_can_work(employee_id)
    Reads: subject_documents (the correct source of truth)
    Writes: employees.can_work

System 3 — Cron Job (daily midnight safety net):
  update_expiry_flags()
    Reads: drivers.* expiry columns + passenger_assistants.* expiry columns (legacy)
    Writes: employees.can_work

⚠️ System 1 and 3 read legacy columns on drivers/passenger_assistants.
   System 2 reads subject_documents.
   If the two systems disagree, the last writer wins — which depends on execution order.
   The correct source of truth is System 2 (subject_documents).
```

#### 12.6.2 `vehicles.off_the_road`

Same problem as `can_work` — three writers:

```
System 1 — DB Trigger (fires on vehicle INSERT/UPDATE):
  INSERT/UPDATE vehicles → trigger_vehicle_expiry_check
    Reads: vehicles.plate_expiry_date, insurance_expiry_date, mot_date,
           tax_date, loler_expiry_date, first_aid_expiry, fire_extinguisher_expiry
    Writes: vehicles.off_the_road

System 2 — DB Trigger (fires on subject_documents change):
  INSERT/UPDATE/DELETE subject_documents → trigger_recompute_subject_documents
    Calls: recompute_vehicle_operational(vehicle_id)
    Reads: subject_documents
    Writes: vehicles.off_the_road

System 3 — Cron Job (daily midnight safety net):
  update_expiry_flags()
    Reads: same vehicles expiry columns as System 1
    Writes: vehicles.off_the_road

Also: report_vehicle_breakdown() RPC manually sets off_the_road = TRUE.
```

---

## 13. Infrastructure, Deployment & Operations (28 April 2026)

### 13.1 Current Deployment — Hostinger VPS (KVM1)

**How it works today:**
1. Developer pushes to `main` branch on GitHub
2. Developer SSH's into the VPS and runs `git pull`
3. `npm run build` is run manually on the server
4. PM2 restarts the Next.js process
5. Secrets are typed manually into `.env` on the server

**The server is running:**
- Next.js on port 3000, bound to `0.0.0.0` (accessible as `http://server_ip:3000`)
- No HTTPS
- No reverse proxy (no nginx/caddy)
- No firewall (no UFW/iptables rules)
- No zero-downtime deploy (PM2 restart = brief downtime on every deploy)
- No rollback mechanism (one bad deploy breaks production instantly)

**Risk inventory:**

| Risk | Severity | Impact |
|---|---|---|
| No HTTPS | Critical | All cookies, session tokens, form data sent in plaintext. Network attacker can steal admin sessions. |
| Port 3000 exposed directly | High | No rate limiting, no DDoS mitigation, port scanners find it immediately |
| No firewall | High | All ports open to the internet by default |
| Manual `.env` management | Medium | Secrets can be lost, accidentally shared, or differ between deploys |
| Manual deploy process | Medium | Build failures break production mid-deploy. No staging gate. |
| PM2 with no health check | Low | Process death not automatically reported |

**Immediate fixes (can be done in a day):**
```bash
# 1. Install nginx and certbot (Let's Encrypt free SSL)
sudo apt install nginx certbot python3-certbot-nginx

# 2. Get a domain name pointed at the VPS IP — required for Let's Encrypt
# 3. Generate SSL cert
sudo certbot --nginx -d yourdomain.com

# 4. Configure nginx to reverse-proxy to port 3000
# nginx forwards :443 → localhost:3000, handles TLS termination

# 5. Close port 3000 from public internet
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP (redirects to HTTPS)
sudo ufw allow 443   # HTTPS
# Port 3000 is NOT listed = not accessible from outside
```

**Result:** Users access `https://yourdomain.com` only. Port 3000 is localhost-only. nginx handles SSL.

**Recommended alternative — Coolify (self-hosted PaaS on the same VPS):**

Instead of manually managing nginx, certbot, PM2, and deploys, install [Coolify](https://coolify.io) on the VPS. Coolify is an open-source self-hosted platform (like Heroku/Render but on your own server) that handles:

| Manual approach | Coolify equivalent |
|---|---|
| nginx config + certbot | Automatic HTTPS via Traefik + Let's Encrypt |
| `git pull` + `npm run build` + `pm2 restart` | Git push → auto-deploy (GitHub webhook) |
| Manual `.env` editing on server | Secrets UI in Coolify dashboard |
| PM2 process monitoring | Container health checks + auto-restart |
| No rollback | One-click rollback to previous deploy |

```bash
# Install Coolify on the VPS (one command)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
# Then access https://vps_ip:8000 to set up via web UI
```

After setup: connect GitHub repo → set environment variables in UI → every push to `main` auto-builds and deploys. HTTPS is automatic once a domain is pointed at the VPS.

**Self-hosted Supabase on the VPS (future option):**
Coolify can also deploy a self-hosted Supabase instance (it's in the Coolify template library). This would eliminate the free plan limits entirely and give full PITR control. Appropriate to consider if/when the project outgrows the free Supabase cloud plan. Not urgent now — cloud Supabase is simpler to maintain.

---

#### 13.1.1 Staging Environment — Subdomain on Same VPS

The staging deployment lives on the same VPS, managed by Coolify as a second application. No separate server required.

```
senfleetmanager.com          → Coolify App A → Supabase prod project (ilpfknjpfmgvzjafqtls)
stage.senfleetmanager.com    → Coolify App B → Supabase staging project (separate project)
```

**DNS:** Add an A record for `stage.senfleetmanager.com` pointing at the same VPS IP. Coolify's Traefik proxy routes traffic by hostname — no nginx changes needed.

**HTTPS:** Automatic via Coolify + Let's Encrypt. Both domains get separate certificates.

**Branch strategy:**
```
main      → Coolify auto-deploys to senfleetmanager.com     (production)
staging   → Coolify auto-deploys to stage.senfleetmanager.com (staging)
```

PRs merge: `feature/x` → `staging` (auto-deploys, test it) → `main` (after sign-off). Migration always applies to staging DB first.

**Staging banner** (always visible, cannot be hidden):
```tsx
// app/layout.tsx
{process.env.NEXT_PUBLIC_ENV === 'staging' && (
  <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white text-center text-sm py-1 font-bold pointer-events-none select-none">
    ⚠ STAGING ENVIRONMENT — Not real data
  </div>
)}
```
Set `NEXT_PUBLIC_ENV=staging` in Coolify's env var panel for the staging app. Production has it unset — banner never appears.

**Why not Vercel:** Production runs on the VPS. Running staging on a different platform (Vercel) would mean different Node versions, different network paths, and a "works on Vercel, breaks on VPS" class of surprises. Same infrastructure for both = what passes staging passes production.

--- — Cookies vs JWT

**Current approach: httpOnly cookies via `@supabase/ssr`**

This is **correct and more secure** than storing JWTs in localStorage. The Supabase session *is* a JWT — `@supabase/ssr` simply stores it in an httpOnly cookie so JavaScript cannot read it.

| | httpOnly Cookie (current) | JWT in localStorage (alternative) |
|---|---|---|
| XSS attack steals session? | ❌ No — JS cannot read httpOnly cookie | ✅ Yes — `localStorage.getItem('token')` |
| CSRF attack possible? | ⚠️ Yes — mitigated by Supabase's SameSite cookie setting | ❌ No |
| Flutter/mobile can use? | ❌ No — cookies are browser-only | ✅ Yes — Bearer header |

**Why cookies for dashboard and JWT for Flutter is the correct split:**
- Dashboard (browser) → httpOnly cookie = XSS protection ✅
- Flutter (mobile) → Bearer JWT in Authorization header = no cookie jar needed ✅

**Supabase does provide refresh tokens.** The session object contains:
```json
{
  "access_token": "eyJ...",        // short-lived JWT (1 hour default)
  "refresh_token": "...",          // long-lived, rotated on use
  "expires_in": 3600
}
```
`@supabase/ssr` handles automatic token refresh via the cookie. Flutter uses `supabase.auth.currentSession` which also auto-refreshes. No manual JWT management required on either platform.

**No change needed** to the auth mechanism. The only auth-related problem is that the transport is HTTP (see 13.1) — fix HTTPS first and the cookie becomes secure.

---

### 13.3 ApiDog Collection — MCP Integration Strategy

**ApiDog MCP server** is available and can be connected to VS Code's Copilot agent. Once configured, AI can read and write the collection directly from the IDE without leaving VS Code.

**Configuration** (add to `.vscode/mcp.json`):
```json
{
  "servers": {
    "apidog": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@apidog/mcp-server-apidog", "--project-id", "YOUR_PROJECT_ID"],
      "env": {
        "APIDOG_ACCESS_TOKEN": "${input:apidogAccessToken}"
      }
    }
  },
  "inputs": [
    {
      "id": "apidogAccessToken",
      "type": "promptString",
      "description": "ApiDog personal access token",
      "password": true
    }
  ]
}
```
Get your project ID from ApiDog → Project Settings. Get your access token from ApiDog → Account Settings → API Access Token.

**What each endpoint entry should document:**

| Field | Content |
|---|---|
| Name | `POST /api/tardiness` or `RPC report_vehicle_breakdown` |
| Description | What the operation does, who can call it, what side effects it has |
| Auth | `Bearer {{access_token}}` or `apikey {{anon_key}}` |
| Request body | Every field with type, required/optional, validation rules |
| Response 200 | Full example JSON |
| Response 400/401/403/500 | What causes each, what the body looks like |
| **RLS policies** | Which policies apply — who can SELECT/INSERT/UPDATE/DELETE |
| **Triggers that fire** | Every DB trigger the operation touches, in order |
| **RPCs called** | If it's an Edge Function or API route that calls an RPC |
| **Tables written** | All tables the operation modifies |

This strategy is good — it means anyone (backend dev, Flutter dev, tester) can open ApiDog and understand the complete behaviour of an endpoint without reading source code.

---

### 13.4 Supabase Free Plan — Constraints & Testing Strategy

**Free plan limits (as of 2026):**
| Resource | Free limit | Impact |
|---|---|---|
| Database size | 500 MB | Not a concern yet |
| Realtime connections | 200 concurrent | Fine for current scale |
| Edge Function invocations | 500,000 / month | Fine |
| **Active projects** | **2** | Enough for prod + 1 staging |
| Supabase Branches | ❌ Pro plan only | Can't use branches — use second project |
| Log retention | 1 day | Pain for debugging — no history |
| PITR (point-in-time recovery) | ❌ Pro plan only | One bad migration = data loss |

**Biggest real risk on free plan:** No PITR. A destructive migration has no automatic rollback. Always backup before applying DDL:
```bash
# Before any migration
supabase db dump --project-ref ilpfknjpfmgvzjafqtls > backup_$(Get-Date -Format "yyyyMMdd").sql
```

---

### 13.5 Testing Strategy — Full Stack

#### 13.5.1 Testing pyramid for this stack

```
           ┌─────────────────┐
           │   E2E / Playwright │  ← slowest, most realistic — test critical journeys
           ├─────────────────┤
           │  Integration / Newman  │  ← call real staging API, check real DB state
           ├─────────────────┤
           │   Unit (Edge Fn / Next.js)   │  ← fast, mocked Supabase client
           └─────────────────┘
```

#### 13.5.2 Backend unit testing — yes, Supabase supports it

**Option A — Local Supabase instance (recommended):**
```bash
# Requires Docker Desktop
supabase start          # spins up local Postgres + Auth + Storage + Edge Functions
supabase test db        # runs pgTAP SQL tests against local DB
supabase functions serve  # runs Edge Functions locally with hot reload
```
pgTAP lets you write SQL unit tests for RPCs and triggers:
```sql
-- supabase/tests/database/test_recompute_can_work.test.sql
SELECT plan(3);
SELECT ok(
  (SELECT can_work FROM employees WHERE id = 1),
  'employee should be can_work=true when all docs valid'
);
SELECT finish();
```

**Option B — Staging Supabase project:**
Create a second free project (`fleet-manager-staging`). Apply the same migrations. Run tests against it. No Docker required.

**Recommendation:** Use Option B first (zero setup cost), migrate to Option A when Docker is available on CI.

#### 13.5.3 Integration testing — Newman (Postman/ApiDog CLI)

Newman runs the ApiDog collection against the staging project automatically:
```bash
npm install -g newman
newman run docs/apidog/FleetManager.postman_collection.json \
  --environment staging.postman_environment.json \
  --reporters cli,json \
  --reporter-json-export results.json
```
Each request in the collection should have a **Tests** script that asserts the response:
```javascript
pm.test("Status is 200", () => pm.response.to.have.status(200));
pm.test("Returns notification id", () => {
  pm.expect(pm.response.json()).to.have.property("id");
});
```

#### 13.5.4 E2E testing — Katalon Studio / Playwright

**Recommended tool: Katalon Studio** (team's choice — no-code/low-code E2E, supports web + mobile, runs in CI).  
Alternative option: **Playwright** (code-first, TypeScript-native, easier GitHub Actions integration).

Both run against the full deployed staging environment (Next.js frontend + staging Supabase). Write tests for critical user journeys only at first:

1. Admin login → sees dashboard
2. Driver scans QR → trip starts
3. Upload compliance doc → employee `can_work` updates

**Do not automate E2E before staging environment is stable (Phase 3 prerequisite).**

#### 13.5.5 CI/CD pipeline (GitHub Actions)

Once the above exists, wire it into GitHub Actions:
```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build           # catches TypeScript errors
      - run: newman run docs/apidog/FleetManager.postman_collection.json
               --environment staging.env.json
  deploy:
    needs: test                       # deploy only if tests pass
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1  # SSH into VPS
        with:
          script: |
            cd /var/www/fleet-manager
            git pull origin main
            npm ci
            npm run build
            pm2 restart fleet-manager
```
This replaces the manual SSH → pull → build → restart process. A failed build or failing Newman tests blocks the deploy automatically.

---

### 13.6 Time Estimates

#### Phase 1 — Server hardening
- Install Coolify (or nginx + certbot manually), get a domain, configure HTTPS
- Enable UFW firewall, close port 3000 from public internet
- Move `.env` secrets into Coolify secrets UI or a password manager
- **No code changes to the application itself**

#### Phase 2 — Bug fixes
- Remove 4 competing-writer triggers (`trigger_driver_expiry_check`, `trigger_pa_expiry_check`, `trigger_vehicle_expiry_check`, `trigger_vehicle_expiry_check_insert`)
- Delete 3 dead-table triggers
- Fix `send_admin_broadcast` wrong JOIN for `route_crew`
- Fix `get_driver_dashboard_payload_by_email` to not join dead `vehicle_assignments`
- Secure `push-notification-relay` with `RELAY_SECRET` header check
- Delete 2 inactive cron jobs

#### Phase 3 — Set up staging environment
- Create second free Supabase cloud project (`fleet-manager-staging`)
- Apply all migrations to staging
- Create `seed.sql` with realistic fake data covering all active tables
- Create staging `.env` file, configure Newman environment file
- All future phases tested against staging before touching production

#### Phase 4 — Dead table cleanup
- 22 tables confirmed at 0 rows (see section 1.3)
- For each: search codebase for references → confirm no FK dependencies → write DROP TABLE migration
- Drop `parent_data` (3 rows, wrong column types, superseded by `parent_contacts`)
- Result: schema shrinks from ~100 tables to ~78, confusion significantly reduced

#### Phase 5 — Storage bucket migration ⚠️ SECURITY
> Cannot be deferred — personal data (DBS certificates, employee photos, compliance documents) is currently in public buckets accessible without authentication.
- Migrate files to 4-bucket private architecture (see section 3)
- Update all file URL references in code to use short-lived signed URLs generated server-side
- Set mime type + size limits on all buckets
- Delete old public buckets after migration verified

#### Phase 6 — RLS on exposed tables ⚠️ SECURITY
- 10 tables currently have no RLS (see section 2) — sensitive PII fully exposed to any anon key holder
- Each table needs: SELECT, INSERT, UPDATE, DELETE policies
- Must be written carefully — wrong RLS silently breaks queries
- Test each policy against staging before applying to production

#### Phase 7 — `drivers` / `passenger_assistants` column cleanup
- Both tables have ~40+ columns, majority are legacy duplicates of `employees.*` or `subject_documents`
- Remove columns that duplicate `employees.*` (`full_name`, `email`, `phone`)
- Remove entirely-null columns (`taxi_badge_expiry_date` etc.)
- Migrate any remaining compliance date data into `subject_documents` before dropping
- **Breaking change** — all queries referencing removed columns must be updated in the same PR

#### Phase 8 — Move misplaced business logic
- `record-stop-event` Edge Function (replaces dead API route, fixes parent stop notifications)
- `record-tardiness` Edge Function (replaces `/api/tardiness` — Flutter can't currently reach this)
- `submit-agreement` Edge Function (replaces `/api/agreements` — Flutter can't currently reach this)
- Each Edge Function: TypeScript validation + auth check + explicit DB writes (no hidden trigger dependency)
- Delete `trg_notify_parents_on_session_change` and `trg_notify_parent_on_stop_event` once replaced

#### Phase 9 — TypeScript types + ApiDog collection
- `supabase gen types typescript --project-id ilpfknjpfmgvzjafqtls > lib/supabase/database.types.ts`
- Add as `npm run types` script — run after every schema change
- Revise ApiDog collection against staging: fix broken endpoints, add RLS/trigger documentation per 13.3
- Configure ApiDog MCP in `.vscode/mcp.json`

#### Phase 10 — CI/CD pipeline
- GitHub Actions workflow: build → Newman integration tests → deploy via Coolify webhook or SSH
- Add pgTAP tests for the 3 most critical RPCs
- Add Katalon Studio smoke tests (admin login, QR scan flow) — Playwright is an alternative option if team prefers code-first
- Failed build or failed tests blocks deploy automatically

#### Phase 11 — Unify Document Management *(deferred — not blocking)*
> **For managers:** Today the system uses 8 separate tables to store one document record. After this phase it uses 2. This reduces confusion for developers, speeds up queries, and makes future document features far easier to build.

> **For engineers:** The 8-table document schema (`documents`, `subject_documents`, and 6 link tables) is technical debt but is functional. No live data is being harmed. Deferred until Phases 1–10 are stable.
- Consolidate into 2 tables (unified document store + requirements)
- Migrate all rows before dropping old tables
- Update all queries — large surface area, needs dedicated sprint
- Test thoroughly against staging before any production migration

#### Summary

> Estimates are in **UK working days (Monday–Friday)**. UK bank holidays are non-working days — May 26 (Spring Bank Holiday) is already excluded from the count. Annual leave is not individually modelled; the ~10 working days between technical completion (~1 August) and the committed delivery (mid-August) are intended to absorb planned leave and any rework.

| Phase | Work | Days | Starts | Ends |
|---|---|---|---|---|
| 1 — Server hardening | Coolify + HTTPS + firewall + subdomain | 2 | 30 Apr | 1 May |
| 2 — Bug fixes | Triggers, cron, RPC fixes, relay secret | 5 | 5 May | 9 May |
| 3 — Staging environment | Second Supabase project + seed + `stage.` subdomain | 4 | 12 May | 15 May |
| 4 — Dead table cleanup | Drop 22+ dead tables + 3 dead-table triggers | 4 | 16 May | 21 May |
| 5 — Storage buckets ⚠️ | Public → private + signed URLs | 7 | 22 May | 2 Jun |
| 6 — RLS ⚠️ | 10 exposed tables | 7 | 3 Jun | 11 Jun |
| 7 — Schema column cleanup | `drivers` / `passenger_assistants` column bloat | 5 | 12 Jun | 18 Jun |
| 8 — Edge Functions | 3 functions (stop-event, tardiness, agreements) | 8 | 19 Jun | 30 Jun |
| 9 — Types + ApiDog | Type gen + collection | 4 | 1 Jul | 4 Jul |
| 10 — CI/CD | GitHub Actions pipeline | 5 | 7 Jul | 11 Jul |
| 11 — Unify Document Management | Replace 8-table fragmented schema with 2-table unified store | 15 | 14 Jul | 1 Aug |
| **Total (Phases 1–11)** | | **66 working days** | **30 Apr** | **~1 Aug 2026** |

**Committed delivery date: mid-August 2026** — approximately 10 working days of buffer after technical completion for reviews, rework, and planned leave.

#### Milestones

| Date | What it means |
|---|---|
| End of May 2026 | Phases 1–4 done — server secured, staging live, dead code cleaned |
| Mid-June 2026 | Phases 5–6 done — all security gaps closed (storage private + RLS on all tables) |
| End of June 2026 | Phases 7–8 done — schema clean, 3 Edge Functions deployed, backend infrastructure complete |
| Mid-July 2026 | Phases 9–10 done — TypeScript types generated, ApiDog collection up to date, CI/CD running |
| ~1 August 2026 | All 11 phases technically complete |
| **Mid-August 2026** | **Committed delivery — platform is production-ready as a secure, testable, extensible foundation** |

> ⚠️ Phases 5 and 6 are security-critical. They must not slip past mid-June regardless of other pressures. Personal data (DBS certificates, employee photos) remains in public buckets until Phase 5 completes.

> Frontend and testing teams can begin parallel work from Phase 3 onwards, once the staging environment is live (mid-May). Backend phases are independent and do not block other teams after Phase 3.

---

### 13.7 Executive Summary

> Plain-language summary of the remediation plan for management and non-technical stakeholders.

**What was inherited:**
- Significant technical debt: security gaps, broken features, and logic hidden inside database triggers
- Personal data (DBS certificates, employee photos, compliance documents) in publicly accessible storage — no authentication required
- 10 database tables with no access control — any holder of the app key can read or modify sensitive records
- Business logic scattered across triggers, API routes, and functions with no consistent pattern
- No staging environment, no automated tests, no deployment pipeline

**What this plan delivers:**
- A stable, secure foundation before any new features are built
- All known security gaps closed (Phases 1–6)
- A clean, consistent, and testable backend (Phases 7–11)
- A reliable, testable, and extensible platform delivered by **mid-August 2026**

**The five phases in plain language:**

| Stage | Phases | What it means |
|---|---|---|
| Foundation | 1–4 | Secure the server, fix known bugs, set up staging, remove dead code |
| Security | 5–6 | Lock down personal data in storage and database |
| Infrastructure | 7–8 | Clean up the schema, move business logic where it belongs |
| Quality | 9–10 | Generate types, document the API, automate testing and deployment |
| Unify Document Management | 11 | Replace 8 fragmented tables with 2 — simpler, faster, easier to extend |

**On team parallelism:**
Backend work does not block other teams indefinitely. Once staging is live (mid-May, Phase 3), the frontend and testing teams can work in parallel against it.

**Known risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Storage migration (Phase 5) disrupts live file access | High — compliance documents stop loading | Migrate files first, switch URLs only after migration verified on staging |
| RLS (Phase 6) silently breaks queries if written incorrectly | High — screens go blank with no error message | Write every policy against staging first; test all CRUD operations before applying to prod |
| Phase 7 column removal is a breaking change | Medium — queries referencing removed columns fail | All code referencing removed columns updated in the same PR, build verified before merge |
| Supabase free plan — no PITR | Medium — one bad migration = data loss | DB dump before every DDL migration |
| E2E automation setup time | Low — slower Phase 10 start | Begin E2E test planning in Phase 3 (once staging is live) to avoid a bottleneck |

**Protecting the deadline:**
Every phase has a defined scope. The buffer built into mid-August is for review cycles and rework — not for adding scope. If a phase uncovers a larger problem than expected, it gets documented and scheduled separately rather than expanding the current phase.

---

### 13.8 Phase 12+ — Full Platform Cycle (Parallel Planning Track)

This planning track runs alongside Phases 1–11 and is not a dependency of the remediation work. The goal is that when the foundation is ready in mid-August, the team can move into feature delivery immediately — no planning gap.

The "full platform cycle" means every role and every workflow is operational end-to-end:

| Area | What "fully working" means |
|---|---|
| **People management** | Employees, drivers, PAs, managers — onboarding, compliance, role assignment all functional |
| **Parents & students** | Parent contacts, passengers, agreements, guardian linking — all data flowing |
| **Vehicles** | Full compliance tracking, VOR management, pre-checks, document expiry all live |
| **Routes** | Route creation, stop assignment, crew assignment, route spares all working |
| **Trip operations** | Driver QR login → pre-check → session start → stop events → attendance → session close |
| **Live tracking** | GPS feed (Samsara or device) → real-time vehicle position visible to dispatcher |
| **Parent notifications** | Real-time push: trip started, child picked up/dropped off, trip completed |
| **Flutter mobile apps** | Driver app + Parent app — login, QR, live status, notifications all end-to-end |

> Planning for Phase 12+ should begin no later than end of May 2026 so that designs and decisions are ready when Phase 10 completes.
