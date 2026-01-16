# Test if Backend Can Save Credentials

I've added a test endpoint to verify if the backend's credential storage is working.

## Step 1: Test the Storage Function

Open your browser console (F12 → Console tab) and run:

```javascript
const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
const backendUrl = 'http://localhost:3001';

fetch(`${backendUrl}/api/google-oauth/test-store-credentials`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orgId: orgId,
    email: 'test@gmail.com'
  })
})
  .then(r => r.json())
  .then(data => {
    console.log('Test Store Response:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(e => console.error('Error:', e.message));
```

## Step 2: Check if credentials were saved

If the response shows `success: true`, then run this SQL query in Supabase:

```sql
SELECT
  id,
  org_id,
  provider,
  is_active,
  metadata,
  created_at,
  updated_at
FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'google_calendar';
```

**Expected Results:**
- If the test succeeds but SQL returns 0 rows: Database write is failing silently
- If SQL returns 1 row: The storage function works! Problem is elsewhere

## Step 3: Test the Real OAuth Flow

Once you know if the storage function works:

1. **Go to**: `http://localhost:3000/dashboard/api-keys`
2. **Click**: "Link My Google Calendar"
3. **Check browser console** for messages like:
   - `[Calendar Status]`
   - `[OAuth Callback]`
   - `[Google OAuth]`
4. **Check backend terminal** for logs starting with `[GoogleOAuth]` or `[IntegrationDecryptor]`

---

## What Each Result Means

| Result | Meaning | Fix |
|--------|---------|-----|
| Test endpoint returns `success: true` AND SQL shows 1 row | Storage function works ✅ | Problem is in OAuth callback or frontend |
| Test endpoint returns `success: true` BUT SQL shows 0 rows | Database connection issue | Check Supabase service role key |
| Test endpoint returns error | Storage function broken | Need backend logs to debug |
| Real OAuth shows no logs | Callback not being hit | Check redirect URI mismatch |

---

## Run Test Now

Copy and paste the JavaScript code above into your browser console and tell me:
1. What the response says
2. What the SQL query returns

This will tell us if the problem is:
- **Backend storage**: Can't save to database
- **OAuth callback**: Callback not being triggered
- **Redirect URI**: Google rejects the code exchange

