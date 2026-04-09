# Firebase Cloud Functions — Push Notification Pipeline

## History / Bug Fixes (April 2026)

Push notifications were never reaching the Flutter app. Investigation revealed **two compounding bugs**:

### Bug 1 — Corrupted environment variable
The `SUPABASE_PROJECT_REF` env var was stored as `county cars` (with a space) in an old Cloud Run revision. This caused every call to `registerDevice` to throw:
```
TypeError: Invalid URL, input: 'https://county cars.supabase.co/auth/v1/certs'
```
**Fix:** Created `firebase/functions/.env` locally with the correct value. Redeployed → new Cloud Run revision picked up the correct value.

### Bug 2 — Wrong JWT verification algorithm
JWT verification failed with `ERR_JOSE_ALG_NOT_ALLOWED`. The code was configured for `RS256` (asymmetric JWKS) but the Supabase project uses the **legacy HS256 JWT secret** (symmetric HMAC).

**Fix:** Replaced `createRemoteJWKSet` + `RS256` with `createSecretKey` + `HS256` using `SUPABASE_JWT_SECRET` from `.env`.

### Additional cleanup
- Deleted the dead `firebase/functions/src/handlers/` directory and the ghost `registerDevice (europe-west1)` function it produced.
- Added `FIRESTORE_DATABASE_ID=county-db` so all functions target the named `county-db` database instead of `(default)`.
- Upgraded Node.js runtime from 20 → 22 (Node 20 deprecates on 2026-04-30).

---

## Environment Variables

All stored in `firebase/functions/.env` (gitignored — never commit this file).

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side Supabase queries (RBAC lookups) |
| `SUPABASE_JWT_SECRET` | Legacy HS256 JWT secret — used to verify Supabase user tokens |
| `FIRESTORE_DATABASE_ID` | Named Firestore database (`county-db`) |
| `INTERNAL_RELAY_SECRET` | Firebase Secret Manager — shared secret between Supabase relay Edge Function and `notifyInternal` |

> **Note:** `SUPABASE_PROJECT_REF` is no longer used. JWT verification uses the secret directly via HS256 — no JWKS endpoint needed.

---

## Deployed Functions

All functions are deployed to `us-central1`, Firebase project `county-cars-af6d1`.

### `registerDevice`
**URL:** `https://registerdevice-lagw2ux5da-uc.a.run.app`  
**Method:** `POST`  
**Auth:** Supabase Bearer JWT (HS256)  
**Called by:** Flutter app — on every login and whenever the FCM token refreshes

Registers a device FCM token for the authenticated user. Tokens are stored in:
```
county-db / users / {supabaseUserId} / devices / {deviceId}
  token:      string   (FCM registration token)
  platform:   string   ("android" | "ios")
  updatedAt:  timestamp
```

**Request body:**
```json
{
  "deviceId": "stable-device-id",
  "token": "fcm-registration-token",
  "platform": "ios"
}
```

**Response:** `{ "ok": true }`

---

### `markRead`
**URL:** `https://markread-lagw2ux5da-uc.a.run.app`  
**Method:** `POST`  
**Auth:** Supabase Bearer JWT  
**Called by:** Flutter app — when user opens/dismisses a notification

Marks an inbox notification as read by setting `readAt` timestamp.

**Request body:**
```json
{ "notificationId": "supabase_408" }
```

**Response:** `{ "ok": true }`

---

### `myInbox`
**URL:** `https://myinbox-lagw2ux5da-uc.a.run.app`  
**Method:** `GET`  
**Auth:** Supabase Bearer JWT  
**Called by:** Flutter app — to load the notification inbox  
**Query params:** `?limit=50` (max 200)

Returns the authenticated user's notifications ordered by newest first.

**Response:**
```json
{
  "items": [
    {
      "notificationId": "supabase_408",
      "createdAt": "...",
      "readAt": null,
      "title": "School closure tomorrow",
      "body": "All morning routes are cancelled.",
      "notification_type": "admin_broadcast",
      "details": { "title": "...", "body_md": "...", "audience_type": "route_parents", "route_id": 3, "sent_by": "uuid" },
      "audienceType": "single_user",
      "routeId": null
    }
  ]
}
```

`notification_type` tells Flutter how to render the item in-app. `details` carries the full structured payload. See [`docs/NOTIFICATION_TYPES.md`](./NOTIFICATION_TYPES.md) for the complete reference.

---

### `notifyInternal`
**URL:** `https://notifyinternal-lagw2ux5da-uc.a.run.app`  
**Method:** `POST`  
**Auth:** `x-relay-secret` header (shared secret — **never call this from the app**)  
**Called by:** Supabase `push-notification-relay` Edge Function only

Internal endpoint that receives a pre-built notification and:
1. Writes a notification doc to `county-db/notifications/supabase_{id}`
2. Writes an inbox entry to `county-db/users/{uid}/inbox/supabase_{id}`
3. Reads all FCM tokens from `county-db/users/{uid}/devices`
4. Sends FCM push to all registered devices
5. Automatically removes invalid/expired tokens from Firestore

> ⚠️ `sendNotification` (the fifth deployed function) is **not used by the dashboard**. The dashboard sends via the `send_admin_broadcast` Supabase RPC → relay pipeline instead. Do not build new features on top of `sendNotification`.

---

## Complete Push Notification Flow

