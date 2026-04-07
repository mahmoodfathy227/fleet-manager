# Agreements Feature — Developer Handoff

This document covers the full implementation of the **Agreements / Terms of Service** feature.

---

## Architecture note

> **All backend logic lives in Supabase.** Both the Flutter app and the Next.js dashboard call Supabase directly — there are no Next.js API routes for this feature. This ensures the mobile app is never coupled to the dashboard deployment.

| Operation | Mechanism | Who calls it |
|---|---|---|
| Publish agreement + bulk notify | RPC `publish_agreement(...)` | Dashboard |
| Archive agreement | RPC `archive_agreement(id)` | Dashboard |
| List all agreements | PostgREST `GET /rest/v1/agreements` | Dashboard |
| Get pending (mobile) | RPC `get_pending_agreements(user_id)` | Mobile app |
| Accept agreement (mobile) | PostgREST `POST /rest/v1/agreement_acceptances` | Mobile app |
| Acceptance stats | RPC `get_agreement_stats(id)` | Dashboard |

---

## Schema (migration 178)

```
agreements
  id            uuid        PK, DEFAULT gen_random_uuid()
  title         text        NOT NULL
  body          text        NOT NULL  — markdown
  type          text        NOT NULL  DEFAULT 'general'
                            values: general | terms_of_service | privacy_policy
                                    operational_notice | data_protection
  target_roles  text[]      NOT NULL  — ['parent', 'driver', 'passenger_assistant']
  is_active     boolean     NOT NULL  DEFAULT true
  created_by    uuid        → auth.users.id
  created_at    timestamptz NOT NULL  DEFAULT now()

agreement_acceptances
  id            uuid        PK
  agreement_id  uuid        NOT NULL → agreements.id  (CASCADE DELETE)
  user_id       uuid        NOT NULL → auth.users.id  (CASCADE DELETE)
  accepted_at   timestamptz NOT NULL  DEFAULT now()
  UNIQUE(agreement_id, user_id)
```

**`is_active` behaviour:** When `false`, the agreement is archived. Users who haven't accepted it will no longer see the popup. Existing acceptances are preserved for audit trail. Use `archive_agreement()` instead of deleting rows.

**Role resolution:**

| `target_roles` value | Maps to |
|---|---|
| `parent` | `parent_contacts.user_id` |
| `driver` | `employees JOIN drivers → employees.user_id` |
| `passenger_assistant` | `employees JOIN passenger_assistants → employees.user_id` |

---

## Supabase base URL

```
https://ilpfknjpfmgvzjafqtls.supabase.co
```

All calls require:
```
apikey: <anon_key>
Authorization: Bearer <supabase_jwt>
```

---

## Mobile Developer (Flutter)

### Login flow

```
Supabase sign-in
        │
        ▼
POST /rest/v1/rpc/get_pending_agreements
  body: { "p_user_id": "<current_user_id>" }
        │
        ├─ returns [] → proceed to home screen
        │
        └─ returns [...] → show blocking agreement popup(s) sequentially
             User reads → taps "I Agree"
                  │
                  ▼
             POST /rest/v1/agreement_acceptances
             Repeat for each item in the list
                  │
                  ▼
             All accepted → proceed to home screen
```

Show one agreement at a time. The list is ordered oldest-first. The user **cannot skip or dismiss** — they must accept each one before continuing.

---

### Push notification on publish

When an admin publishes a new agreement, all targeted users receive an FCM push:

```
notification.title: "Action required"
notification.body:  "There's a new [type] you need to review and agree to before continuing."

data.notification_type: "new_agreement"
data.agreement_id:      "<uuid>"
```

On tap → navigate to the pending agreements screen (or re-run the pending check on next foreground).

---

### Supabase calls

#### 1. Get pending agreements

```
POST https://ilpfknjpfmgvzjafqtls.supabase.co/rest/v1/rpc/get_pending_agreements
Content-Type: application/json

{ "p_user_id": "<supabase_auth_user_id>" }
```

Response — array of objects:
```json
[
  {
    "id": "uuid",
    "title": "Terms of Service – April 2026",
    "body": "## Terms\n\nBy using this service...",
    "type": "terms_of_service",
    "target_roles": ["parent", "driver"],
    "created_at": "2026-04-07T10:00:00Z"
  }
]
```

