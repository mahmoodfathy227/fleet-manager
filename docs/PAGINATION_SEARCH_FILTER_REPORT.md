# Pagination, Search & Filtering — Full Implementation Report

> **Prepared for the Frontend Team**  
> **Date:** 14 April 2026  
> **Data source:** Live Supabase DB (`ilpfknjpfmgvzjafqtls`) + full codebase audit  
> **Base dashboard URL:** `https://your-domain.com/dashboard`  
> **Supabase REST base URL:** `https://ilpfknjpfmgvzjafqtls.supabase.co/rest/v1`

---

## TL;DR

| | |
|---|---|
| **Critical problem** | All main list pages load the entire table on every page load — no pagination anywhere. Some pages exceed 1,000 rows. |
| **Most urgent** | `parent_contacts` (1,170 rows, zero search/filter/pagination) |
| **Second most urgent** | `passengers` (676 rows, search exists but done in JavaScript memory — the DB query still returns all 676 before filtering) |
| **Already has search + filter** | Vehicles, Passengers, Drivers, Assistants, Routes, Schools, Employees, Incidents |
| **Has search/filter but also needs pagination** | All of the above — filtering works but pagination is missing everywhere |
| **No search, no filter, no pagination at all** | Parent Contacts, Call Logs |
| **Hard-capped arbitrarily** | Notifications (hard `.limit(100)` of 555 rows), Audit Log (hard `.limit(100)` of 2,010 rows) |
| **Backend work needed** | Zero new RPCs or migrations — Supabase PostgREST already supports `.range()` for pagination and `.ilike()` for search on all tables. The frontend just needs to pass the right query params. |
| **Recommended page size** | 25 rows for all tables |
| **Pattern to follow** | URL search params driven (`?page=2&search=john`) — works with Next.js `searchParams` prop, supports browser back/forward, shareable URLs |

---

## How Supabase Pagination Works (PostgREST)

PostgREST supports offset/limit pagination via the `.range(from, to)` method on the Supabase JS client, or via the `Range` HTTP header on direct REST calls.

**Supabase JS client (server component):**
```ts
// Page 1 = rows 0–24, Page 2 = rows 25–49, etc.
const PAGE_SIZE = 25
const page = 1 // comes from URL ?page=1
const from = (page - 1) * PAGE_SIZE        // 0
const to   = from + PAGE_SIZE - 1          // 24

const { data, count, error } = await supabase
  .from('table_name')
  .select('*', { count: 'exact' })   // count: 'exact' returns total row count
  .order('created_at', { ascending: false })
  .range(from, to)

// data    = array of rows for this page
// count   = TOTAL rows matching the query (for "Showing 1–25 of 1,170")
```

**The `count: 'exact'` flag is critical** — without it you cannot show "Page 3 of 47" or a total row count. It adds a `Prefer: count=exact` header to the request and returns the total in the response headers, which the JS client surfaces as `count`.

**Direct REST call (for reference):**
```
GET /rest/v1/table_name?select=*&order=created_at.desc
Range: 0-24
Prefer: count=exact
```

---

## Table-by-Table Report

---

### 1. Parent Contacts 🔴 CRITICAL

**Dashboard URL:** `/dashboard/parent-contacts`  
**Live rows:** **1,170**  
**Current state:** Loads ALL 1,170 rows on every page load. No search. No filter. No pagination.  
**Urgency:** Highest — this is the largest table with zero mitigation.

**Searchable columns (confirmed in DB):**
- `full_name` (varchar) — primary search field
- `phone_number` (varchar)
- `email` (varchar)
- `relationship` (varchar) — values like "Mother", "Father", "Guardian"

**Recommended filters:**
| Filter | Type | Values |
|--------|------|--------|
| Text search | Free text | Searches `full_name`, `phone_number`, `email` |
| Relationship | Dropdown | Mother / Father / Guardian / Other |

**How to implement with PostgREST:**

```ts
const PAGE_SIZE = 25
const from = (page - 1) * PAGE_SIZE
const to   = from + PAGE_SIZE - 1

let query = supabase
  .from('parent_contacts')
  .select(`
    *,
    passenger_parent_contacts(passenger_id)
  `, { count: 'exact' })
  .order('full_name')
  .range(from, to)

// Text search across name + phone + email
if (search) {
  query = query.or(
    `full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`
  )
}

// Relationship filter
if (relationship && relationship !== 'all') {
  query = query.eq('relationship', relationship)
}

const { data, count, error } = await query
// count = total rows matching, use for pagination UI
```

