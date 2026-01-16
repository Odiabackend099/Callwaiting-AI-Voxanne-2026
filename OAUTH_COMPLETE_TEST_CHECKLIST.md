# OAuth Unified Flow - Complete Test Checklist

## Pre-Test Verification

- [ ] Frontend dev server is running (`npm run dev` on port 3000)
- [ ] Backend server is running (`npm run start` on port 3001)
- [ ] Both servers show "Ready" or "listening" messages
- [ ] You are logged in with a valid account
- [ ] User has `org_id` in JWT app_metadata (check DevTools → Application → localStorage → sb-auth)
- [ ] Browser DevTools console is open (F12)

## Test 1: OAuth Flow Initiation

### Step 1.1: Navigate to API Keys Page
- [ ] Go to `http://localhost:3000/dashboard/api-keys`
- [ ] Page loads without errors
- [ ] "Validating access..." spinner appears briefly, then disappears
- [ ] Calendar Integration section is visible
- [ ] "Link My Google Calendar" button is visible

### Step 1.2: Initiate OAuth Flow
- [ ] Click "Link My Google Calendar" button
- [ ] Check DevTools Network tab:
  - [ ] Request to `/api/auth/google-calendar/authorize` appears
  - [ ] Request shows `Accept: application/json` header
  - [ ] Response is JSON with `authUrl` field
  - [ ] Response status is 200 OK

### Step 1.3: Verify OAuth Request Logging
- [ ] Check browser console for log: `[Google OAuth] Got org_id from JWT: <UUID>`
- [ ] Check browser console for log: `[Google OAuth] Calling unified endpoint: http://localhost:3001/api/google-oauth/authorize?org_id=<UUID>`
- [ ] Check browser console for log: `[Google OAuth] Auth URL generated successfully`

## Test 2: Google Consent Screen

### Step 2.1: Google OAuth Redirect
- [ ] Browser redirects to Google OAuth consent screen
- [ ] URL pattern: `https://accounts.google.com/o/oauth2/v2/auth?...`
- [ ] Page shows Google Account selection / login if needed
- [ ] Page shows "Voxanne" app name (or your app name)
- [ ] Page requests calendar permissions:
  - [ ] "See, create, and delete your Google Calendar events"
  - [ ] "View your Google Calendar settings"

### Step 2.2: Verify Redirect in Backend Logs
- [ ] Check backend server logs (terminal) for message: `Authorize endpoint called { orgId: '<UUID>', acceptsJSON: true }`
- [ ] Check backend logs for message: `Redirecting to Google OAuth { orgId: '<UUID>' }`

### Step 2.3: Grant Permissions
- [ ] Click "Allow" or equivalent button on Google consent screen
- [ ] Wait for Google to process your consent

## Test 3: OAuth Callback

### Step 3.1: Verify Callback
- [ ] Browser redirects back to your app
- [ ] URL is: `http://localhost:3000/dashboard/api-keys?success=calendar_connected`
- [ ] **NOT** `/dashboard/settings?...` (the old broken behavior)

### Step 3.2: Verify Backend Callback Processing
- [ ] Check backend logs for message: `OAuth callback received { hasCode: true, hasState: true, ... }`
- [ ] Check backend logs for message: `OAuth callback successful { orgId: '<UUID>' }`
- [ ] If you see error logs, note the error message for debugging

### Step 3.3: Verify Tokens Stored
- [ ] In database, query: `SELECT id, org_id, provider, is_active FROM org_credentials WHERE org_id='<UUID>' AND provider='google_calendar'`
- [ ] Should return 1 row with `provider='google_calendar'` and `is_active=true`

## Test 4: Frontend Success Display

### Step 4.1: Verify Success Message
- [ ] Green success message appears on page
- [ ] Message text is: "Calendar connected successfully!" (or includes email)
- [ ] Success message is in a green/emerald styled box
- [ ] No error messages appear

### Step 4.2: Verify Page Updates
- [ ] URL parameters are cleared from address bar (shows just `/dashboard/api-keys`)
- [ ] Page automatically refreshes calendar status
- [ ] Calendar status updates to: "Linked (your.email@gmail.com)"
- [ ] Calendar icon changes from blue to emerald/green

### Step 4.3: Verify Browser Logs
- [ ] Check console for log: `[Google OAuth] Auth URL generated successfully { hasUrl: true }`
- [ ] No error logs related to OAuth should appear
- [ ] If there are logs for `fetchCalendarStatus`, they should show successful response

## Test 5: Calendar Status Display

### Step 5.1: Verify Connected State
- [ ] Calendar Integration section shows green checkmark or checkmark icon
- [ ] Calendar status text shows: "Linked"
- [ ] Email address is displayed: "(your.email@gmail.com)"
- [ ] "Link My Google Calendar" button is disabled (grayed out)
- [ ] Button text changed to: "Connected"

