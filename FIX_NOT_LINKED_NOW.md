# Fix "Not Linked" - Right Now

## The Problem in One Sentence

Your user JWT is missing the `org_id` that the system needs to work. Without it, every API call fails silently.

---

## The Fix: 3 Steps (5 minutes)

### Step 1: Log Out Completely

Close **all** tabs with your app, then:

1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Storage** → **Cookies**
4. Delete **all** cookies for `localhost`
5. Close the browser completely
6. Open a new browser window
7. Log in fresh

**Why?** Your old JWT was created before the `org_id` trigger existed. A fresh login generates a new JWT with `org_id` included.

---

### Step 2: Verify Your JWT Has org_id

In browser console (F12 → Console):

```javascript
const token = localStorage.getItem('sb-auth-token') || sessionStorage.getItem('sb-auth-token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('org_id:', payload.app_metadata?.org_id || payload.user_metadata?.org_id);
```

**Expected output:**
```
org_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**If you see `org_id: undefined`:**
- The database trigger didn't run
- Go to "Fallback: Manual Fix" below

---

### Step 3: Try Linking Google Calendar Again

1. Click "Link My Google Calendar"
2. Complete the Google consent flow
3. You should see "Linked" in green

**If still showing "Not Linked":**

Hard refresh the browser:
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

---

## If That Didn't Work

### Fallback: Manual Fix (2 minutes)

If Step 2 showed `org_id: undefined`, you need to manually add it to your user:

**In Supabase Dashboard:**

1. Go to **Authentication** → **Users**
2. Find your user by email
3. Click the **three dots** next to their name
4. Click **Edit user**
5. Find **App metadata** field
6. Add this JSON:
   ```json
   {
     "org_id": "a0000000-0000-0000-0000-000000000001"
   }
   ```
7. Click **Save**
8. Log out and log back in
9. Repeat Step 3 (try linking again)

---

## If You Still Get "Not Linked"

### Run This Diagnostic

Copy the entire contents of this file into your browser console:

```javascript
// [Paste the entire contents of BROWSER_CONSOLE_DIAGNOSTIC.js here]
```

Then share the console output. It will tell exactly what's broken.

---

## What's Actually Happening

| Step | Should Work | What Could Break |
|------|------------|------------------|
| **JWT Creation** | Fresh login adds org_id | Old JWT cached from before trigger existed |
| **Frontend Reads JWT** | Extracts org_id successfully | org_id missing from JWT |
| **Backend Receives org_id** | Knows which clinic to update | Gets "unknown" and fails silently |
| **Database Stores Tokens** | Credentials saved for the clinic | Foreign key error if org doesn't exist |
| **Frontend Shows Status** | Detects connection and shows "Linked" | Browser cache not refreshed |

---

## Summary

**Most common fix:** Fresh login (Steps 1-3)

**If that fails:** Manual JWT update (Fallback section)

**Still stuck:** Run the diagnostic and share the output

You should have "Google Calendar: Linked" in **5 minutes** with these steps.
