# 🎫 Problem Tickets - Prioritized for Systematic Resolution

**Created**: January 11, 2026
**Total Issues**: 7 Critical/High Priority
**Estimated Effort**: Medium (1-2 days for critical items)

---

## 🔴 CRITICAL - Fix Immediately

---

### Ticket 1: Rate Limiting Issue (429 Errors) - BLOCKING

**Severity**: 🔴 **CRITICAL** (API calls being rejected)

**Problem**:
Multiple API endpoints returning `429 Too Many Requests` errors:
- `/api/founder-console/settings` - Called repeatedly on page load
- `/api/founder-console/agent/config` - Settings page
- `/api/assistants/voices/available` - Voice selection
- `/api/inbound/status` - Inbound config page

**Root Cause Analysis**:
1. **Duplicate API Calls**: Frontend components calling `/api/founder-console/settings` AND `/api/integrations/status` simultaneously for same data
2. **Fast Refresh Constant Rebuilds**: Each file save triggers data refetch → rate limit hit quickly
3. **No Request Deduplication**: Multiple components independently fetching same data
4. **Possible Rate Limit Middleware**: Check `backend/src/middleware/rate-limit.ts`

**Evidence**:
```
Console: GET /api/founder-console/settings 429 Too Many Requests
Console: Failed to load available voices
Pages not loading settings, agent config, or voice options
```

**Tasks**:
- [ ] Investigate rate limit middleware configuration in `backend/src/middleware/rate-limit.ts`
- [ ] Check rate limits per user/org (too strict?)
- [ ] Review FastRefresh configuration (why rebuilding so often?)
- [ ] Add request deduplication/caching at frontend level
- [ ] Implement retry logic with exponential backoff
- [ ] Test with repeated page loads (should not hit rate limit)

**Acceptance Criteria**:
- [ ] No 429 errors in console after multiple page loads
- [ ] Voice selection loads without errors
- [ ] Settings page responds within 2 seconds
- [ ] Agent config loads on first try

**Files to Check**:
- `backend/src/middleware/rate-limit.ts`
- `backend/src/server.ts` (middleware registration)
- `src/lib/authed-backend-fetch.ts` (frontend fetch logic)
- `src/app/dashboard/settings/page.tsx` (multiple fetches?)

**Estimated Time**: 1-2 hours

---

### Ticket 2: Missing /api/contacts Endpoints - BLOCKING

**Severity**: 🔴 **CRITICAL** (Dashboard broken)

**Problem**:
Frontend attempts to fetch contacts but gets 404:
```
GET /api/contacts?page=1&limit=20 → 404 Not Found
GET /api/contacts/stats → 404 Not Found
```

**Root Cause**:
- Contacts route exists at `backend/src/routes/contacts.ts`
- Route NOT registered in `backend/src/server.ts`
- Frontend tries to fetch but backend has no handler

**Current State**:
```javascript
// ❌ contacts.ts exists and has proper endpoints
contactsRouter.get('/', async (req, res) => { ... });

// ❌ BUT server.ts doesn't register it
// Missing: app.use('/api/contacts', contactsRouter);
```

**Impact**:
- Contacts/leads dashboard page shows empty or error state
- Users can't see their contact history
- Dashboard metrics don't load

**Tasks**:
- [ ] Add contacts route to `backend/src/server.ts`
- [ ] Verify route is registered before server starts
- [ ] Test GET /api/contacts?page=1&limit=20 returns data
- [ ] Test GET /api/contacts/stats returns stats
- [ ] Check if other routes are missing registration too

**Acceptance Criteria**:
- [ ] GET /api/contacts responds with paginated contacts
- [ ] GET /api/contacts/stats responds with stats
- [ ] Dashboard contacts page loads without errors
- [ ] No 404 errors in console

**Files to Fix**:
- `backend/src/server.ts` - Add missing route registration

**Code Changes**:
```typescript
// In backend/src/server.ts, around line 180-190:
import contactsRouter from './routes/contacts';
import notificationsRouter from './routes/notifications';

// Add this line:
app.use('/api/contacts', contactsRouter);
app.use('/api/notifications', notificationsRouter);
```

**Estimated Time**: 15 minutes

---

### Ticket 3: Credential Configuration Scattered (Vapi) - ARCHITECTURAL

**Severity**: 🔴 **CRITICAL** (User confusion, data inconsistency)

**Problem**:
Vapi API Key can be configured in THREE different places with NO single source of truth:

| Page | URL | Endpoint | Table | Issue |
|---|---|---|---|---|
| Settings | `/dashboard/settings` | `/api/founder-console/settings` | `integration_settings` | Step 1: Enter Vapi API Key |
| API Keys | `/dashboard/api-keys` | `/api/founder-console/settings` | `integration_settings` | Vapi Configuration section |
| Integrations (NEW) | `/dashboard/integrations` | `/api/integrations/vapi` | `integrations` OR `org_credentials` | New BYOC implementation |

