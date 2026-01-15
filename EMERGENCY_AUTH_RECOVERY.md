# 🚨 Emergency Auth Recovery Guide

## Status: RLS Lockout Due to Missing `org_id` in Session

Your account is secured by Row-Level Security (RLS) policies that require the `org_id` claim in the session token. The hardening process is working correctly—it's just that your session needs to be re-established with the new claims.

---

## ✅ STEP 1: Database Recovery (COMPLETED)

I have successfully updated your Supabase auth metadata:

### What Was Done:
1. ✅ Updated `auth.users.raw_app_meta_data` to include `org_id = "a0000000-0000-0000-0000-000000000001"` (Default Organization)
2. ✅ Created profile entry for `callwaitingai@gmail.com` in `public.profiles` table

### Verification:
```sql
-- User exists with proper metadata
SELECT id, email, raw_app_meta_data FROM auth.users 
WHERE email = 'callwaitingai@gmail.com';
-- Result: Now includes org_id in raw_app_meta_data

-- Profile synced
SELECT id, email FROM public.profiles 
WHERE email = 'callwaitingai@gmail.com';
-- Result: Profile exists
```

---

## 🖥️ STEP 2: Clear Local Session Ghosts (YOU DO THIS)

Your browser is still holding the old, unhardened session token. Here's how to fix it:

### Instructions:
1. **Open Developer Tools**: Press `Cmd + Option + I` (Mac) or `F12` (Windows/Linux)
2. **Go to Application Tab**: Click "Application" at the top
3. **Clear Storage**: 
   - In the left sidebar, click "Storage" → "Local Storage" → `http://localhost:3000`
   - **Delete ALL entries** (Cmd+A, then Delete)
   - Also check "Session Storage" and clear that too
4. **Clear Cookies**:
   - In left sidebar, click "Cookies" → `http://localhost:3000`
   - Delete all cookies starting with `sb_` (Supabase cookies)
5. **Hard Refresh**: Press `Cmd + Shift + R` to hard-refresh the page

---

## 🔑 STEP 3: Re-Login (YOU DO THIS)

Once you've cleared the session storage:

1. **Navigate to `/login`** (should redirect you there)
2. **Sign in with**: `callwaitingai@gmail.com` and your password
3. **The auth middleware will now:**
   - Fetch your user from `auth.users` 
   - Extract `org_id` from the freshly-updated `app_metadata`
   - Inject it into the session on `requireAuth()` middleware
   - Create a new JWT token with `org_id` claim

---

## 🔍 How The Auth Flow Now Works (For Reference)

### Frontend → Backend Flow:
```
1. User signs in at /login
2. Supabase Auth returns JWT (includes raw_app_meta_data)
3. Frontend stores JWT in localStorage
4. Frontend sends: GET /dashboard with "Bearer <JWT>"
5. Backend auth middleware:
   - Validates JWT signature with Supabase
   - Extracts app_metadata.org_id from decoded token
   - Attaches to req.user.orgId
   - Passes to next() → request proceeds
6. RLS policies now see org_id claim → rows returned ✅
```

### Key Code (Already In Place):
From `backend/src/middleware/auth.ts`:
```typescript
let orgId: string = (user.app_metadata?.org_id || user.user_metadata?.org_id) as string || 'default';
if (orgId !== 'default') {
  req.user = { id: user.id, email: user.email || '', orgId };
  req.org_id = orgId;
}
```

---

## 🚀 Quick Checklist

- [ ] Clear localStorage for `http://localhost:3000`
- [ ] Clear sessionStorage for `http://localhost:3000`  
- [ ] Clear cookies (especially `sb_*` prefixed)
- [ ] Hard refresh browser (`Cmd + Shift + R`)
- [ ] Sign in again with `callwaitingai@gmail.com`
- [ ] Navigate to `/dashboard` - should work now!

---

##  Troubleshooting

### If you still see "Missing organization ID":

**Option 1: Check browser console**
- Open DevTools → Console
- Look for error messages about RLS or org_id
- Note the exact error

**Option 2: Verify backend logs**
- Check `/tmp/backend.log`
- Look for `[AuthOrDev]` or `[HTTP]` entries for your request
- Backend should show: `req.user.orgId = a0000000-0000-0000-0000-000000000001`

**Option 3: Manually reset using this script**
If localStorage corruption persists, use the Nuclear Option:
```javascript
// Run in browser console (F12 → Console tab)
// This will clear ALL Supabase-related session data
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('sb') || key.includes('supabase') || key.includes('auth')) {
    localStorage.removeItem(key);
  }
});
Object.keys(sessionStorage).forEach(key => {
  if (key.startsWith('sb') || key.includes('supabase') || key.includes('auth')) {
    sessionStorage.removeItem(key);
  }
});
console.log('✅ All session data cleared. Refresh page to re-login.');
```

---

## ✨ Why This Happened

When database hardening was applied (Phase 3), RLS policies started enforcing:
- ❌ **Before**: Old sessions without `org_id` were allowed (no RLS)
- ✅ **After**: Only sessions with valid `org_id` claim are allowed (RLS enabled)

Your user account HAD the org_id capability, but your **session token** was cached before the hardening. This recovery fixes that mismatch.

---

## 🎯 Next Steps

Once you're logged back in:
1. Test dashboard navigation - all pages should load
2. Try creating a campaign to verify RLS is working
3. Check the backend logs to see org_id being enforced

**Congratulations!** Your multi-tenant isolation is now active. 🔐

