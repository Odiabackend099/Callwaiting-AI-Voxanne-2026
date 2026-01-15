# 🚀 SYSTEM READINESS REPORT: From "Mock" to "Real"

**Status:** IN PROGRESS  
**Last Updated:** January 14, 2026  
**Objective:** Verify that all 4 critical infrastructure fixes are complete and functional.

---

## ✅ STEP 1: The "Identity" Fix (Backend)

**Problem:** Auth login is disconnected from database. New users have no `organization_id`.

**Required Action:** Deploy Supabase Auth Trigger that auto-creates Organization and Profile on signup.

### 1.1 Create the Migration File

**File:** `backend/migrations/[timestamp]_create_auth_trigger.sql`

**Verification Command:**
```bash
# Check if trigger exists in Supabase
supabase db remote show | grep handle_new_user_setup
```

**Expected Output:**
```
handle_new_user_setup | FUNCTION | postgres
```

**☐ COMPLETED:** Trigger function created  
**☐ COMPLETED:** Trigger bound to `auth.users` table  
**☐ COMPLETED:** Migration applied to production database

---

### 1.2 Verify the Trigger Works

**Test:** Create a new test user via Supabase Auth and verify the database response.

**Steps:**
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" and create a test user (e.g., `test-trigger@example.com`)
3. Run this query in Supabase SQL Editor:

```sql
SELECT 
  p.id, 
  p.email, 
  p.organization_id, 
  o.name as org_name, 
  o.status
FROM public.profiles p
LEFT JOIN public.organizations o ON p.organization_id = o.id
WHERE p.email = 'test-trigger@example.com';
```

**Expected Output:**
```
| id                   | email                  | organization_id      | org_name                     | status |
|----------------------|------------------------|----------------------|------------------------------|--------|
| [user_uuid]          | test-trigger@example.com | [org_uuid]          | test-trigger@example.com Organization | active |
```

**If query returns NO ROWS:**
- ❌ **TRIGGER NOT WORKING** — The function is not executing.
- Check Supabase logs: https://app.supabase.com/project/[project]/logs/postgres

**☐ COMPLETED:** New user auto-creates Organization  
**☐ COMPLETED:** New user auto-creates Profile  
**☐ COMPLETED:** Profile correctly links to Organization  
**☐ COMPLETED:** org_id is stamped into auth metadata

---

## ✅ STEP 2: The "Data Pipe" Fix (Frontend)

**Problem:** Dashboard shows mock/hardcoded data instead of real data from Supabase.

**Required Action:** Replace all hardcoded data with real API calls.

### 2.1 Remove Mock Data

**Search for and delete these patterns:**

```bash
# Find all mock data definitions
grep -r "mockCalls\|sampleTeam\|dummyData\|MOCK_\|const team = \[" src/ --include="*.tsx" --include="*.ts"
```

**Files to check:**
- [ ] `src/app/dashboard/calls/page.tsx`
- [ ] `src/app/dashboard/settings/team/page.tsx`
- [ ] `src/app/dashboard/page.tsx` (overview/stats)
- [ ] Any component in `src/components/dashboard/`

**Expected Result:** Zero hardcoded arrays or sample data.

**☐ COMPLETED:** No mock calls data  
**☐ COMPLETED:** No mock team members data  
**☐ COMPLETED:** No hardcoded statistics or chart data

---

### 2.2 Implement Real Data Fetching

**All data fetches must follow this pattern:**

```typescript
const { data: calls, isLoading, error } = useFetch(
  `/api/calls-dashboard?org_id=${orgId}`
);

if (isLoading) return <Skeleton />;
if (error) return <ErrorState />;
if (!calls || calls.length === 0) return <EmptyState />;

return calls.map(call => <CallRow key={call.id} call={call} />);
```

**Files to verify:**
- [ ] `src/app/dashboard/calls/page.tsx` — uses `/api/calls-dashboard`
- [ ] `src/app/dashboard/settings/team/page.tsx` — uses `/api/team/members`
- [ ] `src/components/dashboard/StatsOverview.tsx` — uses `/api/calls-dashboard/stats`

