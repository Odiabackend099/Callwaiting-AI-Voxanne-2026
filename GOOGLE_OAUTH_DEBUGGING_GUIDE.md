# Google Calendar OAuth - Debugging Guide

## The Issue: "Not Linked" Despite Multiple Link Attempts

You're seeing "Not Linked" in the UI even after the OAuth flow completes. This guide will help you diagnose and fix the root cause.

---

## Root Cause: Missing `org_id` in User JWT

The system requires an `org_id` in your JWT (JSON Web Token) to function. This ID is supposed to be stamped by a database trigger when you sign up. If it's missing, the entire OAuth flow breaks silently.

---

## Diagnosis Steps

### Step 1: Check if Your User Has `org_id` in JWT

**In Browser Console** (on the API Keys page):

```javascript
// Run this in browser console to check your JWT
const token = localStorage.getItem('sb-auth-token') || sessionStorage.getItem('sb-auth-token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('JWT app_metadata:', payload.app_metadata);
  console.log('JWT user_metadata:', payload.user_metadata);
}
```

**Expected Output:**
```json
{
  "app_metadata": {
    "org_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

**If you see `org_id` present**: Skip to Step 4 (Database Check)

**If `org_id` is missing**: Go to Step 2 (Fix JWT)

### Step 2: Force JWT Refresh

Your JWT might have been created before the database trigger was deployed. Force a fresh login:

1. Go to any page on your dashboard
2. Open browser **Settings** → **Applications** → **Storage** → **Cookies**
3. Delete all cookies for `localhost:3000` and `localhost:3001`
4. Log out completely (if you have a Logout button)
5. Close the browser tab
6. Open a new tab and log back in

Then repeat Step 1. Your JWT should now contain `org_id`.

### Step 3: Check Backend Diagnostics

If the JWT now has `org_id`, test the backend diagnostic endpoint:

**In Browser Console:**

```javascript
const orgId = JSON.parse(atob(
  localStorage.getItem('sb-auth-token').split('.')[1]
)).app_metadata?.org_id;