**Example URL params:**
```
/dashboard/parent-contacts?page=2&search=sarah&relationship=Mother
```

---

### 2. Passengers 🟠 HIGH

**Dashboard URL:** `/dashboard/passengers`  
**Live rows:** **676**  
**Current state:** `mobility_type` filter works at DB level. Text search on `full_name` is done **in JavaScript memory** (all 676 rows are fetched from DB before filtering). No pagination.  
**Problem with current approach:** On a slow connection, 676 rows are always transferred over the wire regardless of the search term.

**Searchable columns (confirmed in DB):**
- `full_name` (varchar) — **currently in-memory, must move to DB-level `.ilike()`**
- `school_id` (integer FK → `schools.name`)
- `route_id` (integer FK → `routes.route_number`)
- `mobility_type` (varchar) — values in DB: `Walker`, `Wheelchair`, `""` (empty)
- `gender` (varchar)

**Recommended filters:**
| Filter | Type | Values |
|--------|------|--------|
| Text search | Free text | `full_name` ilike |
| Mobility type | Dropdown | Walker / Wheelchair / Not set |
| School | Dropdown | Populated from `schools` table |
| Route | Dropdown | Populated from `routes` table |

**How to implement with PostgREST:**

```ts
// Move the name search to DB level — remove the in-memory filter entirely
const PAGE_SIZE = 25
const from = (page - 1) * PAGE_SIZE
const to   = from + PAGE_SIZE - 1

let query = supabase
  .from('passengers')
  .select('*, schools(name), routes(route_number)', { count: 'exact' })
  .order('id', { ascending: false })
  .range(from, to)

if (search) {
  query = query.ilike('full_name', `%${search}%`)  // ← move from in-memory to here
}

if (mobility_type && mobility_type !== 'all') {
  query = query.eq('mobility_type', mobility_type)
}

if (school_id) {
  query = query.eq('school_id', school_id)
}

if (route_id) {
  query = query.eq('route_id', route_id)
}

const { data, count, error } = await query
```

**Example URL params:**
```
/dashboard/passengers?page=1&search=emily&mobility_type=Wheelchair&school_id=3
```

> ⚠️ **Note for frontend dev:** The current code has a redundant in-memory filter after the DB query. When adding DB-level `.ilike()`, remove the `filtered.filter(...)` block that follows the query — otherwise results will be double-filtered.

---

### 3. Vehicles 🟡 MEDIUM

**Dashboard URL:** `/dashboard/vehicles`  
**Live rows:** **171**  
**Current state:** Search on `registration` works at DB level via `.ilike()`. Boolean filters (spare/VOR/lift) work at DB level. **No pagination.** At 171 rows this is not critical yet but will grow.

**Searchable columns (confirmed in DB):**
- `registration` (varchar) — **already implemented**
- `vehicle_identifier` (varchar) — **not yet implemented, should be added**
- `make` / `model` (varchar)
- `vehicle_type` (varchar) — values in DB: `PHV` (127), `PSV` (43)
- `vehicle_category` (text) — values in DB: `N1`, `M1`, `M2`, `Hackney_Carriage`
- `spare_vehicle` (boolean) — **already implemented**
- `off_the_road` (boolean) — **already implemented**
- `tail_lift` (boolean) — **already implemented**
- `council_assignment` (varchar)

**Recommended filters:**
| Filter | Type | Current status |
|--------|------|----------------|
| Text search | Free text | ✅ Exists (registration only) — extend to also cover `vehicle_identifier` |
| Spare? | Yes/No/All | ✅ Exists |
| VOR? | Yes/No/All | ✅ Exists |
| Has lift? | Yes/No/All | ✅ Exists |
| Vehicle type | Dropdown: PHV / PSV | ❌ Not implemented |
| Vehicle category | Dropdown: N1 / M1 / M2 / Hackney Carriage | ❌ Not implemented |

**How to add pagination + extend search:**

```ts
// In lib/supabase/vehicles.ts — extend the existing getVehicles() function
const PAGE_SIZE = 25
const from = (page - 1) * PAGE_SIZE
const to   = from + PAGE_SIZE - 1

let query = supabase
  .from('vehicles')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(from, to)

// Extend search to also cover vehicle_identifier
if (filters.search) {
  query = query.or(
    `registration.ilike.%${filters.search}%,vehicle_identifier.ilike.%${filters.search}%`
  )
}

// New: vehicle_type filter
if (filters.vehicle_type && filters.vehicle_type !== 'all') {
  query = query.eq('vehicle_type', filters.vehicle_type)
}

// New: vehicle_category filter
if (filters.vehicle_category && filters.vehicle_category !== 'all') {
  query = query.eq('vehicle_category', filters.vehicle_category)
}

// Existing boolean filters stay the same
```

