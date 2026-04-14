# Password Reset Flow — Dashboard + Flutter

## How It Works (The Key Insight)

The user is **not logged in** when they request a reset. That's fine — **no JWT is needed**. Here's what happens:

1. Your app calls `resetPasswordForEmail(email)` — this is a **public, unauthenticated** endpoint
2. Supabase looks up the email, generates a **signed one-time token**, and sends the email
3. User clicks the link → goes to **Supabase's server** first (not your app)
4. Supabase validates the token, **creates a real authenticated session**, and redirects to your app with the session tokens in the URL
5. Your app now has a valid JWT → user enters new password → `updateUser({ password })`

**The email link IS the proof of identity.** Supabase converts "this person has access to this inbox" into an authenticated session automatically.

### Who identifies the user at each step?

| Step | Who is identified? | How? |
|------|--------------------|------|
| **Request reset** | Nobody — public endpoint | Email address is just a lookup key |
| **Email link clicked** | **Supabase identifies the user** | The signed one-time token in the URL maps to `auth.users.id` |
| **Redirect to your app** | **Your app receives a session** | Supabase appended `access_token` + `refresh_token` to the redirect URL |
| **Set new password** | **The authenticated user** | The JWT from the session contains the user ID |

---

## Step 1 — Supabase Dashboard Configuration

Go to **Supabase Dashboard → Authentication → URL Configuration**:

1. **Site URL** — set to your production dashboard URL:
   ```
   https://yourdomain.com
   ```

2. **Redirect URLs** — add ALL of these:
   ```
   https://yourdomain.com/reset-password
   http://localhost:3000/reset-password
   com.countycars.app://reset-password
   ```
   - First = production web
   - Second = local dev
   - Third = Flutter deep link

3. Go to **Authentication → Email Templates → Reset Password** and set:
   ```html
   <h2>Reset Password</h2>
   <p>Follow this link to reset the password for your user:</p>
   <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
   ```
   You don't hardcode any URL here — `{{ .ConfirmationURL }}` is replaced by Supabase automatically based on the `redirectTo` each caller passes.

---

## Step 2 — Dashboard (Next.js) — Already Done ✅

The dashboard already handles this. The flow is:

- **Trigger:** `/login` page → "Forgot password?" → calls:
  ```ts
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password'
  })
  ```
- **Landing page:** `/reset-password` → checks session → shows new password form → calls:
  ```ts
  await supabase.auth.updateUser({ password: newPassword })
  ```
- **Done:** Redirects to `/login?reset=success` → shows success banner

No changes needed on the web side.

---

## Step 3 — Flutter Setup

### 3a. Configure Deep Links

**Android** — `android/app/src/main/AndroidManifest.xml`:
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="com.countycars.app" android:host="reset-password" />
</intent-filter>
```

**iOS** — `ios/Runner/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.countycars.app</string>
    </array>
  </dict>
</array>
```

### 3b. Initialize Supabase with the Deep Link Scheme

```dart
await Supabase.initialize(
  url: 'https://ilpfknjpfmgvzjafqtls.supabase.co',
  anonKey: 'your-anon-key',
  authOptions: const FlutterAuthClientOptions(
    authFlowType: AuthFlowType.pkce,  // recommended
  ),
);
```

### 3c. "Forgot Password" Screen — Send the Email

```dart
// User is NOT logged in — no JWT needed, this is a public call
await Supabase.instance.client.auth.resetPasswordForEmail(
  emailController.text.trim(),
  redirectTo: 'com.countycars.app://reset-password',
);

// Show message: "Check your email for a reset link"
```

### 3d. Listen for the Recovery Event

In your app's auth state listener (e.g. in `main.dart` or a root widget):

```dart
Supabase.instance.client.auth.onAuthStateChange.listen((data) {
  if (data.event == AuthChangeEvent.passwordRecovery) {
    // The user clicked the email link → Supabase gave us a session
    // Navigate to the "enter new password" screen
    navigatorKey.currentState?.pushNamed('/new-password');
  }
});
```

### 3e. "Enter New Password" Screen — Set the Password

```dart
// At this point the user IS authenticated
// (Supabase created a session from the email link)
final response = await Supabase.instance.client.auth.updateUser(
  UserAttributes(password: newPasswordController.text),
);

if (response.user != null) {
  // Success — navigate to login or home screen
}
```

---

## Full Flow Diagram

```
User (not logged in)
  │
  ├─ Web: clicks "Forgot password?" on /login
  │   └─ resetPasswordForEmail(email, redirectTo: "https://yourdomain.com/reset-password")
  │
  ├─ Flutter: taps "Forgot password?" on login screen
  │   └─ resetPasswordForEmail(email, redirectTo: "com.countycars.app://reset-password")
  │
  ▼
Supabase (server-side)
  ├─ Finds user by email in auth.users
  ├─ Generates signed one-time token (expires in 1 hour)
  ├─ Sends email: {{ .ConfirmationURL }} becomes:
  │   ├─ Web:     https://<ref>.supabase.co/auth/v1/verify?token=abc&type=recovery
  │   │           &redirect_to=https://yourdomain.com/reset-password
  │   └─ Flutter: https://<ref>.supabase.co/auth/v1/verify?token=abc&type=recovery
  │               &redirect_to=com.countycars.app://reset-password
  │
  ▼
User clicks link in email
  ├─ Goes to Supabase's server FIRST (not your app)
  ├─ Supabase validates token → creates JWT session
  ├─ Redirects to YOUR redirect_to URL with tokens:
  │   ├─ Web:     https://yourdomain.com/reset-password#access_token=eyJ...&type=recovery
  │   └─ Flutter: com.countycars.app://reset-password#access_token=eyJ...&type=recovery
  │
  ▼
Your app receives the redirect
  ├─ Web:     Supabase JS reads URL fragment → session established → page loads
  ├─ Flutter: Supabase SDK catches deep link → fires AuthChangeEvent.passwordRecovery
  │
  ▼
User enters new password
  ├─ updateUser({ password }) — THIS call uses the JWT from the session
  └─ Done ✅
```

---

## Checklist for Flutter Developer

- [ ] Add `com.countycars.app://reset-password` to **Supabase Dashboard → Redirect URLs**
- [ ] Configure Android `intent-filter` for custom scheme `com.countycars.app`
- [ ] Configure iOS `CFBundleURLSchemes` for `com.countycars.app`
- [ ] Initialize Supabase with PKCE flow
- [ ] Build "Forgot password" screen → calls `resetPasswordForEmail` with `redirectTo: 'com.countycars.app://reset-password'`
- [ ] Add `onAuthStateChange` listener for `passwordRecovery` event → navigates to new password screen
- [ ] Build "New password" screen → calls `updateUser(UserAttributes(password: ...))`
- [ ] Test end-to-end: request reset → check email → click link → app opens → set password → login works