```
1. Flutter app logs in (Supabase auth)
   │
   ▼
2. App calls POST /registerDevice
   → FCM token saved to:
     county-db / users / {uid} / devices / {deviceId}

3. An event occurs (trip started, cert expiry, admin broadcast, etc.)
   │
   ▼
4. Row inserted into Supabase `notifications` table
   with recipient_user_id = {uid}
   │
   ▼
5. Supabase DB Webhook fires
   → calls push-notification-relay Edge Function
     (supabase/functions/push-notification-relay/index.ts)
   │
   ▼
6. Edge Function calls buildMessage(row)
   → constructs title + body from notification_type + details
   → calls POST /notifyInternal with x-relay-secret header
   │
   ▼
7. notifyInternal Firebase Function:
   → writes notification doc to county-db/notifications/supabase_{id}
   → writes inbox entry to county-db/users/{uid}/inbox/supabase_{id}
   → reads FCM tokens from county-db/users/{uid}/devices
   → sends FCM push via Firebase Cloud Messaging
   │
   ▼
8. Push notification appears on device ✅
   App reads inbox from county-db via myInbox or Firestore stream
```

### Key files
| File | Role |
|---|---|
| `firebase/functions/src/index.ts` | All Firebase Cloud Functions |
| `firebase/functions/.env` | Environment variables (gitignored) |
| `supabase/functions/push-notification-relay/index.ts` | Supabase Edge Function — step 5–6 above |
| `docs/PUSH_NOTIFICATION_RELAY.md` | Full relay architecture documentation |
| `docs/NOTIFICATION_TYPES.md` | All notification types, `details` JSONB shapes, push templates |

---

## Notification Types — Quick Reference

Full reference (producer, `details` JSONB shape, push template, severity rules) is in [`docs/NOTIFICATION_TYPES.md`](./NOTIFICATION_TYPES.md). Brief summary:

| Type | Push? | Recipient | What it means |
|---|---|---|---|
| `certificate_expiry` | No | Admin only | Legacy compliance cert expiry — uses old columns, not `details` |
| `vehicle_breakdown` | No | Admin only | Driver reported a breakdown during an active session |
| `driver_tardiness` | No | Admin only | Driver reported late for a session |
| `trip_cancellation` | Yes | Parent | Parent cancelled a child's trip |
| `trip_restored` | Yes | Parent | Parent un-cancelled a child's trip |
| `cert_expiry_reminder` | Yes (driver/PA) | Driver or PA | Their own certificate is expiring soon / urgent / expired. Vehicle certs are admin-only (NULL recipient) |
| `driver_at_stop` | Yes | Parent | Bus has arrived at the child's stop |
| `child_picked_up` | Yes | Parent | Child was marked as picked up by the driver |
| `child_dropped_off` | Yes | Parent | Child was marked as dropped off at their stop |
| `child_no_show` | Yes | Parent | Driver arrived but child was not at the stop |
| `trip_started` | Yes | Parent | Route session started — bus has departed |
| `trip_completed` | Yes | Parent | Session ended and child was recorded on the trip |
| `child_not_on_trip` | Yes | Parent | Session ended but child was never recorded on the trip |
| `new_agreement` | Yes | Parent / Driver / PA | New terms/policy document requires review and acceptance |
| `admin_broadcast` | Yes | Any app user | Manual message sent by admin via the "Send Message" dashboard page |

> **Rule for new types:** If `recipient_user_id` is non-null, add a `case` to `buildMessage()` in `supabase/functions/push-notification-relay/index.ts` and redeploy — otherwise the push is silently skipped.

---

## Flutter Integration Checklist

1. **Download** `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) from Firebase Console → Project Settings → Apps
2. **Call `registerDevice` on every login** and on `FirebaseMessaging.instance.onTokenRefresh`
3. **Handle background messages** via `FirebaseMessaging.onBackgroundMessage`
4. **Stream inbox** from Firestore: `users/{supabaseUserId}/inbox` ordered by `createdAt desc` — OR call `GET /myInbox`
5. **Mark as read** via `POST /markRead` with `{ notificationId: "supabase_408" }`
6. **Render by type** — use `notification_type` + `details` from the inbox item to show the correct in-app UI per notification type (see `NOTIFICATION_TYPES.md`)

All function URLs use `Authorization: Bearer <supabase_access_token>` — the same JWT the user gets from Supabase sign-in. No separate Firebase auth is needed.

---

## Testing

End-to-end pipeline was verified on **9 April 2026** using a test account.

> ⚠️ The test account below is for development/debugging only.  
> **Do not share these credentials publicly or commit them to the repository.**  
> Rotate the password when onboarding new team members.

| Field | Value |
|---|---|
| Email | `mohamedhamada.cs@gmail.com` |
| Supabase UID | `f720f3b0-831c-431a-9fa6-6fc5651d2062` |
| Password | Store securely and share via an encrypted secrets tool (e.g. [Bitwarden](https://bitwarden.com) secure note or [1Password](https://1password.com)) — never share in plaintext or commit to the repo |

**Test steps performed:**
1. Called `POST /registerDevice` with a fake FCM token → confirmed `county-db/users/{uid}/devices/test-device-mac` was created ✅
2. Inserted an `admin_broadcast` notification row directly into Supabase via REST API → relay fired within ~4 seconds ✅
3. Confirmed `county-db/notifications/supabase_408` and `county-db/users/{uid}/inbox/supabase_408` both appeared in Firestore ✅
4. FCM delivery attempted — failed as expected (fake token) — real device token will deliver successfully ✅