**Example URL params:**
```
/dashboard/vehicles?page=1&search=AB12&is_vor=no&vehicle_type=PHV&vehicle_category=M1
```

---

### 4. Routes 🟡 MEDIUM

**Dashboard URL:** `/dashboard/routes`  
**Live rows:** **164**  
**Current state:** Text search is parsed from URL params but the DB query ignores it — the filter is applied **entirely in JavaScript memory** (the comment in the code literally says "We'll filter in memory"). All 164 rows always fetched. No pagination.

**Searchable columns (confirmed in DB):**
- `route_number` (varchar) — **currently in-memory, move to DB**
- `schools.name` (via FK) — requires `.ilike()` on the related table or in-memory

**Recommended filters:**
| Filter | Type | Values |
|--------|------|--------|
| Text search | Free text | `route_number` ilike (DB-level) |
| School | Dropdown | Populated from `schools` table |
| Has priority vehicle | Yes/No | `priority_vehicle` boolean |

**How to implement with PostgREST:**

```ts
const PAGE_SIZE = 25
const from = (page - 1) * PAGE_SIZE
const to   = from + PAGE_SIZE - 1

let query = supabase
  .from('routes')
  .select('*, schools(name)', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(from, to)

// Move from in-memory to DB level for route_number
if (search) {
  query = query.ilike('route_number', `%${search}%`)
  // Note: school name search still needs in-memory or a separate school_id filter
  // Recommended: replace free-text school search with a school_id dropdown filter
}

if (school_id) {
  query = query.eq('school_id', school_id)
}

const { data, count, error } = await query
```

> ⚠️ **Note:** Searching by school name via PostgREST across a FK join is not straightforward with `.ilike()`. The recommended fix is to replace the "search by school name" text approach with a **School dropdown filter** that passes `school_id` — this is both more reliable and better UX.

**Example URL params:**
```
/dashboard/routes?page=2&search=R07&school_id=5
```

---

### 5. Employees 🟢 LOW-MEDIUM

**Dashboard URL:** `/dashboard/employees`  
**Live rows:** **43**  
**Current state:** DB-level `.ilike()` on `full_name`. DB-level `.eq()` filters for `role`, `employment_status`, `can_work`. **No pagination.** 43 rows is manageable but needs pagination for consistency and future growth.

**Recommended filters (all already implemented):**
| Filter | Type | Values |
|--------|------|--------|
| Text search | Free text | `full_name` ilike ✅ |
| Role | Dropdown | Driver / Passenger Assistant / etc. ✅ |
| Status | Dropdown | Active / Inactive ✅ |
| Can work | Yes/No | Boolean ✅ |

**How to add pagination (only missing piece):**

```ts
// In the getEmployees() function — just add .range() and count: 'exact'
const { data, error } = await query
  .order('created_at', { ascending: false })
  .range(from, to)   // ← add this

// Change .select() to:
.select('...existing select string...', { count: 'exact' })  // ← add count
```

**Example URL params:**
```
/dashboard/employees?page=1&search=john&role=driver&status=Active
```

---

### 6. Drivers 🟢 LOW

**Dashboard URL:** `/dashboard/drivers`  
**Live rows:** **11** (currently small but will grow)  
**Current state:** URL params parsed correctly. All filtering done **in JavaScript memory** — the DB query fetches all rows and then filters in JS. No pagination.

**Why in-memory is a problem here:** Drivers join to the `employees` table. PostgREST supports filtering on FK relationships, which should replace the in-memory approach.

**Recommended filters:**
| Filter | Type | Values |
|--------|------|--------|
| Text search | Free text | `employees.full_name` — move to DB via `employees.full_name.ilike.%X%` |
| Status | Dropdown | Active / Inactive |
| Can work | Yes/No | Boolean |

**How to fix with PostgREST:**