**Verification Command:**
```bash
# Check for SWR/useFetch imports
grep -r "useFetch\|useSWR\|useQuery" src/app/dashboard/ --include="*.tsx"
```

**Expected:** All data fetches use a hook, not hardcoded arrays.

**☐ COMPLETED:** Calls page uses real API  
**☐ COMPLETED:** Team page uses real API  
**☐ COMPLETED:** Stats/overview uses real API  
**☐ COMPLETED:** All pages show "No data" when database is empty (not mock data)

---

### 2.3 Test the Empty State

**Verification Steps:**
1. Log out completely
2. Clear browser cache: `Cmd+Shift+Delete`
3. Log in with a fresh test user account
4. Navigate to `/dashboard`

**Expected Result:**
```
- Total Calls: 0 (or "—")
- Team Members: (empty list with "No team members yet" message)
- Recent Calls: (empty table with "No calls yet" message)
```

**If you see any names, numbers, or sample data:**
- ❌ **MOCK DATA STILL PRESENT** — Find and delete the hardcoded array.

**☐ COMPLETED:** Dashboard is empty for new user  
**☐ COMPLETED:** No phantom data appears  
**☐ COMPLETED:** UI gracefully handles empty states

---

## ✅ STEP 3: The "OAuth" Fix (Integration)

**Problem:** Google Calendar authorization fails with "Missing organization_id" error.

**Required Action:** Rewrite OAuth route to fetch org_id from server-side session, not frontend.

### 3.1 Fix the Authorize Route

**File:** `src/app/api/auth/google-calendar/authorize/route.ts`

**Requirements:**
- [ ] Uses `createServerClient` with cookies
- [ ] Calls `supabase.auth.getSession()`
- [ ] Fetches `organization_id` from `profiles` table
- [ ] Returns error if `organization_id` not found
- [ ] Passes `org_id` to backend OAuth URL

**Verification Command:**
```bash
curl -X GET http://localhost:3000/api/auth/google-calendar/authorize \
  -H "Cookie: [your_session_cookie]"
```

**Expected Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Error Responses (should NOT see):**
- ❌ `"Missing organization ID"` — OAuth route still broken
- ❌ `"Unauthorized"` — Session not being fetched correctly

**☐ COMPLETED:** Route fetches org_id from database  
**☐ COMPLETED:** Route returns valid OAuth URL  
**☐ COMPLETED:** No "Missing organization_id" error

---

### 3.2 Fix the "Save Changes" Button

**File:** `src/app/dashboard/settings/page.tsx`

**Requirements:**
- [ ] Form data is collected (org name, etc.)
- [ ] Clicking "Save" sends `PATCH /api/organizations/{org_id}`
- [ ] Success shows toast notification
- [ ] Error shows error message
- [ ] Toast persists after page refresh

**Code Pattern:**
```typescript
const handleSaveChanges = async (formData: OrgSettings) => {
  try {
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!res.ok) throw new Error('Failed to save');
    
    toast.success('Changes saved!');
    // Data persists in DB—no need to refresh UI manually
  } catch (error) {
    toast.error(error.message);
  }
};
```

**Verification Steps:**
1. Open `/dashboard/settings`
2. Change the organization name
3. Click "Save Changes"
4. Verify green "Saved" toast appears
5. Refresh the page (`Cmd+R`)
6. Verify the new name persists (from database, not localStorage)

**Expected Result:**
```
"Organization Name: Acme Clinic"
[After refresh] → Still shows "Acme Clinic"
```

**If it reverts to old name:**
- ❌ Save is not hitting the database (check Network tab in DevTools)

**☐ COMPLETED:** Save button sends PATCH request  
**☐ COMPLETED:** Success toast appears  
**☐ COMPLETED:** Changes persist after refresh  
**☐ COMPLETED:** Data saved to Supabase (not localStorage)

---

### 3.3 Fix Google Calendar Linking

**File:** `backend/routes/calendar-oauth.ts` (or wherever callback is handled)