- Empty array = no popup needed.
- `body` is **markdown** — render with `flutter_markdown`.
- Show in returned order (oldest first, sequential).

#### 2. Accept an agreement

```
POST https://ilpfknjpfmgvzjafqtls.supabase.co/rest/v1/agreement_acceptances
Content-Type: application/json
Prefer: return=minimal

{
  "agreement_id": "<uuid>",
  "user_id": "<supabase_auth_user_id>"
}
```

- RLS enforces `user_id = auth.uid()` — cannot insert for another user.
- Idempotent — duplicate insert returns a `23505` conflict error which can be safely ignored.

---

### UI guidance

- **Full-screen blocking modal** — no close button, no swipe-to-dismiss, no back navigation.
- Render `body` as markdown (`flutter_markdown` package).
- Optional: disable "I Agree" button until the user has scrolled to the end.
- If the accept call fails, show a retry. Do not proceed without a success response.

---

## Dashboard Developer (Next.js)

All calls use the Supabase client (`supabase-js`). No Next.js API routes for this feature — call Supabase directly from the component or server action.

### 1. List all agreements

```typescript
const { data } = await supabase
  .from('agreements')
  .select('id, title, type, target_roles, is_active, created_by, created_at')
  .order('created_at', { ascending: false })
```

Admins have RLS access to all rows (active + archived). App users only see `is_active = true`.

---

### 2. Publish an agreement

```typescript
const { data: agreementId } = await supabase.rpc('publish_agreement', {
  p_title:        'Terms of Service – April 2026',
  p_body:         '## Terms\n\nBy using this service...',
  p_type:         'terms_of_service',       // optional, defaults to 'general'
  p_target_roles: ['parent', 'driver'],
})
// returns: uuid of the new agreement
```

| Param | Required | Notes |
|---|---|---|
| `p_title` | ✅ | Display name |
| `p_body` | ✅ | Markdown content |
| `p_type` | ❌ | Defaults to `general` |
| `p_target_roles` | ✅ | Non-empty array of role strings |

The RPC atomically:
1. Inserts the agreement row
2. Resolves all targeted user UUIDs from `parent_contacts` / `employees`
3. Bulk-inserts one `notifications` row per user (`notification_type = 'new_agreement'`)
4. The DB webhook fires → push-notification-relay → FCM push to each device

---

### 3. Archive an agreement

```typescript
await supabase.rpc('archive_agreement', {
  p_agreement_id: agreementId,
})
```

Sets `is_active = false`. Users who haven't accepted it will no longer see the popup. Existing acceptances are preserved.

---

### 4. Acceptance stats

```typescript
const { data } = await supabase.rpc('get_agreement_stats', {
  p_agreement_id: agreementId,
})
// data: { total_targeted: 60, total_accepted: 44 }
// percentage: Math.round(total_accepted / total_targeted * 100)
```

Denominator is **dynamic** — counts current users with a matching role who have a `user_id`. A newly onboarded driver increases the denominator and sees the popup on first login.

---

### Suggested dashboard UI

**Agreement list page** (`/dashboard/agreements`):
- Table/card per agreement
- Title + type badge (colour-coded chip)
- Target role chips: `Parent` · `Driver` · `PA`
- Progress bar: `44 / 60 (73%)`
- Status: Active / Archived
- Created by + date (use `formatDate()` from `@/lib/utils`)
- "New Agreement" button → publish form

**Agreement detail page**:
- Rendered markdown body
- Acceptance stats breakdown
- Archive button → `archive_agreement()`
- "Re-publish as new version" button → duplicates content into `publish_agreement()`, automatically archives the old one

**Publish form**:
- Title input
- Type dropdown (default `general`)
- Target roles multi-select: Parent / Driver / Passenger Assistant
- Markdown editor with preview tab (`@uiw/react-md-editor` or similar)
- Publish button

---

## Notes

- Agreements are **immutable** after publish. To update terms, archive the old one and publish a new one. This is the entire audit trail.
- `is_active = false` is the only way to retract an agreement. It does not delete acceptances.
- Push delivery is **best-effort** — no FCM token = silently skipped, but the user will still see the popup on next login via the pending check.
- The `new_agreement` notification type is handled by the push-notification-relay Edge Function. If you add new agreement-related notification types, add a `case` to `buildMessage()` in `supabase/functions/push-notification-relay/index.ts` and redeploy.
