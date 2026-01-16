# OAuth Unified Flow - Manual Testing Guide

## Test Scenario: Calendar Connection

### Prerequisites
- Logged in as a user with a valid org_id
- At `/dashboard/api-keys` page
- Network tab in DevTools open

### Test Steps

#### Step 1: Initiate OAuth
1. Click "Link My Google Calendar" button
2. **Expect**: Network call to `/api/auth/google-calendar/authorize`
3. **Log in DevTools**:
   ```
   Frontend → GET /api/auth/google-calendar/authorize
   Backend → GET /api/google-oauth/authorize?org_id=<UUID>
   Accept: application/json (header added by frontend)
   ```
4. **Response Expected**: JSON
   ```json
   {
     "success": true,
     "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
     "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
   }
   ```

#### Step 2: Google Consent Screen
1. **Expect**: Redirected to Google OAuth consent screen
2. **URL**: `https://accounts.google.com/o/oauth2/v2/auth?...`
3. **Scopes Requested**:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
4. Click "Allow" to grant permissions

#### Step 3: OAuth Callback
1. **Expect**: Redirected back to frontend
2. **URL Should Be**: `http://localhost:3000/dashboard/api-keys?success=calendar_connected`
3. **NOT**: `http://localhost:3000/dashboard/settings?...` (the old broken behavior)
4. **Network Log**:
   ```
   Backend → GET /api/google-oauth/callback?code=<AUTH_CODE>&state=<STATE>
   Response: Redirect to /dashboard/api-keys?success=calendar_connected
   ```

#### Step 4: Success Display
1. **Expect**: Green success message appears:
   - "Calendar connected successfully!" (if no email in params)
   - "Calendar connected successfully! (user@gmail.com)" (if email available)
2. **Automatic Actions**:
   - URL parameters cleared from address bar
   - Calendar status refreshed
   - "Linked (your.email@gmail.com)" appears under Google Calendar status

### Test Assertions

✅ **PASS Criteria:**
- [ ] Frontend redirects to correct backend endpoint
- [ ] Backend returns JSON (not redirect) when Accept header is set
- [ ] Google OAuth consent screen appears
- [ ] User redirected back to `/dashboard/api-keys` (not `/settings`)
- [ ] Success message displays
- [ ] Calendar status shows "Linked" with email address
- [ ] URL parameters cleared after display

❌ **FAIL Criteria:**
- Redirected to `/dashboard/settings` instead of `/dashboard/api-keys`
- Success message never appears
- Calendar status remains "Not Linked"
- Network shows error responses

### Debug Information

If test fails, check browser console for:

**Frontend Logs** (Next.js):
```
[Google OAuth] Got org_id from JWT: <ORG_ID>
[Google OAuth] Using backend URL: http://localhost:3001
[Google OAuth] Calling unified endpoint: http://localhost:3001/api/google-oauth/authorize?org_id=<ORG_ID>
[Google OAuth] Auth URL generated successfully
```

**Backend Logs** (Express):
```
Authorize endpoint called { orgId: '<ORG_ID>', acceptsJSON: true }
Redirecting to Google OAuth { orgId: '<ORG_ID>' }
OAuth callback received { hasCode: true, hasState: true, ... }
OAuth callback successful { orgId: '<ORG_ID>' }
```

**Network Errors to Check:**
1. `/api/google-oauth/authorize` returns 400 → org_id not passed correctly
2. `/api/google-oauth/authorize` returns 500 → backend OAuth service error
3. `/api/google-oauth/callback` returns redirect to settings → OLD code still running
4. Success message not showing → parameter name mismatch (check API Keys page logic)

### Cleanup (if needed)

To test again without needing new Google credentials:
1. Go to `/dashboard/api-keys`
2. Calendar shows as "Linked"
3. Need to revoke access first (if disconnect button exists)
4. Or reset database: `DELETE FROM org_credentials WHERE org_id='...' AND provider='google_calendar'`

## Architecture Verification

### Endpoint Consolidation
```
OLD (Broken):
  Frontend → /api/auth/google-calendar/authorize
         ↓
  Backend → /api/calendar/auth/url (calendar-oauth.ts)
         ↓
  Callback → /api/google-oauth/callback (google-oauth.ts) ← MISMATCH!

NEW (Fixed):
  Frontend → /api/auth/google-calendar/authorize
         ↓
  Backend → /api/google-oauth/authorize (google-oauth.ts) ← UNIFIED
         ↓
  Callback → /api/google-oauth/callback (same endpoint)
         ↓
  Parameter handling → success=calendar_connected ← CONSISTENT
```

### Parameter Flow
```
OLD (Inconsistent):
  calendar-oauth.ts redirects with: ?calendar=connected&email=...
  api-keys/page.tsx checks for:   ?success=calendar_connected
  Result: Parameters don't match → no success display

NEW (Consistent):
  google-oauth.ts redirects with: ?success=calendar_connected
  api-keys/page.tsx checks for:   ?success=calendar_connected
  Result: Parameters match → success displays correctly
```