**Requirements:**
- [ ] `GET /api/calendar/auth/url` accepts `org_id` parameter
- [ ] Callback route saves tokens to `calendar_connections` table with correct `org_id`
- [ ] User is not prompted for "Missing organization_id"

**Verification Steps:**
1. Open `/dashboard/settings`
2. Click "Link My Google Calendar"
3. Authorize with your Google account
4. Should redirect back to dashboard (not error page)

**Check in Supabase:**
```sql
SELECT * FROM public.calendar_connections 
WHERE organization_id = '[your_org_id]';
```

**Expected Output:**
```
| id | organization_id | google_access_token | google_refresh_token | created_at |
|----|-----------------|---------------------|----------------------|------------|
| 1  | [your_org_uuid] | ya29.a0AfH6... | 1//0gW... | 2026-01-14 |
```

**If no rows returned:**
- ❌ Callback didn't save tokens (check backend logs)

**☐ COMPLETED:** Google OAuth URL is generated correctly  
**☐ COMPLETED:** Callback saves tokens to database  
**☐ COMPLETED:** No "Missing organization_id" error  
**☐ COMPLETED:** Calendar tokens are linked to correct org

---

## ✅ STEP 4: The "Audit" Implementation

**Problem:** No way to verify the system is working without checking code.

**Required Action:** Create a System Status page showing real-time infrastructure state.

### 4.1 Create Status Route

**File:** `src/app/api/status/route.ts`

**Response should return:**
```json
{
  "status": "healthy",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "660e8400-e29b-41d4-a716-446655440000",
  "organization_name": "Acme Clinic",
  "session_valid": true,
  "database_connected": true,
  "recent_queries": [
    {
      "table": "profiles",
      "operation": "SELECT",
      "timestamp": "2026-01-14T15:30:42Z",
      "row_count": 1
    }
  ]
}
```

**☐ COMPLETED:** Route returns user_id  
**☐ COMPLETED:** Route returns organization_id from database  
**☐ COMPLETED:** Route returns organization_name  
**☐ COMPLETED:** Route indicates session validity  
**☐ COMPLETED:** Route shows database connection status

---

### 4.2 Create Status Dashboard Page

**File:** `src/app/dashboard/admin/status/page.tsx`

**Display Format:**
```
═══════════════════════════════════════════════════════════
                    SYSTEM STATUS PAGE
═══════════════════════════════════════════════════════════

✅ Session Status: ACTIVE
   User ID: 550e8400-e29b-41d4-a716-446655440000
   Email: user@example.com

✅ Organization Status: LINKED
   Org ID: 660e8400-e29b-41d4-a716-446655440000
   Org Name: Acme Clinic

✅ Database Status: CONNECTED
   Profiles: 1 record(s)
   Organizations: 1 record(s)

Recent Queries:
────────────────────────────────────────────────────────────
[2026-01-14 15:30:42] SELECT profiles WHERE id = ?
[2026-01-14 15:30:40] SELECT organizations WHERE id = ?
[2026-01-14 15:30:35] SELECT * FROM calendar_connections
```

**Verification Steps:**
1. Navigate to `/dashboard/admin/status`
2. Verify all ✅ marks are present
3. Verify your actual user_id and organization_id (not fake UUIDs)

**If any ❌ appears:**
- ❌ `Session Status: INVALID` — Auth is broken
- ❌ `Organization Status: NOT LINKED` — Step 1 failed
- ❌ `Database Status: NO CONNECTION` — Supabase is down or credentials wrong

**☐ COMPLETED:** Status page accessible at `/dashboard/admin/status`  
**☐ COMPLETED:** Displays real user_id and organization_id  
**☐ COMPLETED:** Shows database connection status  
**☐ COMPLETED:** All indicators show ✅ (healthy)

---

## 🧪 FINAL VERIFICATION TEST

**Run these tests IN ORDER to prove the system is "Real":**

### Test 1: Fresh User Signup

```bash
1. Log out completely
2. Clear cache (Cmd+Shift+Delete)
3. Create a NEW Supabase user via auth form
4. Check Supabase: SELECT * FROM profiles;
```

**Expected:** Profile row exists with organization_id populated.

