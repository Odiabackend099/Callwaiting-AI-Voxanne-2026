# DO THIS RIGHT NOW - 3 Steps (5 minutes)

Your OAuth backend code is **perfect**. The issue is 100% a JWT problem.

## Step 1: Get Your Real org_id (1 minute)

**In Supabase Dashboard:**

1. Go to **SQL Editor**
2. Run this query:
```sql
SELECT id, name FROM organizations LIMIT 1;
```
3. Copy the `id` value (it's a UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
4. **Save it** - you'll need it in Step 3

---

## Step 2: Clear Your Browser (1 minute)

1. Open DevTools (F12)
2. Go to **Application** → **Storage**
3. Click **Clear Site Data** (or manually delete all cookies for localhost)
4. Close **all** tabs with your app
5. Close the browser completely
6. Open a fresh browser window

---

## Step 3: Log In & Test (3 minutes)

1. Go to `http://localhost:3000`
2. Log in with your credentials
3. Go to **Dashboard** → **API Keys**
4. Check the console (F12 → Console)
5. You should see: `[Calendar Status] Extracted org_id from user: [YOUR_ORG_ID]`
6. Click "Link My Google Calendar"
7. Complete the Google consent flow

---

## What You Should See

**If it works:**
- Green checkmark next to "Google Calendar"
- Email displayed
- Button changes to "Connected"

**If it still shows "Not Linked":**
- Hard refresh: `Cmd/Ctrl + Shift + R`
- Check console for error messages starting with `[`
- Share those error messages

---

## If You Don't Have Any Organizations

Run this in Supabase SQL Editor:

```sql
INSERT INTO organizations (id, name, status, created_at, updated_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Test Clinic',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

Then manually add this to your user's JWT in **Authentication** → **Users** → **Edit user** → **App metadata**:

```json
{
  "org_id": "a0000000-0000-0000-0000-000000000001"
}
```

Then log out/back in and try linking.

---

## That's It

Your code is correct. Just need to:
1. Have an org in the database
2. Have that org_id in your JWT
3. Fresh browser session

Should work immediately after these 3 steps.
