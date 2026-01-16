# OAuth "Not Linked" - Action Plan (5 Minutes)

**Status:** Database confirmed 0 rows in `org_credentials` table
**Meaning:** OAuth callback is NOT saving credentials
**Next:** Run diagnostic tests to identify why

---

## One-Minute Summary

1. **Database check shows credentials NOT being saved** → This is the root problem
2. **Code review shows everything is correct** → Problem is at runtime, not code
3. **Need diagnostic tests** → Will pinpoint exact failure point
4. **I've added test endpoints** → Can now test storage function directly

---

## Execute These Steps NOW (5 minutes total)

### Step 1: Test Backend Credential Storage (2 minutes)

**Browser Console** (F12 → Console tab):

```javascript
const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

fetch('http://localhost:3001/api/google-oauth/test-store-credentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orgId, email: 'test@gmail.com' })
})
  .then(r => r.json())
  .then(d => console.log('RESPONSE:', JSON.stringify(d, null, 2)))
  .catch(e => console.error('ERROR:', e));
```

**Copy and paste the RESPONSE you see in console below:**

```
[PASTE TEST RESPONSE HERE]
```

---

### Step 2: Check Database After Test (1 minute)

**Supabase Dashboard → SQL Editor** and run:

```sql
SELECT * FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'google_calendar';
```

**Does it return 1 row or 0 rows?**

```
[ANSWER: 1 row OR 0 rows]
```

---

### Step 3: Real OAuth Flow with Logs (2 minutes)

**Backend terminal** - Keep visible:
```bash
npm run dev
```

**Browser** - Attempt OAuth:
1. Go to `http://localhost:3000/dashboard/api-keys`
2. Click "Link My Google Calendar"
3. Complete Google consent

**Backend logs** - Copy what appears:

```
[PASTE ALL LOGS THAT APPEAR STARTING WITH [GoogleOAuth] OR [IntegrationDecryptor]]
```

---

## What I'll Do With Your Results

| Your Result | What I'll Do |
|-------------|-------------|
| Test success + SQL shows 1 row | OAuth callback problem identified → fix UI or redirect URI |
| Test success + SQL shows 0 rows | Database write issue → fix Supabase connection |
| Test failed with error | Storage function broken → fix encryption/upsert |
| OAuth logs show Google error | Redirect URI mismatch → add to Google Cloud Console |

---

## Example Responses

### Example: Test Succeeds
```json
{
  "success": true,
  "message": "Test credentials stored successfully",
  "orgId": "46cf2995-2bee-44e3-838b-24151486fe4e",
  "email": "test@gmail.com"
}
```

### Example: Test Fails
```json
{
  "success": false,
  "error": "Failed to store test credentials",
  "message": "[actual error message]"
}
```

---

## After You Complete Steps 1-3

Reply with:
1. ✅ Test response (copy/paste)
2. ✅ SQL query result (1 row or 0 rows)
3. ✅ Backend logs (copy/paste)

**Once I have this,** I'll identify the exact issue and provide the fix.

---

## Why This Approach

- **Tests storage function directly** - Bypasses OAuth, tests database
- **SQL query proves what was saved** - Shows if database write succeeded
- **Backend logs show exact error** - Identifies where OAuth fails
- **Systematic diagnosis** - No guessing, just facts

---

## Important

❌ **Don't:**
- Wait for logs to appear, they come instantly
- Use the real Google Console, test endpoint works offline
- Worry about backend terminal spam, that's normal

✅ **Do:**
- Copy all logs, even if they seem unrelated
- Run test endpoint first (it's fast)
- Keep backend terminal open and visible

---

Ready to run the tests?

