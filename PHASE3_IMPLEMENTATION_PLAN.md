# Phase 3: Google Calendar OAuth Integration - Implementation Plan

**Date:** 2026-01-10  
**Status:** Planning Complete - Ready for Implementation  
**Based on:** Perplexity AI Research Results

---

## Problem Statement

Implement complete Google Calendar OAuth 2.0 flow for multi-tenant SaaS application to enable:
- Organization managers to connect their Google Calendars
- AI voice agent to check calendar availability in real-time
- Automatic appointment booking with SMS confirmations
- Secure token storage with encryption

**Key Distinction:**
- This is **NOT** user authentication OAuth (Supabase Auth handles that)
- This **IS** Google Calendar API OAuth (for accessing user's calendar data)
- These are **TWO SEPARATE** OAuth flows

---

## Implementation Phases

### Phase 3.1: OAuth Service with Encryption

**Goal:** Create core OAuth service with secure token encryption/decryption

**Steps:**
1. Create `backend/src/services/google-oauth-service.ts`
2. Implement AES-256-CBC encryption functions (encrypt/decrypt)
3. Initialize Google OAuth2 client with environment variables
4. Implement `getOAuthUrl(orgId)` - Generate authorization URL with state parameter
5. Implement `exchangeCodeForTokens(code, state)` - Exchange code, encrypt, store
6. Implement `getCalendarClient(orgId)` - Get authenticated calendar client with auto-refresh

**Acceptance Criteria:**
- ✅ Encryption functions work correctly (encrypt/decrypt tokens)
- ✅ OAuth URL generation includes correct scopes and state
- ✅ Token exchange stores encrypted tokens in database
- ✅ Auto-refresh logic works when token expires

**Dependencies:**
- `googleapis@168.0.0` (already installed)
- Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ENCRYPTION_KEY`

**Risk Assessment:**
- **Risk:** Encryption key not properly configured
  - **Mitigation:** Validate encryption key on startup, throw clear error if missing
- **Risk:** Token refresh fails silently
  - **Mitigation:** Catch errors, throw descriptive error message, log for debugging

---

### Phase 3.2: OAuth Routes

**Goal:** Create Express routes for OAuth flow (authorize, callback, revoke)

**Steps:**
1. Create `backend/src/routes/google-oauth.ts`
2. Implement `GET /api/google-oauth/authorize` - Redirect to Google OAuth
3. Implement `GET /api/google-oauth/callback` - Handle OAuth callback
4. Implement `POST /api/google-oauth/revoke` - Revoke access and delete tokens
5. Add authentication middleware (verify user/org context)
6. Add error handling and logging

**Acceptance Criteria:**
- ✅ `/authorize` redirects to Google with correct parameters
- ✅ `/callback` exchanges code, stores tokens, redirects to frontend
- ✅ `/revoke` deletes tokens from database
- ✅ Proper error handling and redirects on failure
- ✅ State parameter validated for CSRF protection

**Dependencies:**
- OAuth service (Phase 3.1)
- Authentication middleware (existing)

**Risk Assessment:**
- **Risk:** CSRF attacks via state parameter
  - **Mitigation:** Validate state parameter, encode orgId securely
- **Risk:** Missing orgId in callback
  - **Mitigation:** Validate orgId from state, handle gracefully

---

### Phase 3.3: Update Calendar Integration Service

**Goal:** Refactor calendar service to use OAuth service instead of direct API calls

**Steps:**
1. Update `backend/src/services/calendar-integration.ts`
2. Replace fetch-based API calls with googleapis library
3. Update `getAvailableSlots()` to use `getCalendarClient()` and `calendar.freebusy.query()`
4. Update `createCalendarEvent()` to use `getCalendarClient()` and `calendar.events.insert()`
5. Remove old fetch-based implementation
6. Add timezone support
7. Add error handling for token refresh failures

**Acceptance Criteria:**
- ✅ All functions use OAuth service (not direct fetch)
- ✅ Availability checking uses freebusy.query()
- ✅ Event creation uses calendar.events.insert()
- ✅ Timezone handling works correctly
- ✅ Token refresh failures handled gracefully

**Dependencies:**
- OAuth service (Phase 3.1)

**Risk Assessment:**
- **Risk:** Breaking existing functionality
  - **Mitigation:** Keep old code commented initially, test thoroughly before removing
- **Risk:** Timezone conversion errors
  - **Mitigation:** Use Luxon library (already installed) for timezone handling

---

### Phase 3.4: Add Routes to Express Server

**Goal:** Register OAuth routes in main Express server

**Steps:**
1. Update `backend/src/server.ts`
2. Import `googleOAuthRouter`
3. Register routes: `app.use('/api/google-oauth', googleOAuthRouter)`
4. Add route documentation
5. Verify route registration

**Acceptance Criteria:**
- ✅ Routes accessible at `/api/google-oauth/*`
- ✅ Routes properly mounted in Express app
- ✅ No conflicts with existing routes

**Dependencies:**
- OAuth routes (Phase 3.2)

---

### Phase 3.5: Environment Configuration

**Goal:** Set up environment variables and configuration

**Steps:**
1. Update `backend/.env.example` with new variables
2. Document required environment variables
3. Add validation for required variables on startup
4. Document Google Cloud Console setup steps

**Environment Variables Needed:**
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_ENCRYPTION_KEY=32_byte_hex_string_here  # Generate with: openssl rand -hex 32
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-oauth/callback  # Dev
# Production: https://callwaitingai.dev/api/google-oauth/callback
```

**Acceptance Criteria:**
- ✅ `.env.example` updated with all required variables
- ✅ Startup validation checks for required variables
- ✅ Clear error messages if variables missing

---

### Phase 3.6: Testing and Validation

**Goal:** Test complete OAuth flow end-to-end

**Steps:**
1. Test OAuth URL generation
2. Test OAuth callback handling
3. Test token storage and encryption
4. Test token refresh
5. Test calendar API calls (availability, event creation)
6. Test error scenarios (denied consent, expired tokens)
7. Manual testing of full flow

**Test Scenarios:**
1. **Happy Path:**
   - User clicks "Connect Google Calendar"
   - Redirected to Google OAuth
   - Grants permission
   - Redirected back, tokens stored
   - Calendar API calls work

2. **Error Scenarios:**
   - User denies consent
   - Token refresh fails
   - Missing environment variables
   - Invalid orgId

**Acceptance Criteria:**
- ✅ All test scenarios pass
- ✅ OAuth flow works end-to-end
- ✅ Tokens encrypted in database
- ✅ API calls work correctly
- ✅ Error handling works

---

## Technical Requirements

### Google Cloud Console Setup

1. **Enable Calendar API:**
   - Go to Google Cloud Console
   - APIs & Services → Enable APIs
   - Enable "Google Calendar API"

2. **Create OAuth 2.0 Client:**
   - APIs & Services → Credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Add Authorized redirect URIs:
     - Dev: `http://localhost:3000/api/google-oauth/callback`
     - Prod: `https://callwaitingai.dev/api/google-oauth/callback`

3. **Get Credentials:**
   - Copy Client ID and Client Secret
   - Add to environment variables

### Database Schema

**Table:** `integrations` (already exists)
- `org_id` (UUID, primary key)
- `provider` (text) - 'google_calendar'
- `config` (JSONB) - Stores encrypted tokens:
  ```json
  {
    "access_token": "encrypted_string",
    "refresh_token": "encrypted_string",
    "expires_at": "2026-01-10T12:00:00Z"
  }
  ```
- `active` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Dependencies

- `googleapis@168.0.0` ✅ (already installed)
- `crypto` (Node.js built-in) ✅
- Express.js ✅ (already installed)
- Supabase client ✅ (already configured)

---

## Security Considerations

1. **Token Encryption:**
   - AES-256-CBC encryption with random IV per token
   - Encryption key stored in environment (never in code)
   - Decrypt only when needed, never log plaintext tokens

2. **State Parameter:**
   - Encode orgId in state parameter using base64url
   - Validate state on callback to prevent CSRF
   - Include nonce/timestamp for additional security (future enhancement)

3. **Error Messages:**
   - Don't expose sensitive information in error messages
   - Log errors server-side, return generic messages to client

4. **HTTPS:**
   - Required in production for OAuth redirect URIs
   - Validate redirect URI matches configured values

---

## Success Criteria

### Phase 3 Complete When:
- [x] OAuth service implemented with encryption
- [ ] OAuth routes working (authorize, callback, revoke)
- [ ] Calendar integration using OAuth service
- [ ] Routes registered in Express server
- [ ] Environment variables configured
- [ ] End-to-end OAuth flow tested and working
- [ ] Tokens encrypted in database
- [ ] Auto-refresh working
- [ ] Error handling comprehensive
- [ ] Documentation complete

---

## Testing Strategy

### Unit Tests
- Encryption/decryption functions
- OAuth URL generation
- State parameter encoding/decoding

### Integration Tests
- OAuth callback flow
- Token storage and retrieval
- Calendar API calls

### Manual Testing
1. Complete OAuth flow in browser
2. Verify tokens stored encrypted
3. Test calendar availability checking
4. Test event creation
5. Test token refresh

---

## Documentation Requirements

1. **Setup Guide:**
   - Google Cloud Console configuration
   - Environment variables setup
   - Encryption key generation

2. **API Documentation:**
   - Route endpoints
   - Request/response formats
   - Error codes

3. **Developer Guide:**
   - How to use OAuth service
   - How to add new calendar functions
   - Troubleshooting guide

---

## Timeline Estimate

- **Phase 3.1:** 2 hours (OAuth service)
- **Phase 3.2:** 1.5 hours (OAuth routes)
- **Phase 3.3:** 2 hours (Calendar integration update)
- **Phase 3.4:** 0.5 hours (Route registration)
- **Phase 3.5:** 0.5 hours (Environment setup)
- **Phase 3.6:** 2 hours (Testing)

**Total:** ~8.5 hours

---

## Next Steps After Phase 3

Once Phase 3 is complete:
- **Phase 4:** Calendar Availability Checking (enhancements)
- **Phase 5:** Appointment Booking with SMS
- **Phase 6:** Vapi Webhook Integration

---

**Status:** ✅ Planning Complete - Ready to Execute
