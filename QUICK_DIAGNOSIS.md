# Quick OAuth Status Check

## Step 1: Get Your org_id from Browser

Open your browser console (F12 → Console tab) and run:

```javascript
// Get your JWT and extract org_id
const token = localStorage.getItem('sb-auth-token') || sessionStorage.getItem('sb-auth-token');
if (token) {
  const parts = token.split('.');
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1]));
    console.log('=== YOUR JWT CONTENTS ===');
    console.log('user_id:', payload.sub);
    console.log('email:', payload.email);
    console.log('app_metadata:', payload.app_metadata);
    console.log('user_metadata:', payload.user_metadata);

    // Extract org_id
    const orgId = payload.app_metadata?.org_id || payload.user_metadata?.org_id;
    if (orgId) {
      console.log('✅ Found org_id:', orgId);
      console.log('Copy this for the next step');
    } else {
      console.log('❌ NO org_id found - this is the problem!');
      console.log('Solution: Log out and back in, then try again');
    }
  }
} else {
  console.log('❌ No token found - you may not be logged in');
}
```

## Step 2: Check Database State

If you found an org_id, run this in the browser console:

```javascript
const orgId = 'YOUR_ORG_ID_HERE'; // Replace with actual org_id from Step 1
const backendUrl = 'http://localhost:3001';

fetch(`${backendUrl}/api/google-oauth/debug?orgId=${orgId}`)
  .then(r => r.json())
  .then(data => {
    console.log('=== DATABASE STATE ===');
    console.log(JSON.stringify(data, null, 2));

    // Interpret results
    if (data.database?.credentialsCount > 0) {
      console.log('✅ Google Calendar credentials ARE in database');
      console.log('   Email:', data.database.googleCalendarCredentials[0]?.metadata?.email);
      if (data.database.googleCalendarCredentials[0]?.is_active) {
        console.log('   Status: ACTIVE');
        console.log('❌ Problem: Tokens exist but UI shows "Not Linked"');
        console.log('   Solution: Hard refresh browser (Cmd/Ctrl + Shift + R)');
      } else {
        console.log('   Status: INACTIVE');
        console.log('❌ Problem: Tokens are marked inactive');
      }
    } else {
      console.log('❌ NO Google Calendar credentials in database');
      console.log('   Problem: OAuth never completed successfully');
      console.log('   Solution: Try linking Google Calendar again, check console for errors');
    }
  })
  .catch(e => console.error('Error:', e.message));
```

## Step 3: Check Status Endpoint

If Step 2 showed credentials exist, check what the status endpoint returns:

```javascript
const orgId = 'YOUR_ORG_ID_HERE'; // Replace with actual org_id
const backendUrl = 'http://localhost:3001';

fetch(`${backendUrl}/api/google-oauth/status/${orgId}`)
  .then(r => r.json())
  .then(data => {
    console.log('=== STATUS ENDPOINT RESPONSE ===');
    console.log(JSON.stringify(data, null, 2));

    if (data.connected) {
      console.log('✅ Status endpoint shows: CONNECTED');
      console.log('   Email:', data.email);
      console.log('❌ But UI shows "Not Linked" - this is a frontend caching issue');
      console.log('   Solution: Hard refresh (Cmd/Ctrl + Shift + R)');
    } else {
      console.log('❌ Status endpoint shows: NOT CONNECTED');
      if (data.isSchemaRefreshing) {
        console.log('   Reason: Supabase schema cache refreshing');
        console.log('   Solution: Wait a few seconds and try again');
      } else {
        console.log('   Problem: Unknown reason');
      }
    }
  })
  .catch(e => console.error('Error:', e.message));
```

---

## Interpretation Guide

### ✅ Everything works - just refresh browser
**You see:**
- Step 1: org_id found
- Step 2: credentialsCount > 0 and is_active: true
- Step 3: connected: true

**Action:** Hard refresh browser (Cmd/Ctrl + Shift + R)

---

### ❌ No org_id in JWT
**You see:**
- Step 1: NO org_id found

**Root cause:** Your JWT was created before the database trigger was deployed, or the trigger failed

**Solutions:**
1. **Log out and back in:**
   - Go to your dashboard
   - Click "Logout" (if available)
   - Close the browser tab
   - Open new tab and log in fresh
   - Repeat Step 1 - should have org_id now

2. **If still no org_id, manually add it (Supabase Dashboard):**
   - Go to Supabase Dashboard
   - Click "Authentication" → "Users"
   - Find your user by email
   - Click the three dots → "Edit user"
   - In "App metadata", add: `{"org_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}`
   - Save
   - Log out and back in

---

### ❌ org_id exists, but no credentials in database
**You see:**
- Step 1: org_id found ✅
- Step 2: credentialsCount: 0

**Root cause:** OAuth flow didn't complete successfully

**Solutions:**
1. **Check for OAuth errors:**
   - Open browser console (F12)
   - Look for red error messages
   - Check for messages starting with `[OAuth` or `[Google`
   - Share these errors if you get stuck

2. **Try linking again:**
   - Click "Link My Google Calendar" button
   - Complete the Google consent flow
   - Watch for console messages
   - Check Step 2 again

3. **If it still fails, check backend logs:**
   - Look at backend terminal for `[GoogleOAuth]` logs
   - See what error occurred during code exchange

---

### ⚠️ Credentials exist, but status endpoint says "not connected"
**You see:**
- Step 1: org_id found ✅
- Step 2: credentialsCount > 0 ✅
- Step 3: connected: false

**Possible causes:**
1. **Schema cache refreshing:** Database just saved credentials, API cache not updated yet
   - Solution: Wait 5 seconds and check Step 3 again

2. **is_active flag is false:** Credentials were marked inactive
   - Solution: Check if you clicked "Disconnect" at some point
   - To fix: Re-link Google Calendar

3. **Email not extracted:** Tokens exist but email metadata is missing
   - Solution: Should still work, but re-link to get fresh metadata

---

## If You Get Stuck

Provide this information:

1. **Your org_id:**
   ```javascript
   JSON.parse(atob(localStorage.getItem('sb-auth-token').split('.')[1])).app_metadata?.org_id
   ```

2. **Full diagnostic response:**
   ```bash
   curl "http://localhost:3001/api/google-oauth/debug?orgId=YOUR_ORG_ID"
   ```

3. **Status endpoint response:**
   ```bash
   curl "http://localhost:3001/api/google-oauth/status/YOUR_ORG_ID"
   ```

4. **Backend logs:**
   - Last 50 lines from backend terminal
   - Look for `[GoogleOAuth]` entries

5. **Browser console logs:**
   - Screenshot of console when trying to link calendar
   - Look for errors starting with `[Calendar`, `[OAuth`, `[Google`