fetch(`/api/google-oauth/debug`)
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))
```

This will show:
- Whether your profile exists in the database
- Whether you have Google Calendar credentials stored
- The state of your `org_id`

**Expected Response:**

```json
{
  "jwt": {
    "org_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "user_id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  },
  "database": {
    "profile": {
      "id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
      "email": "user@example.com",
      "org_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    },
    "googleCalendarCredentials": [
      {
        "provider": "google_calendar",
        "is_active": true,
        "metadata": {
          "email": "user@gmail.com"
        },
        "updated_at": "2026-01-16T12:34:56Z"
      }
    ],
    "credentialsCount": 1
  }
}
```

### Step 4: If Credentials Exist in DB

If the diagnostic shows `credentialsCount: 1` and `is_active: true`, **the database HAS your Google tokens**, but the frontend isn't showing them.

**This means:**
1. Your OAuth flow IS working ✅
2. Your tokens ARE being stored ✅
3. The frontend UI is just not refreshing ❌

**Fix:**

Hard refresh your browser:

- **Windows/Linux**: Press `Ctrl + Shift + R`
- **Mac**: Press `Cmd + Shift + R`

If still "Not Linked", check browser console for errors:

```javascript
// Check for console errors
console.log(document.body.textContent.match(/Error/gi));
```

### Step 5: Manual Status Check

Call the status endpoint directly:

```bash
# Replace {org-id} with your actual org_id from JWT
curl -H "Content-Type: application/json" \
  "http://localhost:3001/api/google-oauth/status/{org-id}"
```

**Expected Response (if linked):**

```json
{
  "connected": true,
  "email": "user@gmail.com",
  "active": true,
  "connectedAt": "2026-01-16T12:34:56Z",
  "hasTokens": true,
  "timestamp": "2026-01-16T13:00:00Z"
}
```

**If response shows `connected: false`:**
- Your tokens exist in the database (we saw them in Step 3)
- But the status endpoint isn't finding them
- This suggests a schema cache issue or database read problem

---

## Common Scenarios & Solutions

### Scenario A: `org_id` Missing from JWT

**Diagnosis:**
- Step 1: No `org_id` in app_metadata
- Step 2: Still no `org_id` after login refresh

**Root Cause:** Database trigger didn't run or user was created before trigger existed

**Solution:**

1. **Manually add `org_id` to your user's JWT** (Supabase Dashboard):
   - Go to Supabase Dashboard → Auth Users
   - Click on your user email
   - Click "Edit user"
   - Add to `app_metadata`:
     ```json
     {
       "org_id": "a0000000-0000-0000-0000-000000000001"
     }
     ```
   - Save
   - Log out and log back in

2. **Verify org exists in database:**
   - Go to Supabase Dashboard → SQL Editor
   - Run:
     ```sql
     SELECT id, name FROM organizations LIMIT 5;
     ```
   - If no rows, you need to create an organization first

3. **Create organization if missing:**
   - SQL Editor → Run:
     ```sql
     INSERT INTO organizations (name, status)
     VALUES ('My Clinic', 'active')
     RETURNING id;
     ```
   - Copy the returned `id` UUID
   - Add it to your user's app_metadata as shown above

### Scenario B: `org_id` Present, But "Not Linked" Still Shows

**Diagnosis:**
- Step 1: `org_id` IS in app_metadata ✅
- Step 3: Credentials exist in database ✅
- Step 5: Status endpoint shows `connected: true` ✅
- But UI still shows "Not Linked"

**Root Cause:** Frontend not detecting the success or cache issue

**Solution:**

1. **Clear browser cache:**
   - Hard refresh: `Cmd/Ctrl + Shift + R`
   - Or: DevTools → Application → Clear Storage

2. **Check browser console for errors:**
   - Open DevTools (F12)
   - Click "Console" tab
   - Look for red error messages
   - Post the errors in your issue

3. **Check frontend logs:**
   - Look for `[Calendar Status]` or `[OAuth Callback]` messages
   - These show the retry attempts and final status

### Scenario C: Can Link, But Token Expires After 1 Hour

**Diagnosis:**
- OAuth completes successfully
- Calendar shows "Linked" for ~60 minutes
- Then reverts to "Not Linked"
- Error: "Token expired"

**Root Cause:** Only received Access Token, not Refresh Token

**Solution:**

1. **Disconnect calendar** (if there's a button)
2. **Link again** - should get refresh token on second attempt
3. **Check status endpoint response:**
   - Should include `"hasTokens": true` with both access and refresh tokens

---

## Advanced Debugging

### Check Backend Logs

If you're running the backend locally:

```bash
# Look for GoogleOAuth logs
# Successful token exchange should show:
# [GoogleOAuth] Tokens stored successfully
# orgId: ...
# hasRefreshToken: true

# Failed attempts should show:
# [GoogleOAuth] Failed to exchange code for tokens
# error: ...
```

### SQL Queries to Verify State

Run these in Supabase → SQL Editor:

```sql
-- 1. Check your profile exists with org_id
SELECT id, email, org_id, created_at
FROM profiles
WHERE email = 'your-email@example.com';

-- 2. Check organization exists
SELECT id, name, status, created_at
FROM organizations
WHERE id = 'your-org-id-from-above';

-- 3. Check Google Calendar credentials are stored
SELECT org_id, provider, is_active, metadata, updated_at
FROM org_credentials
WHERE org_id = 'your-org-id'
  AND provider = 'google_calendar';

-- 4. Verify metadata has email
SELECT metadata->>'email' as google_email
FROM org_credentials
WHERE org_id = 'your-org-id'
  AND provider = 'google_calendar';
```

---

## Checklist: Full Debug Flow

Use this checklist to systematically diagnose the issue:

- [ ] **JWT Check:** Do I have `org_id` in app_metadata?
  - If NO → Go to Scenario A
  - If YES → Continue

- [ ] **JWT Refresh:** Did I log out and log back in after seeing missing `org_id`?
  - If NO → Do it now, then recheck JWT
  - If YES → Continue

- [ ] **Profile Check:** Does my user profile exist in database with org_id?
  - Run: `SELECT * FROM profiles WHERE email = 'my-email'`
  - If NO rows → Contact support
  - If YES → Continue

- [ ] **Organization Check:** Does my org exist in database?
  - Run: `SELECT * FROM organizations WHERE id = 'my-org-id'`
  - If NO rows → Contact support
  - If YES → Continue

- [ ] **Credentials Check:** Do I have Google Calendar credentials in database?
  - Run: `SELECT * FROM org_credentials WHERE provider = 'google_calendar'`
  - If NO rows → OAuth never completed successfully
  - If YES → Go to Scenario B

- [ ] **Status Endpoint:** What does the backend status endpoint return?
  - Call: `/api/google-oauth/status/{org-id}`
  - If `connected: false` → Check database
  - If `connected: true` → Go to Scenario B

---

## Need More Help?

### Provide This Information

When reporting an issue, provide:

1. **Your JWT content** (sanitize org_id and user_id):
   ```javascript
   JSON.parse(atob(token.split('.')[1])).app_metadata
   ```

2. **Backend diagnostic response:**
   ```bash
   curl "http://localhost:3001/api/google-oauth/debug"
   ```

3. **Browser console logs** (from Google Calendar linking attempt):
   - Look for `[Calendar Status]`, `[OAuth Callback]` messages
   - Copy-paste the full logs

4. **SQL query results** from the Verification Queries above

---

## Summary: Quick Fix

Most issues can be fixed by:

1. **Log out completely** (clear cookies)
2. **Log back in** (fresh JWT with org_id)
3. **Hard refresh** browser (`Cmd/Ctrl + Shift + R`)
4. **Link Google Calendar** again
5. **Check backend logs** to verify success

If issue persists after these steps, use the Scenarios above to diagnose further.