**User Impact**:
- Confusion: "Which page should I use to configure Vapi?"
- Data Loss: Saving on one page might not be reflected on another
- Backend Inconsistency: Services fetch from different tables
- New BYOC system conflicts with existing system

**Root Cause**:
BYOC implementation created NEW integrations page/endpoints without consolidating or removing the existing settings/api-keys pages. Now both systems coexist.

**Tasks**:
- [ ] Decide: Which page is source of truth? (Answer: /dashboard/integrations should be THE page)
- [ ] Consolidate all Vapi config to /dashboard/integrations page
- [ ] Remove Vapi config section from /dashboard/settings
- [ ] Remove Vapi config section from /dashboard/api-keys
- [ ] Consolidate backend endpoints to /api/integrations/* only
- [ ] Deprecate /api/founder-console/settings for Vapi (but keep for backward compat)
- [ ] Update all services to fetch Vapi credentials from single source
- [ ] Add data migration if needed (transfer settings table → org_credentials or integrations table)

**Acceptance Criteria**:
- [ ] /dashboard/integrations is ONLY page for Vapi config
- [ ] /dashboard/settings does NOT have Vapi config
- [ ] /dashboard/api-keys does NOT have Vapi config
- [ ] All backend services use single source for Vapi credentials
- [ ] Frontend components don't conflict with each other
- [ ] No data loss during consolidation

**Files to Modify**:
- `src/app/dashboard/settings/page.tsx` - Remove Vapi section
- `src/app/dashboard/api-keys/page.tsx` - Remove Vapi section
- `src/app/dashboard/integrations/page.tsx` - Ensure it's the primary page
- `backend/src/routes/founder-console-settings.ts` - Deprecate Vapi handling
- `backend/src/routes/integrations.ts` - Make this THE Vapi endpoint
- `backend/src/services/integration-decryptor.ts` - Use this as Vapi source

**Estimated Time**: 3-4 hours (includes testing)

---

### Ticket 4: Credential Configuration Scattered (Twilio) - ARCHITECTURAL

**Severity**: 🔴 **CRITICAL** (Data inconsistency, severe user confusion)

**Problem**:
Twilio credentials are configured in TWO COMPLETELY DIFFERENT PAGES:

| Page | URL | Purpose | Endpoint | Table |
|---|---|---|---|---|
| API Keys | `/dashboard/api-keys` | "Generic API Key Storage" | `/api/founder-console/settings` | `integration_settings` |
| Inbound Config | `/dashboard/inbound-config` | "Setup Inbound Phone Number" | `/api/inbound/setup` | `inbound_agent_config` |

**User Impact**:
- SEVERE confusion: "Why are there TWO different Twilio config pages?"
- This is the core issue the user highlighted: "how can we have an inbound configuration when they have a Twilio configuration in the API keys page again?"
- Data inconsistency: Saving Twilio on api-keys page won't update inbound config
- Backend bug: Services might read from different tables
- UI nightmare: Duplicate fields for same credential type

**Root Cause**:
When inbound config was built, it created its own Twilio credential storage instead of reusing the api-keys Twilio config. Now both exist in parallel.

**Tasks**:
- [ ] Decision: Consolidate to single page (propose: /dashboard/integrations)
- [ ] Remove Twilio section from /dashboard/api-keys
- [ ] Update /dashboard/inbound-config to load Twilio from /api/integrations/twilio
- [ ] Or: Move inbound-specific config to separate tab/section in /dashboard/integrations
- [ ] Migrate data from `integration_settings.twilio_*` → `org_credentials` OR `integrations` table
- [ ] Update backend to use single Twilio credential source
- [ ] Test end-to-end: Configure Twilio once, see it used in both inbound and general config

**Acceptance Criteria**:
- [ ] Twilio config stored in ONE place, not TWO
- [ ] /dashboard/api-keys does NOT have Twilio fields
- [ ] /dashboard/inbound-config uses credentials from /api/integrations/twilio
- [ ] Backend services fetch Twilio from single source
- [ ] No data duplication
- [ ] Inbound setup still works after consolidation

**Files to Modify**:
- `src/app/dashboard/api-keys/page.tsx` - Remove Twilio section
- `src/app/dashboard/inbound-config/page.tsx` - Update to use /api/integrations/twilio
- `backend/src/routes/founder-console-settings.ts` - Remove Twilio handling
- `backend/src/routes/inbound-setup.ts` - Read Twilio from IntegrationDecryptor
- `backend/src/routes/integrations.ts` - Ensure Twilio is stored here
- `backend/src/services/integration-decryptor.ts` - Make this Twilio source

**Estimated Time**: 4-5 hours (includes testing inbound flow)

---

## ⚠️ HIGH PRIORITY - Fix After Critical Items

---

### Ticket 5: Database Schema Cleanup - Schema Consolidation

**Severity**: ⚠️ **HIGH** (Technical debt, source of confusion)

**Problem**:
Four tables store overlapping credential/configuration data:

1. **`integration_settings`** - Vapi, Twilio, Google Calendar keys
2. **`integrations`** - Integration provider status and config
3. **`inbound_agent_config`** - Inbound-specific Twilio and Vapi setup
4. **`org_credentials`** - NEW, encrypted credential storage (from BYOC, currently unused)

**Current State**:
- No single source of truth
- Migration partially complete (org_credentials created but unused)
- Services read from different tables
- Difficult to maintain

**Tasks** (AFTER Ticket 3 & 4 are done):
- [ ] Audit which table each service currently reads from
- [ ] Determine migration path (which table should be source of truth?)
- [ ] Create migration to backfill `org_credentials` from `integration_settings` + `integrations`
- [ ] Update all services to read from `org_credentials` only
- [ ] Keep old tables for 2 weeks as fallback (don't drop yet)
- [ ] Add alerting if services try to read from old tables
- [ ] After 2 weeks of validation, drop old tables

**Acceptance Criteria**:
- [ ] All services use `org_credentials` as single source
- [ ] `integration_settings` kept as readonly fallback only
- [ ] `integrations` table deprecated
- [ ] No services reading from multiple tables
- [ ] Migration preserves all existing credentials

**Files to Create**:
- `backend/migrations/20250111_consolidate_credentials_v2.sql` - Backfill migration

**Files to Modify**:
- All services that read credentials
- `backend/src/services/integration-decryptor.ts` - Ensure it's the only access point

**Estimated Time**: 2-3 hours

---

### Ticket 6: UI/UX Design Consistency - Color Scheme

**Severity**: ⚠️ **HIGH** (User experience, "very displeasing")

**Problem**:
Pages alternate between white and black backgrounds with stark contrasts:
- Dashboard: WHITE ✅
- Settings: BLACK/DARK ❌
- API Keys: WHITE ✅
- Inbound Config: INCONSISTENT ❌
- Integrations: NEEDS CHECK ❌

User feedback: "The stark contrast between white and black is very displeasing and unattractive. Let the dashboard be white for now, with a colored navigation bar."

**Current State**:
- No unified color scheme
- Each page styled independently
- Visual hierarchy unclear
- Inconsistent spacing and typography

**Tasks**:
- [ ] Define design system (white background for all pages)
- [ ] Define navigation bar colors (keep colored as is)
- [ ] Audit all dashboard pages for colors
- [ ] Update settings page from black → white
- [ ] Update inbound-config page styling for consistency
- [ ] Update integrations page styling
- [ ] Ensure text contrast meets WCAG AA standards
- [ ] Apply consistent spacing and typography

**Acceptance Criteria**:
- [ ] All pages have white background
- [ ] Navigation bar remains colored
- [ ] Consistent padding/margins across pages
- [ ] Text is readable (good contrast)
- [ ] Visual hierarchy is clear
- [ ] No "stark contrasts" between pages

**Files to Modify**:
- `src/app/dashboard/settings/page.tsx` - Update styling
- `src/app/dashboard/api-keys/page.tsx` - Verify styling
- `src/app/dashboard/inbound-config/page.tsx` - Update styling
- `src/app/dashboard/integrations/page.tsx` - Update styling
- `src/app/dashboard/layout.tsx` - Consistent layout
- Possibly create `src/styles/dashboard-theme.css` or Tailwind config

**Estimated Time**: 1-2 hours

---

### Ticket 7: Missing/Incomplete BYOC Implementation - Code Cleanup

**Severity**: ⚠️ **HIGH** (Technical debt, incomplete work)

**Problem**:
BYOC (Bring Your Own Credentials) implementation from previous session:
- Created new `/api/integrations/*` endpoints (integrations-byoc.ts)
- Created `IntegrationDecryptor` service
- Created `org_credentials` database table
- BUT: These are not being used; systems still read from old tables
- Duplicating the problem instead of solving it

**Current State**:
- `org_credentials` table exists but is empty
- New endpoints exist but frontend doesn't use them
- Old `founder-console-settings` endpoints still being used
- Causes confusion about which system is "real"

**Tasks** (AFTER Tickets 3, 4, 5):
- [ ] Audit whether IntegrationDecryptor is actually used anywhere
- [ ] Remove duplicate/incomplete BYOC files if not in use:
  - `backend/src/routes/integrations-byoc.ts` (if different from integrations.ts)
  - `backend/src/services/vapi-assistant-manager.ts` (if unused)
  - Test files that test BYOC but not used
- [ ] Or: Complete the BYOC implementation if it's the planned direction
- [ ] Ensure only ONE set of credential endpoints in use
- [ ] Document the credential flow clearly

**Acceptance Criteria**:
- [ ] No duplicate credential management code
- [ ] Single endpoint pattern for all credential types
- [ ] IntegrationDecryptor either fully used or removed
- [ ] Clear documentation of credential flow

**Files to Review**:
- `backend/src/routes/integrations-byoc.ts`
- `backend/src/services/integration-decryptor.ts`
- `backend/src/services/vapi-assistant-manager.ts`
- `backend/src/__tests__/`
- `backend/migrations/20250111_create_byoc_credentials_schema.sql`

**Estimated Time**: 1-2 hours (depends on decision to keep or remove)

---

## 🟡 MEDIUM PRIORITY - After Critical/High

---

### Ticket 8: Frontend Build/Development Issues

**Severity**: 🟡 **MEDIUM** (Annoying but not blocking)

**Issues**:
1. Fast Refresh constantly rebuilding (might indicate circular imports or file watcher issues)
2. Image optimization warnings (missing width/height attributes)
3. Console warnings about deprecated features

**Tasks**:
- [ ] Check for circular imports in components
- [ ] Review Next.js config for file watcher optimization
- [ ] Add width/height to img tags or use Next.js Image component
- [ ] Update any deprecated API usage

**Estimated Time**: 1 hour

---

## Implementation Order (Recommended)

### Day 1 - Critical Fixes
1. ✅ **Ticket 2** - Register missing /api/contacts (15 min)
2. ✅ **Ticket 1** - Fix rate limiting 429 errors (1-2 hours)

### Day 2-3 - Architecture Consolidation
3. ✅ **Ticket 3** - Consolidate Vapi configuration (3-4 hours)
4. ✅ **Ticket 4** - Consolidate Twilio configuration (4-5 hours)

### Day 4-5 - Cleanup & Polish
5. ✅ **Ticket 5** - Database schema consolidation (2-3 hours)
6. ✅ **Ticket 6** - UI/UX design consistency (1-2 hours)
7. ✅ **Ticket 7** - BYOC cleanup (1-2 hours)
8. ✅ **Ticket 8** - Build issues (1 hour)

**Total Estimated Time**: 14-20 hours (2-3 days of focused work)

---

## Success Criteria (Overall)

When all tickets are closed:

- ✅ Single page for all integrations configuration (/dashboard/integrations)
- ✅ Single backend endpoint pattern for all credential types (/api/integrations/*)
- ✅ Single database table for all credentials (org_credentials)
- ✅ No duplicate credential configuration pages
- ✅ No 429 rate limiting errors
- ✅ All dashboard pages load within 2 seconds
- ✅ Consistent UI/UX design across all pages
- ✅ Clean, maintainable codebase without duplication
- ✅ User can configure all integrations in one place
- ✅ Backend services have single source of truth for credentials

---

## Notes for Developer

1. **Test Thoroughly After Each Ticket**: Each credential ticket affects critical user flows
2. **Maintain Backward Compatibility**: Keep old endpoints working for 2 weeks during transition
3. **Monitor Console Errors**: Ensure no 404s or 429s after each change
4. **Test on Real Data**: Test with actual Twilio/Vapi credentials
5. **Get User Feedback**: After consolidation, verify users find the flow intuitive

---

**Created**: January 11, 2026
**Status**: Ready for Implementation
**Owner**: Development Team

---

## Appendix: File Dependency Map

```
Frontend Pages (Consolidate to single page):
  ├─ /dashboard/settings (remove Vapi/Twilio)
  ├─ /dashboard/api-keys (remove Vapi/Twilio)
  ├─ /dashboard/inbound-config (update to use new endpoints)
  └─ /dashboard/integrations (becomes THE integrations page)

Backend Routes (Consolidate to single endpoint pattern):
  ├─ /api/founder-console/settings (deprecate Vapi/Twilio handling)
  ├─ /api/inbound/setup (update to use IntegrationDecryptor)
  ├─ /api/integrations/* (become THE credentials endpoints)
  └─ /api/contacts (register missing)

Backend Services (Single source):
  └─ IntegrationDecryptor (become THE credential source)

Database Tables (Consolidate):
  ├─ integration_settings (phase out)
  ├─ integrations (phase out)
  ├─ inbound_agent_config (phase out)
  └─ org_credentials (become THE table)
```

---

**Next Step**: Assign developers to tickets and begin with Ticket 2 (15-minute fix).