```ts
// Replace in-memory filtering with DB-level filtering via the FK relationship
let query = supabase
  .from('drivers')
  .select('*, employees!inner(full_name, phone_number, employment_status, can_work)', { count: 'exact' })
  .range(from, to)

// Filter on the joined employees table
if (search) {
  query = query.ilike('employees.full_name', `%${search}%`)
}

if (status && status !== 'all') {
  query = query.eq('employees.employment_status', status)
}

if (can_work === 'yes') {
  query = query.eq('employees.can_work', true)
} else if (can_work === 'no') {
  query = query.eq('employees.can_work', false)
}
```

> ⚠️ **Note:** Using `!inner` on the join means only drivers who have an employee record are returned (which is correct). Remove all in-memory `.filter()` blocks after adding DB-level filters.

**Example URL params:**
```
/dashboard/drivers?page=1&search=james&status=Active&can_work=yes
```

---

### 7. Passenger Assistants (PAs) 🟢 LOW

**Dashboard URL:** `/dashboard/assistants`  
**Live rows:** **7** (currently very small)  
**Current state:** Same pattern as Drivers — all filtering in JavaScript memory. No pagination.

**Recommended filters (same as Drivers):**
| Filter | Type |
|--------|------|
| Text search | `employees.full_name` |
| Status | Active / Inactive |
| Can work | Yes/No |

**How to fix:** Identical to the Drivers fix above — replace `in-memory` filters with DB-level filters on the `employees` FK join, add `.range()`, add `count: 'exact'`.

**Example URL params:**
```
/dashboard/assistants?page=1&search=anna&status=Active
```

---

### 8. Schools 🟢 LOW

**Dashboard URL:** `/dashboard/schools`  
**Live rows:** **21**  
**Current state:** DB-level `.ilike()` via `.or()` across `name` and `ref_number`. No pagination. 21 rows is fine for now but pagination should be added for consistency.

**Recommended filters:**
| Filter | Type | Current status |
|--------|------|----------------|
| Text search | Free text | ✅ Exists (searches `name` + `ref_number`) |
| Pagination | Page nav | ❌ Not implemented |

**How to add pagination:**

```ts
const { data, count, error } = await supabase
  .from('schools')
  .select('*', { count: 'exact' })   // ← add count: 'exact'
  .or(`name.ilike.%${search}%,ref_number.ilike.%${search}%`)
  .order('created_at', { ascending: false })
  .range(from, to)                   // ← add range
```

**Example URL params:**
```
/dashboard/schools?page=1&search=oakwood
```

---

### 9. Incidents 🟢 LOW

**Dashboard URL:** `/dashboard/incidents`  
**Live rows:** **4** (currently very small)  
**Current state:** `route_session_id` filter works at DB level. Text search (type, description, ref, employee, route) done in JavaScript memory. Status filter (open/resolved) in JavaScript memory. No pagination.

**Recommended filters:**
| Filter | Type | Current status |
|--------|------|----------------|
| Text search | Free text | ✅ Exists but in-memory |
| Status | Open / Resolved / All | ✅ Exists but in-memory |
| Route session | ID filter | ✅ Exists at DB level |

**How to move to DB level:**

```ts
let query = supabase
  .from('incidents')
  .select('*, employees(full_name), vehicles(vehicle_identifier), routes(route_number)', { count: 'exact' })
  .order('reported_at', { ascending: false })
  .range(from, to)

// Status at DB level
if (status === 'open') {
  query = query.eq('resolved', false)
} else if (status === 'resolved') {
  query = query.eq('resolved', true)
}

// Text search — cover incident_type and description at DB level
if (search) {
  query = query.or(
    `incident_type.ilike.%${search}%,description.ilike.%${search}%,reference_number.ilike.%${search}%`
  )
}
```

**Example URL params:**
```
/dashboard/incidents?page=1&search=tyre&status=open
```

---

### 10. Call Logs 🟡 MEDIUM (grows over time)

**Dashboard URL:** `/dashboard/call-logs`  
**Live rows:** **6** (currently small but will grow rapidly)  
**Current state:** No search. No filter. No pagination. All rows loaded.

**Searchable columns (confirmed in DB):**
- `caller_name` (varchar)
- `caller_phone` (varchar)
- `subject` (varchar)
- `call_type` (varchar) — values in DB: `Schedule Change`, `Inquiry`, `Compliment`, `Complaint` (expected)
- `priority` (varchar) — values: `Urgent`, `High`, `Medium`, `Low`
- `status` (varchar) — values: `Open`, `In Progress`, `Resolved`, `Closed`
- `action_required` (boolean)
- `follow_up_required` (boolean)
- `call_date` (timestamp) — date range filter

