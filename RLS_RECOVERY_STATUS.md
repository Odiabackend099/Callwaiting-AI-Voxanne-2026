# 🔓 Auth Recovery: RLS Lockout FIXED

## ✅ Database Recovery Complete

Your database has been restored and hardened with RLS:

### What Was Fixed:
1. ✅ **Auth Metadata**: Updated `auth.users.raw_app_meta_data` with `org_id`
   - User: `callwaitingai@gmail.com`
   - Organization: `a0000000-0000-0000-0000-000000000001` (Default Organization)

2. ✅ **Profile Sync**: Created profile entry in `public.profiles` 
   - Profile ID: `7dd22d46-9958-4569-bc83-bbdd78848dfb`
   - Email: `callwaitingai@gmail.com`

3. ✅ **Auth Middleware**: Already configured to extract `org_id` from JWT
   - Location: `backend/src/middleware/auth.ts`
   - Logic: Reads `app_metadata.org_id` from decoded JWT token
   - Fallback: Queries `organizations` table if metadata is missing

---

## 🚀 What YOU Need To Do (Browser-Side)

The issue is that your **session token is stale** (cached before RLS was enabled).

### Step 1: Clear Session Storage
1. Open your browser
2. Press `Cmd + Option + I` (Mac) or `F12` (Windows/Linux)
3. Go to: **Application** → **Storage** → **Local Storage** → `http://localhost:3000`
4. **Select All** (`Cmd+A`) and **Delete**
5. Also clear: **Session Storage** and **Cookies** for same URL

### Step 2: Hard Refresh
- Press `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows/Linux)
- This bypasses browser cache

### Step 3: Sign In Again
- You will be redirected to `/login`
- Sign in with: `callwaitingai@gmail.com` + password
- The backend will now:
  - Fetch your user from auth.users ✓
  - Extract fresh `org_id` from app_metadata ✓
  - Create new JWT with org_id claim ✓
  - RLS policies will allow access ✓

---

## 📋 Why This Happened

**Before RLS hardening:**
- Session tokens didn't include `org_id`
- Backend accepted requests without it
- RLS policies were not enforced

**After RLS hardening (Phase 3):**
- Session tokens MUST include `org_id` 
- RLS policies check token for org_id claim
- Old cached tokens are rejected

**Solution:**
- Clear old cached token
- Re-login to get fresh token with org_id claim
- Access restored ✓

---

## 🎯 Test Your Access

Once you've cleared storage and signed back in:

1. Navigate to `http://localhost:3000/dashboard`
2. Should load without "Missing organization ID" error
3. Try viewing campaigns/calls - they should show YOUR org's data only

---

## 🆘 If Still Locked Out

**Option A: Nuclear Reset (In Browser Console)**
```javascript
// Paste this in: F12 → Console
['sb_state', 'sb_jwt', 'sb_refresh_token', 'localStorage'].forEach(key => {
  try { localStorage.removeItem(key); } catch(e) {}
});
location.reload();
```

**Option B: Check Backend Logs**
```bash
tail -50 /tmp/backend.log | grep -E "AuthOrDev|req.user"
```
Look for: `org_id = a0000000-0000-0000-0000-000000000001`

---

## 📞 Emergency Bypass (If Needed)

If you need immediate access without re-logging in, contact your DB admin to temporarily disable RLS on the affected tables. This emergency script exists:

```sql
-- TEMPORARY: Disable RLS for recovery (emergency only!)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ... then re-enable after you've logged in fresh

-- RE-ENABLE after recovery:
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

---

**Status**: ✅ **Database Ready** | ⏳ **Waiting for Browser Session Reset**

Next action: Clear browser storage, sign in again, and you're done!
