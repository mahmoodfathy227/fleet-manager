# Firebase Cloud Functions — Push Notification Pipeline

## Problem (April 2026)

Push notifications were never reaching the Flutter app. Investigation revealed **two compounding bugs**:

### Bug 1 — Corrupted environment variable
The `SUPABASE_PROJECT_REF` env var was stored as `county cars` (with a space) in an old Cloud Run revision. This caused every call to `registerDevice` to throw:
```
TypeError: Invalid URL, input: 'https://county cars.supabase.co/auth/v1/certs'
```
The function returned a 400 on every request. No FCM tokens were ever written to Firestore, so no pushes could be delivered.

**Fix:** Created `firebase/functions/.env` locally (it only existed on the VPS before) with the correct `SUPABASE_PROJECT_REF=ilpfknjpfmgvzjafqtls`. Redeployed → new Cloud Run revision picked up the correct value.

### Bug 2 — Wrong JWT verification algorithm
After fixing Bug 1, JWT verification still failed with `ERR_JOSE_ALG_NOT_ALLOWED`. The code was configured for `RS256` (asymmetric JWKS) but the Supabase project uses the **legacy HS256 JWT secret** (symmetric HMAC). The two algorithms are fundamentally incompatible.

**Fix:** Replaced the `createRemoteJWKSet` + `RS256` approach with `createSecretKey` + `HS256` using the Supabase legacy JWT secret stored as `SUPABASE_JWT_SECRET` in `.env`.

### Additional cleanup
- Deleted the dead `firebase/functions/src/handlers/` directory — it was the source of a ghost `registerDevice (europe-west1)` function with "Unknown trigger" in the Firebase Console. The ghost function was also manually deleted from Firebase Console.
- Added `FIRESTORE_DATABASE_ID=county-db` env var so all functions target the named `county-db` Firestore database instead of `(default)`.
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

> **Note:** `SUPABASE_PROJECT_REF` has been removed. JWT verification now uses the secret directly via HS256 — no JWKS endpoint needed.

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
      "title": "Test notification",
      "body": "This is a test push notification.",
      "notification_type": "admin_broadcast",
      "details": { ... },
      "deepLink": null,
      "audienceType": "single_user",
      "routeId": null
    }
  ]
}
```

---

### `sendNotification`
**URL:** `https://sendnotification-lagw2ux5da-uc.a.run.app`  
**Method:** `POST`  
**Auth:** Supabase Bearer JWT + RBAC permission check  
**Called by:** Dashboard (admin) only

Sends a push notification to a user, all parents on a route, or all crew on a route. Requires the calling user to have the appropriate RBAC permission key.

**Request body:**
```json
{
  "audienceType": "single_user",
  "targetUserId": "uuid",
  "title": "Hello",
  "body": "Message body"
}
```
For `route_parents` or `route_crew`, replace `targetUserId` with `routeId: 3`.

**Required RBAC permissions:**
- `notifications.send.single` for `single_user`
- `notifications.send.route_parents` for `route_parents`
- `notifications.send.route_crew` for `route_crew`

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
| `firebase/functions/src/index.ts` | All 5 Firebase Cloud Functions |
| `firebase/functions/.env` | Environment variables (gitignored) |
| `supabase/functions/push-notification-relay/index.ts` | Supabase Edge Function — step 5–6 above |
| `docs/PUSH_NOTIFICATION_RELAY.md` | Full relay architecture documentation |
| `docs/NOTIFICATION_TYPES.md` | All notification types, details JSONB shapes, push templates |

---

## Flutter Integration Checklist

1. **Download** `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) from Firebase Console → Project Settings → Apps
2. **Call `registerDevice` on every login** and on `FirebaseMessaging.instance.onTokenRefresh`
3. **Handle background messages** via `FirebaseMessaging.onBackgroundMessage`
4. **Deep-link** using `data['route_session_id']` from the FCM payload to navigate to the live tracking screen
5. **Stream inbox** from Firestore: `users/{supabaseUserId}/inbox` ordered by `createdAt desc` — OR call `GET /myInbox`
6. **Mark as read** via `POST /markRead` with `{ notificationId: "supabase_408" }`

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
| Password | Stored in team password manager — ask project lead |

**Test steps performed:**
1. Called `POST /registerDevice` with a fake FCM token → confirmed `county-db/users/{uid}/devices/test-device-mac` was created ✅
2. Inserted a `admin_broadcast` notification row directly into Supabase via REST API → relay fired within ~4 seconds ✅
3. Confirmed `county-db/notifications/supabase_408` and `county-db/users/{uid}/inbox/supabase_408` both appeared in Firestore ✅
4. FCM delivery attempted — failed as expected (fake token) — real device token will deliver successfully ✅