### Step 5.2: Verify Status API
- [ ] In DevTools Network tab, find request to `/api/google-oauth/status`
- [ ] Request status is 200 OK
- [ ] Response JSON includes:
  ```json
  {
    "connected": true,
    "email": "your.email@gmail.com",
    "hasTokens": true,
    "connectedAt": "<timestamp>"
  }
  ```

## Test 6: Error Scenarios (Optional)

### Test 6.1: User Denies Consent
- [ ] Navigate to API Keys page
- [ ] Click "Link My Google Calendar"
- [ ] On Google consent screen, click "Cancel" or "Don't allow"
- [ ] **Expected**: Redirected back to `/dashboard/api-keys?error=user_denied_consent`
- [ ] **Expected**: Red error message: "You denied Google Calendar access..."
- [ ] No tokens should be stored
- [ ] Calendar status still shows "Not Linked"

### Test 6.2: Network Error During Callback
- [ ] Navigate to API Keys page
- [ ] Click "Link My Google Calendar"
- [ ] On Google consent screen, allow permissions
- [ ] Open DevTools Network tab and set throttling to "Offline"
- [ ] During callback, network goes offline
- [ ] **Expected**: Error message displayed
- [ ] **Expected**: Redirect to `/dashboard/api-keys?error=oauth_callback_failed`

### Test 6.3: Invalid State Parameter
- [ ] Manually navigate to callback URL with invalid state
- [ ] `http://localhost:3001/api/google-oauth/callback?code=FAKE&state=INVALID`
- [ ] **Expected**: Error message about state validation
- [ ] **Expected**: Redirect to `/dashboard/api-keys?error=oauth_state_invalid`

## Test 7: Multi-Tenant Isolation

### Test 7.1: Verify Organization Separation
- [ ] Create/use 2 different user accounts in 2 different organizations
- [ ] User A: Link Google Calendar
- [ ] User B: Navigate to API Keys page
- [ ] **Expected**: User B cannot see User A's calendar credentials
- [ ] **Expected**: User B can link their own calendar independently
- [ ] In database, verify:
  - [ ] User A's credentials have `org_id=<ORG_A_UUID>`
  - [ ] User B's credentials have `org_id=<ORG_B_UUID>`
  - [ ] No mixing of org_ids in org_credentials table

## Test 8: Backward Compatibility

### Test 8.1: Legacy Parameter Handling
- [ ] Check api-keys page code handles both old and new parameters
- [ ] Code should recognize both:
  - [ ] `success=calendar_connected` (new unified format)
  - [ ] `calendar=connected` (old calendar-oauth.ts format)
- [ ] Both parameter patterns should display success message

## Test 9: Performance Check

### Test 9.1: Response Times
- [ ] Authorization initiation: < 500ms
- [ ] OAuth URL generation: < 100ms
- [ ] Google OAuth consent screen load: < 2s
- [ ] Callback processing: < 500ms
- [ ] Calendar status fetch: < 200ms
- [ ] Overall flow (click to success): < 30s

### Test 9.2: No Memory Leaks
- [ ] After 10 OAuth cycles, memory usage remains stable
- [ ] DevTools Memory profiler shows no retained objects
- [ ] No console warnings about uncleared timers

## Test 10: Code Quality

### Test 10.1: TypeScript Compilation
- [ ] Run `npm run build` without errors
- [ ] All modified files compile successfully
- [ ] No "any" type warnings in OAuth-related code

### Test 10.2: Console Warnings
- [ ] Browser console shows no React warnings
- [ ] Browser console shows no deprecation warnings
- [ ] Browser console shows no security warnings

## Verification Checklist

### File Changes
- [ ] `backend/src/routes/google-oauth.ts` - Unified endpoint implemented
- [ ] `src/app/api/auth/google-calendar/authorize/route.ts` - Calls unified endpoint
- [ ] `src/app/dashboard/api-keys/page.tsx` - Handles all callback parameters
- [ ] Commit `67189e5` exists with proper message

### Documentation
- [ ] `OAUTH_UNIFIED_FIX.md` - Technical explanation created
- [ ] `OAUTH_FLOW_TEST.md` - Test guide created
- [ ] `OAUTH_FIX_SUMMARY.md` - Summary created

### No Breaking Changes
- [ ] Org validation still works (`useOrgValidation` hook)
- [ ] Multi-tenant isolation preserved
- [ ] Auth middleware unchanged (except for caching optimization)
- [ ] Token storage unchanged (still uses org_credentials)
- [ ] CSRF protection preserved (state parameter)

## Final Sign-Off

- [ ] All tests 1-7 completed successfully
- [ ] Performance meets expectations (Test 9)
- [ ] Code quality verified (Test 10)
- [ ] No breaking changes detected
- [ ] Multi-tenant structure intact
- [ ] Ready for production

## Notes / Issues Found

```
(Space for recording any issues, workarounds, or additional notes)

```

---

**Test Date**: _____________
**Tester Name**: _____________
**Result**: [ ] PASS [ ] FAIL
**Sign-off**: _____________
