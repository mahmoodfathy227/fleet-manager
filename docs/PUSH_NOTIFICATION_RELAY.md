# Automatic Push Notification Relay

This document describes the **automatic relay pipeline** that delivers push notifications to Flutter/mobile clients whenever a row is inserted into the `notifications` table in Supabase.

This is separate from the admin-initiated push system described in [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md).

---

## Architecture

```
notifications INSERT (Supabase DB)
        │
        ▼
DB Webhook: push_notification_relay trigger
        │
        ▼
push-notification-relay  (Supabase Edge Function)
  - skips rows where recipient_user_id IS NULL
  - buildMessage(row) → {title, body, data}
        │
        ▼
notifyInternal  (Firebase Cloud Function — internal, secret-gated)
  - writes Firestore: notifications/{supabase_{id}} + users/{uid}/inbox/{supabase_{id}}
  - sends FCM to all registered devices for the user
```

---

## Infrastructure

| Component | Value |
|-----------|-------|
| Supabase project | `ilpfknjpfmgvzjafqtls` (eu-central-1) |
| Firebase project | `county-cars-af6d1` |
| Firebase Functions URL | `https://us-central1-county-cars-af6d1.cloudfunctions.net` |
| Edge Function name | `push-notification-relay` |
| Firebase Function name | `notifyInternal` |
| DB Webhook name | `push_notification_relay` (on `notifications` table, INSERT) |

---

## Secrets

Both secrets must be set on **both** sides:

| Secret name | Set on | Purpose |
|-------------|--------|---------|
| `INTERNAL_RELAY_SECRET` | Firebase (`firebase functions:secrets:set`) + Supabase (`supabase secrets set`) | Authenticates Edge Function → notifyInternal calls |
| `FIREBASE_NOTIFY_URL` | Supabase only | Full URL to `notifyInternal` |
| `SUPABASE_URL` | Firebase only | Used for token verification in other functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Firebase only | Admin Supabase access inside Firebase Functions |

---

## Firestore Data Model

### Global notification doc
```
notifications/supabase_{id}
  supabase_id:        string     (Supabase notifications.id, stringified)
  notification_type:  string     (e.g. "child_picked_up")
  title:              string
  body:               string
  details:            map        (full JSONB mirror from Supabase notifications.details)
  data:               map        (extra key-value pairs for deep-linking)
  createdAt:          timestamp
```

### Per-user inbox entry
```
users/{supabaseUserId}/inbox/supabase_{id}
  supabase_id:        string
  notification_type:  string
  title:              string
  body:               string
  details:            map
  data:               map
  createdAt:          timestamp
  readAt:             timestamp | null
```

`supabaseUserId` = the Supabase `auth.users` UUID — this is `parent_contacts.user_id` for parents and `employees.user_id` for drivers/PAs.

---

## Notification Types Handled by Relay

Only rows where `recipient_user_id IS NOT NULL` are relayed. The following types currently have a non-null recipient:

| `notification_type` | Recipient | Title | Key `details` fields |
|---|---|---|---|
| `trip_cancellation` | Parent UUID | "Trip cancelled" | `route_name`, `session_type`, `date` |
| `trip_restored` | Parent UUID | "Trip restored" | `route_name`, `session_type`, `date` |
| `cert_expiry_reminder` | Employee UUID (or NULL for vehicles) | Dynamic per severity | `cert_name`, `expiry_date`, `severity`, `display_name`, `entity_type` |
| `driver_at_stop` | Parent UUID | "Bus arriving" | `passenger_name`, `stop_name`, `route_session_id` |
| `child_picked_up` | Parent UUID | "Child picked up" | `passenger_name`, `stop_name`, `route_session_id` |
| `child_dropped_off` | Parent UUID | "Child dropped off" | `passenger_name`, `stop_name`, `route_session_id` |
| `child_no_show` | Parent UUID | "Child not at stop" | `passenger_name`, `stop_name`, `route_session_id` |
| `trip_started` | Parent UUID | "Trip started" | `passenger_name`, `session_type`, `route_name`, `route_session_id` |
| `trip_completed` | Parent UUID | "Trip completed" | `passenger_name`, `session_type`, `route_name`, `route_session_id` |
| `child_not_on_trip` | Parent UUID | "Trip ended — child not recorded" | `passenger_name`, `session_type`, `route_name`, `route_session_id` |

`route_session_id` is included in the FCM `data` payload for deep-linking to the live tracking screen.

Types with `recipient_user_id = NULL` (admin-only) are **silently skipped** by the relay.

---

## FCM `data` Payload

The `data` map sent in the FCM message (available in both foreground and background):

```json
{
  "supabase_notification_id": "319",
  "notification_type": "child_picked_up",
  "route_session_id": "42"
}
```

Use `route_session_id` to deep-link directly to the live vehicle tracking screen for that session.

---

## Flutter Integration Guide

### 1. Firebase project setup

- Firebase project: `county-cars-af6d1`
- Download `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) from Firebase Console → Project Settings → Your apps
- Enable FCM in Firebase Console

### 2. Register device after login

After the user signs in with Supabase and you have their FCM token:

```
POST https://us-central1-county-cars-af6d1.cloudfunctions.net/registerDevice
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{
  "deviceId": "<stable-device-id>",
  "token": "<fcm-token>",
  "platform": "android"   // or "ios"
}
```

Call this once per login and whenever the FCM token refreshes (`FirebaseMessaging.instance.onTokenRefresh`).

The `supabaseUserId` is derived server-side from the JWT — no need to pass it explicitly.

### 3. Receiving notifications

The relay sends standard FCM messages with `notification` (title + body) and `data` fields. No special configuration is needed beyond standard FCM setup.

For background messages, register `FirebaseMessaging.onBackgroundMessage` handler.

### 4. Deep-linking

When a notification is tapped, read `data['route_session_id']` from the FCM message. Navigate to the live tracking screen for that session.

### 5. Inbox (Firestore stream)

Stream the user's inbox in real-time:

```
Firestore path: users/{supabaseUserId}/inbox
Order by: createdAt descending
```

Where `supabaseUserId` = `supabase.auth.currentUser.id` — valid for both parent and employee accounts.

Alternatively, fetch via HTTP:

```
GET https://us-central1-county-cars-af6d1.cloudfunctions.net/myInbox
Authorization: Bearer <supabase_access_token>
```

### 6. Mark as read

```
POST https://us-central1-county-cars-af6d1.cloudfunctions.net/markRead
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{
  "notificationId": "supabase_319"
}
```

---

## Deployment Commands

### Redeploy Edge Function (after editing `buildMessage`)

```bash
supabase functions deploy push-notification-relay --no-verify-jwt --project-ref ilpfknjpfmgvzjafqtls
```

### Redeploy Firebase Function (after editing `notifyInternal`)

```bash
cd firebase/functions
npm run build
cd ../..
firebase deploy --only functions:notifyInternal
```

---

## Maintenance: Adding a New Notification Type

When a new `notification_type` is introduced that has a non-null `recipient_user_id`:

1. Add a `case` to `buildMessage()` in `supabase/functions/push-notification-relay/index.ts`
2. Redeploy the Edge Function (command above)
3. Add the new type to the table in this document and in `.github/copilot-instructions.md`