**Recommended filters:**
| Filter | Type | Values |
|--------|------|--------|
| Text search | Free text | `caller_name`, `subject` ilike |
| Call type | Dropdown | Schedule Change / Inquiry / Complaint / Compliment |
| Priority | Dropdown | Urgent / High / Medium / Low |
| Status | Dropdown | Open / In Progress / Resolved / Closed |
| Action required | Toggle | boolean |
| Date range | Date pickers | `call_date` between `from_date` and `to_date` |

**How to implement with PostgREST:**

```ts
const PAGE_SIZE = 20
const from = (page - 1) * PAGE_SIZE
const to   = from + PAGE_SIZE - 1

let query = supabase
  .from('call_logs')
  .select(`*, passengers(full_name), employees(full_name), routes(route_number)`, { count: 'exact' })
  .order('call_date', { ascending: false })
  .range(from, to)

if (search) {
  query = query.or(`caller_name.ilike.%${search}%,subject.ilike.%${search}%`)
}

if (call_type && call_type !== 'all') {
  query = query.eq('call_type', call_type)
}

if (priority && priority !== 'all') {
  query = query.eq('priority', priority)
}

if (status && status !== 'all') {
  query = query.eq('status', status)
}

if (action_required === 'true') {
  query = query.eq('action_required', true)
}

// Date range filter
if (date_from) {
  query = query.gte('call_date', date_from)  // e.g. "2026-04-01"
}
if (date_to) {
  query = query.lte('call_date', date_to + 'T23:59:59')
}
```

**Example URL params:**
```
/dashboard/call-logs?page=1&search=sarah&status=Open&action_required=true&date_from=2026-04-01
```

---

### 11. Notifications 🟡 MEDIUM

**Dashboard URL:** `/dashboard/notifications`  
**Live rows:** **555** — but currently hard-limited to 100 with `.limit(100)`. This means 455 notifications are silently hidden from admins.

**Confirmed notification types in DB:**
| Type | Count |
|------|-------|
| `cert_expiry_reminder` | 376 |
| `certificate_expiry` | 107 |
| `trip_cancellation` | 33 |
| `trip_restored` | 16 |
| `new_agreement` | 9 |
| `admin_broadcast` | 7 |
| `vehicle_breakdown` | 4 |
| `driver_tardiness` | 2 |
| `trip_started` | 1 |

**Searchable columns (confirmed in DB):**
- `notification_type` (varchar) — all types above
- `status` (varchar) — values: `pending`, `unread`, `read`
- `created_at` (timestamp) — date range
- `admin_response_required` (boolean)
- `recipient_user_id` (uuid) — filter to show admin-only (NULL) vs app-user notifications

**Recommended filters:**
| Filter | Type | Values |
|--------|------|--------|
| Notification type | Dropdown | All distinct types above |
| Status | Dropdown | pending / unread / read |
| Date range | Date pickers | `created_at` |
| Admin action required | Toggle | `admin_response_required = true` |

**How to replace the hard `.limit(100)` with proper pagination:**

```ts
// REMOVE: .limit(100)
// REPLACE WITH:
const PAGE_SIZE = 20
const from = (page - 1) * PAGE_SIZE
const to   = from + PAGE_SIZE - 1

let query = supabase
  .from('notifications')
  .select('*, recipient:recipient_employee_id(full_name, personal_email)', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(from, to)  // ← replaces .limit(100)

if (notification_type && notification_type !== 'all') {
  query = query.eq('notification_type', notification_type)
}

if (status && status !== 'all') {
  query = query.eq('status', status)
}

if (admin_action_required === 'true') {
  query = query.eq('admin_response_required', true)
}

if (date_from) {
  query = query.gte('created_at', date_from)
}
```

**Example URL params:**
```
/dashboard/notifications?page=3&notification_type=cert_expiry_reminder&status=pending
```

---

### 12. Audit Log 🟡 MEDIUM

**Dashboard URL:** `/dashboard/audit`  
**Live rows:** **2,010** — currently hard-limited to 100 with `.limit(100)`. 1,910 audit entries are completely invisible.

**Confirmed data breakdown in DB:**

Most-audited tables: `passengers` (847 entries), `vehicles` (736), `routes` (204), `employees` (76), `drivers` (52)

Action breakdown: `CREATE` (1,149), `UPDATE` (789), `DELETE` (74)

