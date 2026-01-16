# Check if Google Calendar Credentials Are in Database

Your user email: `voxanne@demo.com`
Your organization ID: `46cf2995-2bee-44e3-838b-24151486fe4e`

## Step 1: Check if credentials exist in the database

Go to **Supabase Dashboard** → **SQL Editor** and run this query:

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

### What the results mean:

- **If you get 0 rows**: Credentials were never saved. OAuth callback didn't complete successfully.
- **If you get 1+ rows with `is_active = true`**: Credentials ARE in the database. The problem is the UI not showing them.
- **If you get 1+ rows with `is_active = false`**: Credentials exist but are marked inactive (you clicked disconnect).

---

## Step 2: If credentials exist, check the metadata

If Step 1 returns rows, run this to see what email was stored:

```sql
SELECT 
  metadata->>'email' as google_email,
  is_active,
  updated_at
FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'google_calendar';
```

This will show if the Google email address was captured.

---

## Step 3: Check backend logs

If credentials exist in database but UI shows "Not Linked", check if there are any recent backend error logs. Look for messages like:

- `[GoogleOAuth] Tokens stored successfully`
- `[GoogleOAuth] Failed to store tokens`
- `[IntegrationDecryptor] Credentials stored successfully`
- `[IntegrationDecryptor] Supabase upsert error`

---

## Step 4: Test the status endpoint directly

Once you know if credentials exist, test the status endpoint:

**In browser console** (on any page):

```javascript
const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
const backendUrl = 'http://localhost:3001';

fetch(`${backendUrl}/api/google-oauth/status/${orgId}`)
  .then(r => r.json())
  .then(data => {
    console.log('Status endpoint response:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(e => console.error('Error:', e.message));
```

Expected response if credentials exist:
```json
{
  "connected": true,
  "email": "your-google-email@gmail.com",
  "active": true
}
```

Or if no credentials:
```json
{
  "connected": false,
  "email": null
}
```

---

## Summary

1. **Run the SQL query above** to check if credentials are in the database
2. **Share the results** so we know if the problem is:
   - OAuth not saving tokens (database empty)
   - OR UI not reading tokens (database has them)
3. This determines what to fix next

---

