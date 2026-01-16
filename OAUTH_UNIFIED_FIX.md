# OAuth Architecture Fix - Unified Flow

## Problem Statement
User was stuck on `/dashboard/settings` after OAuth callback instead of being redirected to `/dashboard/api-keys`. Calendar status never showed as "Linked".

## Root Cause
**Architectural collision with two independent OAuth flows:**

1. Frontend called: `/api/auth/google-calendar/authorize`
2. Which called backend: `/api/calendar/auth/url` (calendar-oauth.ts)
3. But callback expected: `/api/google-oauth/callback` (google-oauth.ts)
4. Parameter mismatch: `calendar=connected` vs `success=calendar_connected`

**Result:** Success callback never triggered, page stayed on settings without refresh.

## Solution: OAuth Consolidation

### What Changed

#### 1. Backend: Unified OAuth Endpoint (`google-oauth.ts:38-100`)
- **Single source of truth**: `/api/google-oauth/authorize` is now the ONLY OAuth entry point
- **Smart response format**:
  - Returns JSON when called via `Accept: application/json` header (API requests)
  - Returns redirect when called directly (browser navigation)
- **Parameter compatibility**: Accepts both `orgId` and `org_id` for backward compatibility
- **Error handling**: Consistent error responses for all failure cases

```typescript
// Response format (JSON)
{
  success: true,
  url: "https://accounts.google.com/o/oauth2/v2/auth?...",
  authUrl: "https://accounts.google.com/..." // Also included for compatibility
}
```

#### 2. Frontend API Route (`src/app/api/auth/google-calendar/authorize/route.ts:71-107`)
- Now calls unified backend endpoint: `/api/google-oauth/authorize`
- Explicitly requests JSON response via `Accept: application/json` header
- Handles both `url` and `authUrl` response fields
- Better error messages

#### 3. API Keys Page (`src/app/dashboard/api-keys/page.tsx:77-130`)
- Handles all callback parameter variations
- Supports both old (`calendar=connected`) and new (`success=calendar_connected`) formats
- Automatically refreshes calendar status on successful connection
- Shows detailed error messages with debugging info

## Why This Works (Industry Best Practices)

| Aspect | Before | After |
|--------|--------|-------|
| **Single Source of Truth** | ❌ Two endpoints | ✅ One endpoint |
| **Response Format** | ❌ Only redirects | ✅ JSON or redirect |
| **Parameter Naming** | ❌ Inconsistent | ✅ Unified with compatibility |
| **Error Handling** | ❌ Inconsistent messages | ✅ Consistent formats |
| **API Contracts** | ❌ Implicit | ✅ Explicit content negotiation |
| **Backward Compatibility** | ✅ Works | ✅ Still works |

## Testing the Fix

1. Click "Link My Google Calendar" on `/dashboard/api-keys`
2. Redirected to Google OAuth consent screen (working ✅)
3. Grant permissions
4. Redirected back to `/dashboard/api-keys` (NOW FIXED ✅)
5. See success message "Calendar connected successfully!" (NOW FIXED ✅)
6. Calendar status updates to "Linked (your.email@gmail.com)" (NOW FIXED ✅)

## Technical Details

### Content Negotiation
The backend uses Express's `req.accepts()` to determine response format:
```typescript
if (req.accepts('json')) {
  // API caller (Next.js route) → return JSON
  res.json({ success: true, authUrl: url });
} else {
  // Browser navigation → return redirect
  res.redirect(authUrl);
}
```

### Token Storage
Tokens continue to be stored in `org_credentials` table via `exchangeCodeForTokens()` from `google-oauth-service.ts`:
- Provider: `google_calendar`
- Encryption: AES-256-GCM (industry standard)
- Token refresh: Automatic on expiry

### Security Preserved
- CSRF protection via state parameter (base64 encoded with org_id)
- org_id validation in callbacks
- No public endpoints for credential retrieval

## Files Modified
- `backend/src/routes/google-oauth.ts` - Unified endpoint
- `src/app/api/auth/google-calendar/authorize/route.ts` - Call unified endpoint
- `src/app/dashboard/api-keys/page.tsx` - Handle callbacks correctly

## Future Improvements
- Consider removing `calendar-oauth.ts` entirely (now redundant)
- Consolidate other OAuth flows using same pattern
- Add OpenAPI/Swagger documentation for content negotiation