**Searchable columns (confirmed in DB):**
- `table_name` (varchar) — values: passengers, vehicles, routes, employees, drivers, etc.
- `action` (varchar) — `CREATE`, `UPDATE`, `DELETE`
- `change_time` (timestamp) — date range
- `changed_by` (integer FK → `users.email`)

**Recommended filters:**
| Filter | Type | Values |
|--------|------|--------|
| Table | Dropdown | passengers / vehicles / routes / employees / drivers / etc. |
| Action | Dropdown | CREATE / UPDATE / DELETE |
| Date range | Date pickers | `change_time` |

**How to replace the hard `.limit(100)` with proper pagination:**

```ts
// REMOVE: .limit(100)
// REPLACE WITH:
const PAGE_SIZE = 50  // audit logs are dense, 50 is fine
const from = (page - 1) * PAGE_SIZE
const to   = from + PAGE_SIZE - 1

let query = supabase
  .from('audit_log')
  .select('*, users(email)', { count: 'exact' })
  .order('change_time', { ascending: false })
  .range(from, to)  // ← replaces .limit(100)

if (table_name && table_name !== 'all') {
  query = query.eq('table_name', table_name)
}

if (action && action !== 'all') {
  query = query.eq('action', action)
}

if (date_from) {
  query = query.gte('change_time', date_from)
}
if (date_to) {
  query = query.lte('change_time', date_to + 'T23:59:59')
}
```

**Example URL params:**
```
/dashboard/audit?page=2&table_name=vehicles&action=UPDATE&date_from=2026-04-01
```

---

## Shared Pagination Component Spec

The frontend team should build one reusable `<PaginationBar>` component. It receives:

| Prop | Type | Description |
|------|------|-------------|
| `currentPage` | `number` | Current page (1-based) |
| `totalRows` | `number` | The `count` from Supabase query |
| `pageSize` | `number` | Rows per page (default 25) |

It should render:
- "Showing 26–50 of 1,170" label
- Previous / Next buttons
- Optional page number buttons for small result sets
- It updates `?page=N` in the URL (use `useRouter().push()` or `<Link>`)

**Pagination math:**
```ts
const totalPages = Math.ceil(totalRows / pageSize)
const showing_from = (currentPage - 1) * pageSize + 1
const showing_to = Math.min(currentPage * pageSize, totalRows)
// → "Showing 26–50 of 1,170"
```

---

## Summary Table

| Page | URL | Live Rows | Search | Filter | Pagination | Search Method | Priority |
|------|-----|-----------|--------|--------|------------|---------------|----------|
| Parent Contacts | `/dashboard/parent-contacts` | **1,170** | ❌ | ❌ | ❌ | — | 🔴 Critical |
| Passengers | `/dashboard/passengers` | **676** | ✅ | ✅ | ❌ | ⚠️ In-memory | 🟠 High |
| Notifications | `/dashboard/notifications` | **555** (100 shown) | ❌ | ❌ | ❌ (hard limit) | — | 🟠 High |
| Audit Log | `/dashboard/audit` | **2,010** (100 shown) | ❌ | ❌ | ❌ (hard limit) | — | 🟠 High |
| Routes | `/dashboard/routes` | **164** | ✅ | ❌ | ❌ | ⚠️ In-memory | 🟡 Medium |
| Vehicles | `/dashboard/vehicles` | **171** | ✅ | ✅ | ❌ | ✅ DB-level | 🟡 Medium |
| Employees | `/dashboard/employees` | **43** | ✅ | ✅ | ❌ | ✅ DB-level | 🟡 Medium |
| Call Logs | `/dashboard/call-logs` | **6** (grows fast) | ❌ | ❌ | ❌ | — | 🟡 Medium |
| Drivers | `/dashboard/drivers` | **11** | ✅ | ✅ | ❌ | ⚠️ In-memory | 🟢 Low |
| Assistants | `/dashboard/assistants` | **7** | ✅ | ✅ | ❌ | ⚠️ In-memory | 🟢 Low |
| Schools | `/dashboard/schools` | **21** | ✅ | ❌ | ❌ | ✅ DB-level | 🟢 Low |
| Incidents | `/dashboard/incidents` | **4** | ✅ | ✅ | ❌ | ⚠️ In-memory | 🟢 Low |

**Legend:**  
🔴 Critical — do first  
🟠 High — do second  
🟡 Medium — do when convenient  
🟢 Low — small tables, low urgency  
⚠️ In-memory = filter works in UI but all rows are fetched from DB first
