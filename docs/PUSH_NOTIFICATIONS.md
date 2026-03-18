# Push Notifications Module

This module provides push notifications using **Supabase Auth + RBAC** for permissions and **Firebase (FCM + Firestore)** for delivery and inbox storage.

**Security**: Clients must NOT access Firestore directly. All Firestore reads/writes happen only via Firebase Cloud Functions (Admin SDK).

---

## Architecture

- **Supabase**: Auth, RBAC (permissions/roles/user_roles/role_permissions), recipient resolution (route crew, route parents)
- **Firebase**: FCM for push delivery, Firestore for device tokens and inbox
- **Cloud Functions**: HTTPS endpoints that verify Supabase JWT and perform all Firestore/FCM operations

---

## Setup

### 1. Supabase Migration

Run the migration:

```bash
supabase db push
# or
supabase migration up
```

This creates:
- Permissions: `notifications.send.single`, `notifications.send.route_parents`, `notifications.send.route_crew`, `notifications.inbox`
- `employees.user_id` (linked to auth.users via personal_email)
- `parent_contacts.user_id` (linked to auth.users via email)
- RPCs: `get_route_crew_user_ids`, `get_route_parent_user_ids`, `get_my_permissions`, `search_notification_recipients`
- Role mapping for admin roles

### 2. Firebase Project

1. Create a Firebase project (or use existing)
2. Enable Firestore and Cloud Messaging (FCM)
3. Run `firebase login` and `firebase use <project-id>`

### 3. Firebase Cloud Functions

```bash
cd firebase/functions
npm install
npm run build
```

Set environment variables. Create `firebase/functions/.env` (do not commit):

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_PROJECT_REF=your_project_ref
```

Or set via Firebase Console: Project Settings > Service accounts, or use Firebase Functions params (`defineString`).

Deploy:

```bash
firebase deploy --only functions
```

### 4. Frontend Environment

Add to `.env.local`:

```
NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=https://europe-west1-YOUR_PROJECT.cloudfunctions.net
```

Replace `YOUR_PROJECT` with your Firebase project ID. The URL format may vary; check the Firebase Console > Functions for the exact URL.

### 5. Firestore Indexes (if needed)

For `myInbox` ordering, you may need a composite index:

- Collection: `users/{userId}/inbox`
- Fields: `createdAt` (Descending)

Firebase will prompt you to create it when the query first runs.

---

## Firestore Data Model

```
users/{supabaseUserId}/devices/{deviceId}
  token: string
  platform: 'android'|'ios'|'web'
  updatedAt: timestamp

users/{supabaseUserId}/inbox/{notificationId}
  notificationId: string
  createdAt: timestamp
  readAt: timestamp|null

notifications/{notificationId}
  title: string
  body: string
  deepLink: string|null
  metadata: map|null
  createdAt: timestamp
  createdBy: string (supabase uid)
  audienceType: 'single_user'|'route_parents'|'route_crew'
  routeId: number|null
```

---

## API Endpoints (Cloud Functions)

| Endpoint | Method | Description |
|---------|--------|-------------|
| `/registerDevice` | POST | Register FCM token for current user |
| `/sendNotification` | POST | Send notification (admin, permission-gated) |
| `/markRead` | POST | Mark notification as read |
| `/myInbox` | GET | Fetch user's notification inbox |

All require `Authorization: Bearer <supabase_jwt>`.

---

## Client Integration: Device Registration

To receive push notifications, clients must register their FCM token:

```typescript
// After user signs in and has FCM token
const token = await getToken(messaging, { vapidKey: '...' });
await fetch(FUNCTIONS_URL + '/registerDevice', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseSession.access_token}`,
  },
  body: JSON.stringify({
    deviceId: 'unique-device-id',
    token,
    platform: 'web', // or 'android' | 'ios'
  }),
});
```

---

## Permissions

| Permission | Description |
|------------|-------------|
| `notifications.send.single` | Send to one user |
| `notifications.send.route_parents` | Send to all parents on a route |
| `notifications.send.route_crew` | Send to route driver + PA |
| `notifications.inbox` | View own inbox |

Assigned to: Operations Administrator, Full System Administrator, Super Admin (send); all roles (inbox).
