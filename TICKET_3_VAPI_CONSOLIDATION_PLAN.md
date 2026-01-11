# 🎫 Ticket 3: Consolidate Vapi API Configuration - PLAN

**Status**: 🔄 IN PROGRESS - PLANNING PHASE
**Severity**: 🔴 CRITICAL (3 pages with Vapi config, user confusion)
**Impact**: Users should only configure Vapi in ONE place

---

## Problem Statement

Vapi API Key configuration is currently scattered across 3 different pages:

### Current Fragmented State

**Page 1: `/dashboard/settings` (General Settings Tab)**
- Step 1: Enter Vapi API Key (input field)
- Discover Resources button (calls /api/vapi/discover/all)
- Select Assistant (dropdown)
- Configure Webhook button
- Saves to `/api/founder-console/settings`
- **Issue**: This is a discovery/configuration flow, not where users expect to be

**Page 2: `/dashboard/api-keys` (Vapi Configuration Section)**
- Private API Key input field
- Status badge (Active/Not Configured)
- Saves to `/api/founder-console/settings`
- **Issue**: This is generic "API Keys" page, but it's NOT the primary place

**Page 3: `/dashboard/integrations` (New BYOC implementation)**
- IntegrationCard for Vapi
- Modal for configuration
- Status display
- Test connection button
- **Issue**: This is new but backend endpoints conflict with api-keys page

---

## Desired End State

**Single Source of Truth**: `/dashboard/integrations`
- All Vapi configuration happens here
- Clear, consistent interface
- IntegrationCard shows status
- Modal handles API key input + assistant discovery
- Saves to single backend endpoint
- `/dashboard/settings` NO Vapi section
- `/dashboard/api-keys` NO Vapi section

---

## Implementation Strategy

### Phase 1: Backend Consolidation (Quick)

**Goal**: Ensure single backend endpoint is used

**Current State**:
- `/api/founder-console/settings` (GET/POST) - Old endpoint
- `/api/integrations/vapi` (GET/PUT) - New endpoint
- `/api/vapi/discover/all` (POST) - Discovery endpoint

**Action**:
- Keep both endpoints working temporarily (backward compatibility)
- Update `/api/integrations/vapi` to handle all Vapi operations
- Update `IntegrationDecryptor` service to be the source of truth
- Add deprecation notices to old endpoints

**Files to Review**:
- `backend/src/routes/founder-console-settings.ts`
- `backend/src/routes/integrations.ts`
- `backend/src/routes/vapi-discovery.ts`
- `backend/src/services/integration-decryptor.ts`

---

### Phase 2: Frontend Consolidation (Moderate)

**Goal**: Move all Vapi config UI to `/dashboard/integrations`

#### Step 1: Enhance `/dashboard/integrations`
- Ensure Vapi modal handles:
  - API key input
  - Assistant discovery (reuse existing discovery flow)
  - Assistant selection
  - Webhook configuration
  - Test connection
  - Status display
- Make it match or exceed functionality of current pages

**Files to Modify**:
- `src/app/dashboard/integrations/page.tsx` - Enhance Vapi modal
- `src/components/integrations/VapiCredentialForm.tsx` - May need to add discovery UI

#### Step 2: Remove Vapi from `/dashboard/settings`
- Delete "General Settings" tab content that references Vapi
  - Remove API key input
  - Remove Discover Resources button
  - Remove assistant selection
  - Remove Webhook configuration
  - Keep only non-Vapi settings (e.g., team settings)
- Or: Convert "General Settings" to "Team Settings" only

**Files to Modify**:
- `src/app/dashboard/settings/page.tsx` - Remove Vapi fields

#### Step 3: Remove Vapi from `/dashboard/api-keys`
- Delete Vapi Configuration section entirely
- Keep only Twilio Configuration section
- Update heading/description

**Files to Modify**:
- `src/app/dashboard/api-keys/page.tsx` - Remove Vapi section

---

### Phase 3: Update Navigation & Documentation (Quick)

**Goal**: Guide users to consolidatedpage

**Actions**:
- Update help text/descriptions to point to Integrations page
- Add note in Settings/API Keys pages: "Vapi configuration has moved to Integrations page"
- Update any internal documentation/onboarding