**☐ PASS:** Profile auto-created

---

### Test 2: Empty Dashboard

```bash
1. Log in as the new user
2. Go to /dashboard
3. Go to /dashboard/settings/team
```

**Expected:** Both show "No data" or empty states (NOT mock data).

**☐ PASS:** Dashboard is empty (real data)

---

### Test 3: Google OAuth

```bash
1. Go to /dashboard/settings
2. Click "Link Google Calendar"
3. Authorize with a Google account
```

**Expected:** Redirect to dashboard, no "Missing organization_id" error.

**☐ PASS:** OAuth succeeds without org_id error

---

### Test 4: Save Settings

```bash
1. Go to /dashboard/settings
2. Change organization name to "Test Org 2026"
3. Click "Save Changes"
4. See success toast
5. Refresh the page (Cmd+R)
```

**Expected:** Name persists as "Test Org 2026" (from DB, not cache).

**☐ PASS:** Changes persist after refresh

---

### Test 5: System Integrity Check

```bash
1. Open browser console: F12 → Console
2. Run:

async function verifySystem() {
  const res = await fetch('/api/status');
  const data = await res.json();
  
  const checks = {
    'User ID Present': !!data.user_id && data.user_id !== 'undefined',
    'Org ID Present': !!data.organization_id && data.organization_id !== 'undefined',
    'Org Name Present': !!data.organization_name,
    'Session Valid': data.session_valid === true,
    'Database Connected': data.database_connected === true,
  };

  console.table(checks);
  return Object.values(checks).every(v => v);
}

await verifySystem();
```

**Expected Output:**
```
✅ User ID Present          true
✅ Org ID Present           true
✅ Org Name Present         true
✅ Session Valid            true
✅ Database Connected       true

Result: true
```

**If any `false` appears:**
- ❌ System is still broken at that layer

**☐ PASS:** All checks return true

---

## 📋 SIGN-OFF CHECKLIST

**When ALL of these are checked, the system is "REAL":**

### Backend Infrastructure
- [ ] Supabase Auth Trigger deployed
- [ ] New users auto-create Organization record
- [ ] New users auto-create Profile record linked to Org
- [ ] org_id is stamped into auth metadata

### Frontend Data
- [ ] No hardcoded mock data in any component
- [ ] All API calls use SWR/React Query hooks
- [ ] Empty states display correctly (no phantom data)
- [ ] Dashboard is empty for new users

### OAuth Integration
- [ ] Google Calendar authorize route fetches org_id from DB
- [ ] Save Changes button sends PATCH request to Supabase
- [ ] Changes persist after page refresh
- [ ] Calendar tokens save to correct organization

### System Monitoring
- [ ] Status API endpoint returns real user/org data
- [ ] Status dashboard page displays correctly
- [ ] Browser console verification script passes all checks

### User Acceptance Tests
- [ ] ✅ Test 1: Fresh user signup creates profile
- [ ] ✅ Test 2: Dashboard shows empty (not mock)
- [ ] ✅ Test 3: Google OAuth succeeds
- [ ] ✅ Test 4: Settings changes persist
- [ ] ✅ Test 5: System integrity verified

---

## 🚨 RED FLAGS

**If you see ANY of these, the system is still broken:**

| Red Flag | Meaning | What to Do |
|----------|---------|-----------|
| "0 Calls" + sees old logs below | Mock data still exists | Search for `mockCalls` in code |
| "Missing organization_id" error | Step 1 or 3 failed | Run Step 1 SQL trigger and Step 3 OAuth fix |
| Team Members list populated for new user | Orphaned data exists | Truncate `profiles` and `organizations` tables |
| "Save Changes" button doesn't persist | Step 3 failed | Check `/api/organizations` endpoint returns 200 |
| Status page shows ❌ indicators | System is not connected | Fix the broken layer (Auth/DB/OAuth) |

---

**Last Checkpoint:**  
When you can see the ✅ next to "All checks return true" in Test 5, your system has moved from "Mock" to "Real."

**Current Status:** READY FOR IMPLEMENTATION