**Files to Modify**:
- `src/app/dashboard/settings/page.tsx` - Add note
- `src/app/dashboard/api-keys/page.tsx` - Add note
- Navigation tooltips if present

---

## Detailed Tasks

### Task 1: Enhance `/dashboard/integrations` VapiCredentialForm

**Current Functionality** (From existing components):
- API key input field
- Show/hide password toggle
- Save button

**Required Additions** (From `/dashboard/settings`):
- Discover Resources button
- Assistant selection dropdown
- Configure Webhook button
- Status updates

**File**: `src/components/integrations/VapiCredentialForm.tsx`

**Changes**:
```typescript
// Add discovery state
const [discoveryState, setDiscoveryState] = useState<'idle' | 'discovering' | 'discovered'>('idle');
const [assistants, setAssistants] = useState<Array<{id: string, name: string}>>();
const [selectedAssistant, setSelectedAssistant] = useState<string>('');

// Add discovery handler
const handleDiscoverResources = async () => {
  setDiscoveryState('discovering');
  try {
    const response = await fetch('/api/vapi/discover/all', {
      method: 'POST',
      body: JSON.stringify({ apiKey: apiKey })
    });
    const data = await response.json();
    setAssistants(data.assistants);
    setDiscoveryState('discovered');
  } catch (err) {
    setDiscoveryState('idle');
    // Show error
  }
};

// Add webhook configuration handler
const handleConfigureWebhook = async () => {
  // Call existing webhook configuration logic
};
```

---

### Task 2: Remove Vapi from `/dashboard/settings`

**Current State** (lines ~50-165):
- Loads Vapi API key
- Has "Step 1: Enter Vapi API Key" input
- Discover Resources button
- Assistant selection
- Configure Webhook button
- Saves to `/api/founder-console/settings`

**Action**:
- Delete all Vapi-related code (40-50 lines)
- Keep only Team Members tab
- Update page description

**File**: `src/app/dashboard/settings/page.tsx`

**Changes**:
1. Remove useState for apiKey, assistants, phoneNumbers, selectedAssistantId
2. Remove handleDiscoverResources function
3. Remove handleConfigureWebhook function
4. Delete Vapi input section from render
5. Update page description to "Manage your team and account settings"
6. Remove "General Settings" tab (or keep if there are other non-Vapi settings)

---

### Task 3: Remove Vapi from `/dashboard/api-keys`

**Current State** (lines ~125-181):
- Vapi Configuration section
  - Private API Key input
  - Status badge
  - Help text

**Action**:
- Delete entire "Vapi Configuration" div (55 lines)
- Keep "Twilio Configuration" section
- Update page heading/description

**File**: `src/app/dashboard/api-keys/page.tsx`

**Changes**:
1. Delete lines 125-181 (Vapi Configuration section)
2. Update page heading from "API Keys & Integrations" to "Legacy API Configuration"
3. Add note: "For new integrations, please use the Integrations page"
4. Keep Twilio section as-is (will be consolidated in Ticket 4)

---

### Task 4: Update Backend to Consolidate Endpoints

**Current Endpoints**:
1. `/api/founder-console/settings` (GET/POST) - Uses integration_settings table
2. `/api/integrations/vapi` (GET/PUT) - Uses integrations table
3. `/api/vapi/discover/all` (POST) - Discovers assistants

**Required Changes**:
- Ensure all three endpoints work
- Update IntegrationDecryptor to be source of truth
- Add cross-table consistency checks

**Files to Review**:
- `backend/src/routes/founder-console-settings.ts` - Keep as fallback for backward compatibility
- `backend/src/routes/integrations.ts` - Make this THE Vapi endpoint
- `backend/src/services/integration-decryptor.ts` - Ensure it handles Vapi
- `backend/src/routes/vapi-discovery.ts` - Keep as-is, used by discovery flow

---

## Acceptance Criteria

**All must be true for Ticket 3 to be COMPLETE**:

- [ ] `/dashboard/settings` does NOT have Vapi API Key input
- [ ] `/dashboard/settings` does NOT have Discover Resources button
- [ ] `/dashboard/settings` does NOT have assistant selection
- [ ] `/dashboard/api-keys` does NOT have Vapi Configuration section
- [ ] `/dashboard/integrations` handles full Vapi configuration flow
- [ ] `/dashboard/integrations` Vapi modal has:
  - [ ] API key input field
  - [ ] Discover Resources button
  - [ ] Assistant selection dropdown
  - [ ] Configure Webhook button
  - [ ] Test connection button
  - [ ] Status display
- [ ] Saving Vapi config on `/dashboard/integrations` works end-to-end
- [ ] Backend endpoints `/api/founder-console/settings` and `/api/integrations/vapi` both work
- [ ] IntegrationDecryptor correctly retrieves Vapi credentials
- [ ] No data loss - existing Vapi config still accessible
- [ ] User documentation updated (notes in settings/api-keys pages)

---

## Testing Strategy

### Manual Testing Sequence

1. **Test Existing Config Still Works**:
   - Verify old Vapi config is still accessible via `/api/founder-console/settings`
   - Data should persist

2. **Test New Configuration Flow**:
   - Go to `/dashboard/integrations`
   - Click Vapi card → Configure
   - Enter Vapi API key
   - Click Discover Resources
   - Select an assistant
   - Configure webhook
   - Click Save
   - Expected: Vapi configured successfully

3. **Test Old Pages Don't Show Vapi**:
   - Go to `/dashboard/settings` → No Vapi fields
   - Go to `/dashboard/api-keys` → No Vapi Configuration section
   - Add note visible: "Use Integrations page"

4. **Test Data Consistency**:
   - Configure via `/dashboard/integrations`
   - Query `/api/founder-console/settings` → Shows same Vapi config
   - Query `/api/integrations/vapi` → Shows same config
   - Verify IntegrationDecryptor returns correct value

5. **Test Service Restarts**:
   - Restart backend
   - Verify Vapi credentials still accessible
   - No data loss

---

## Rollback Plan

If issues arise during consolidation:

1. **Restore deleted code** (git checkout)
2. **Keep both pages for 1 week** while validating new flow
3. **Gradual removal** - Hide old pages with feature flag, then delete

---

## Files Summary

### Files to Modify
1. `src/app/dashboard/settings/page.tsx` - Remove Vapi section
2. `src/app/dashboard/api-keys/page.tsx` - Remove Vapi section
3. `src/components/integrations/VapiCredentialForm.tsx` - Enhance with discovery
4. `src/app/dashboard/integrations/page.tsx` - Ensure full flow works

### Files to Review (No Changes)
1. `backend/src/routes/founder-console-settings.ts` - Keep for backward compat
2. `backend/src/routes/integrations.ts` - Verify Vapi endpoints work
3. `backend/src/services/integration-decryptor.ts` - Verify Vapi credentials retrieval
4. `backend/src/routes/vapi-discovery.ts` - Used by discovery flow

---

## Estimated Time

- **Enhance `/dashboard/integrations`**: 1-2 hours (add discovery UI)
- **Remove from `/dashboard/settings`**: 30 minutes
- **Remove from `/dashboard/api-keys`**: 15 minutes
- **Backend verification**: 30 minutes
- **End-to-end testing**: 1 hour
- **Documentation updates**: 15 minutes

**Total**: 3.5-4 hours

---

## Success Metrics

**After Completion**:
- ✅ Single page for Vapi configuration (`/dashboard/integrations`)
- ✅ No duplication across pages
- ✅ Clearer user experience
- ✅ No data loss
- ✅ Backend consolidation for future work
- ✅ Zero duplication, single source of truth for Vapi

---

## Next Steps

1. **Review this plan** - Confirm approach is correct
2. **Start Task 1** - Enhance VapiCredentialForm component
3. **Complete Task 2-3** - Remove from old pages
4. **Verify Task 4** - Backend endpoints work
5. **Test end-to-end** - Full Vapi configuration flow
6. **Move to Ticket 4** - Consolidate Twilio (same pattern)

---

**Status**: Ready for implementation
**Assigned To**: Development team
**Priority**: 🔴 CRITICAL
**Dependency**: Ticket 1 (rate limiting) - COMPLETE ✅

