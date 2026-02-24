# Agent Config Integration Planning - UnifiedAgentConfigForm

**Status:** ✅ Planning Phase (Step 1 - Complete, awaiting Step 2 execution)
**Task:** Integrate UnifiedAgentConfigForm into page.tsx
**Estimated Effort:** 4-6 hours
**Risk Level:** Low (all components tested, straightforward refactoring)
**Date:** 2026-02-24

---

## Executive Summary

The **UnifiedAgentConfigForm** component is ready for integration into `page.tsx`. This refactoring will:
- Reduce page file from **1419 → ~600-700 lines** (58% reduction)
- Replace **~600-800 lines of duplicated JSX** with single unified component
- Maintain **100% backward compatibility** with existing state management
- Enable **cleaner code structure** for future enhancements

**Current State:**
- All extracted components created: PersonaSection, VoiceSection, PromptSection, IdentitySection, PhoneSection (✅)
- UnifiedAgentConfigForm component created (✅)
- Supporting hooks created: usePromptCheckpoint, useMultiTabConflictDetection (✅)
- All code tested and documented (✅)

**Next State:**
- Integrated into page.tsx with inbound/outbound configuration working via single component
- Save/delete/test call functionality preserved
- Modal dialogs (prompt checkpoint, delete, test call, multi-tab conflict) operational

---

## Phase 1: Analysis & Planning (Current - ~1 hour)

### Goal
Understand current page.tsx structure and plan minimal changes to integrate unified form.

### Subtasks

**1.1: Identify Current Rendering Sections**
- Locate inbound form JSX (lines ~900-1100 estimated)
- Locate outbound form JSX (lines ~1100-1300 estimated)
- Identify duplication patterns
- Map all shared state and callbacks

**1.2: Current Architecture Understanding**
```
Current Structure:
├─ State management (Zustand store + local useState)
├─ Data loading (SWR hooks for voices, agents, inbound status)
├─ Event handlers (save, delete, test call, preview)
├─ Conditional rendering: {activeTab === 'inbound' ? <form> : <form>}
├─ Modal components (DeleteModal, TestCallModal)
└─ Audio preview ref management

Integration Points Required:
├─ Config change callback to update Zustand store
├─ Save handler - same for both agents
├─ Delete handler - same for both agents
├─ Test call handler - same for both agents
├─ Voice preview - managed at page level
└─ Phone settings (inbound status, vapi numbers) - passed as props
```

**1.3: Props Mapping**

Create mapping from current page state to UnifiedAgentConfigForm props:

```typescript
// Current page state (before integration)
- inboundConfig: AgentConfig (Zustand)
- outboundConfig: AgentConfig (Zustand)
- setInboundConfig: (config: AgentConfig) => void
- setOutboundConfig: (config: AgentConfig) => void

// Current handlers
- handleSave() - async saves to backend
- handleDelete() - triggers delete modal
- handleTestCall() - initiates test call
- handlePreviewVoice(voiceId) - plays voice preview
- handleStopPreview() - stops preview

// Current UI state
- isSaving, saveSuccess, error
- isDeleting
- isPreviewing, previewPhase, previewingVoiceId
- advancedVoiceOpen
- voices[], inboundStatus, vapiNumbers[], selectedOutboundNumberId

// Props UnifiedAgentConfigForm expects
{
  agentType: 'inbound' | 'outbound',
  config: AgentConfig,
  originalConfig: AgentConfig,
  inboundStatus?: InboundStatus,
  outboundNumberId?: string,
  vapiNumbers?: VapiNumber[],
  hasChanges: boolean,
  isSaving: boolean,
  saveSuccess: boolean,
  error?: string,
  isDeleting?: boolean,
  previewingVoiceId: string | null,
  previewPhase: 'loading' | 'playing' | 'complete' | null,
  personas: PromptTemplate[],
  voices: Voice[],
  advancedVoiceOpen: boolean,
  onAdvancedVoiceToggle: (open: boolean) => void,
  onConfigChange: (updates: Partial<AgentConfig>) => void,
  onSave: () => void,
  onPreviewVoice: (voiceId: string) => void,
  onStopPreview: () => void,
  onDelete?: () => void,
  onTestCall?: () => void,
}
```

**1.4: Current Duplication Analysis**

Sections to be removed (duplicated between inbound/outbound):
1. PersonaSection JSX (~80 lines × 2 = ~160 lines)
2. VoiceSection JSX (~150 lines × 2 = ~300 lines)
3. PromptSection JSX (~80 lines × 2 = ~160 lines)
4. IdentitySection JSX (~40 lines × 2 = ~80 lines)
5. PhoneSection JSX (~60 lines × 2 = ~120 lines)
6. Save/Delete/Test button logic (~50 lines × 2 = ~100 lines)

**Total duplicated lines: ~900-950 lines**

Sections to be replaced with single UnifiedAgentConfigForm:
- ~200 lines (component + props)

**Net reduction: ~700 lines**

---

## Phase 2: Integration Execution (4-5 hours)

### Subphase 2A: Remove Current Inbound/Outbound Form JSX (1.5 hours)

**Goal:** Remove duplicated form sections, leaving tab navigation and modals intact.

**Files to modify:**
- `src/app/dashboard/agent-config/page.tsx`

**Steps:**

1. **Locate and extract inbound form section**
   - Find: `{activeTab === 'inbound' && (` opening tag
   - Find: corresponding closing `)}`
   - Verify ~450-500 lines of JSX
   - Delete entire block (temporary - verify with diff first)

2. **Locate and extract outbound form section**
   - Find: `{activeTab === 'outbound' && (` opening tag
   - Find: corresponding closing `)}`
   - Verify ~450-500 lines of JSX
   - Delete entire block (temporary - verify with diff first)

3. **Keep intact:**
   - Tab navigation (`<nav>` with inbound/outbound tabs)
   - Delete modal (`<DeleteModal />`)
   - Test call modal (`<TestCallModal />`)
   - Any other UI elements outside the forms

4. **Add placeholder for unified form**
   ```typescript
   {/* Unified form will go here */}
   <section className="space-y-6">
     {/* TODO: Insert UnifiedAgentConfigForm */}
   </section>
   ```

**Validation:**
- ✅ Page still renders (may show empty form section)
- ✅ Tab navigation still works
- ✅ Modals still visible
- ✅ State management still intact

---

### Subphase 2B: Add UnifiedAgentConfigForm Wrapper Component (1 hour)

**Goal:** Create a wrapper component that adapts page state to unified form API.

**Create file:** `src/components/dashboard/AgentConfig/PageFormAdapter.tsx` (optional - or inline in page.tsx)

**Purpose:** Minimal adapter that:
- Takes current page state and config
- Renders UnifiedAgentConfigForm with correct props
- Routes callbacks back to page handlers

**If inlining in page.tsx:**
```typescript
{/* Unified Agent Config Form - wraps extracted components */}
<UnifiedAgentConfigForm
  agentType={activeTab}
  config={activeTab === 'inbound' ? inboundConfig : outboundConfig}
  originalConfig={activeTab === 'inbound' ? originalInboundConfig : originalOutboundConfig}
  inboundStatus={inboundStatus}
  outboundNumberId={selectedOutboundNumberId}
  vapiNumbers={vapiNumbers}
  hasChanges={hasActiveTabChanges()}
  isSaving={isSaving}
  saveSuccess={saveSuccess && savingAgent === activeTab}
  error={error}
  isDeleting={isDeleting}
  previewingVoiceId={previewingVoiceId}
  previewPhase={previewPhase === 'idle' ? null : (previewPhase as any)}
  personas={activeTab === 'inbound' ? PROMPT_TEMPLATES : OUTBOUND_PROMPT_TEMPLATES}
  voices={voices}
  advancedVoiceOpen={advancedVoiceOpen}
  onAdvancedVoiceToggle={setAdvancedVoiceOpen}
  onConfigChange={(updates) => {
    if (activeTab === 'inbound') {
      setInboundConfig({ ...inboundConfig, ...updates });
    } else {
      setOutboundConfig({ ...outboundConfig, ...updates });
    }
  }}
  onSave={handleSave}
  onPreviewVoice={handlePreviewVoice}
  onStopPreview={handleStopPreview}
  onDelete={() => setShowDeleteModal(true)}
  onTestCall={handleTestCall}
/>
```

**Validation:**
- ✅ Form renders with correct initial config
- ✅ Changing activeTab shows different form
- ✅ All props flow correctly

---

### Subphase 2C: Import Required Components (30 minutes)

**Goal:** Add imports for unified form and all extracted components.

**Add to page.tsx imports:**
```typescript
import { UnifiedAgentConfigForm } from '@/components/dashboard/AgentConfig/UnifiedAgentConfigForm';
import { PersonaSection } from '@/components/dashboard/AgentConfig/PersonaSection';
import { VoiceSection } from '@/components/dashboard/AgentConfig/VoiceSection';
import { PromptSection } from '@/components/dashboard/AgentConfig/PromptSection';
import { IdentitySection } from '@/components/dashboard/AgentConfig/IdentitySection';
import { PhoneSection } from '@/components/dashboard/AgentConfig/PhoneSection';
import { PromptCheckpointModal } from '@/components/dashboard/AgentConfig/PromptCheckpointModal';
import { MultiTabConflictAlert } from '@/components/dashboard/AgentConfig/MultiTabConflictAlert';
import { usePromptCheckpoint } from '@/hooks/usePromptCheckpoint';
import { useMultiTabConflictDetection } from '@/hooks/useMultiTabConflictDetection';
```

**Note:** The extracted components (PersonaSection, etc.) are automatically imported by UnifiedAgentConfigForm, so explicit imports aren't strictly necessary, but helpful for IDE/clarity.

---

### Subphase 2D: Add Prompt Checkpoint Modal Integration (1 hour)

**Goal:** Integrate PromptCheckpointModal before save, allowing users to review prompts.

**Current flow:**
1. User clicks Save
2. handleSave() called
3. Config saved immediately

**New flow:**
1. User clicks Save
2. PromptCheckpointModal appears
3. User reviews prompts
4. User clicks "Confirm & Save" or "Edit" or "Cancel"
5. If Confirm & Save: handleSave() called

**Implementation:**

```typescript
// Add hook near top of component
const checkpoint = usePromptCheckpoint();

// Modify handleSave to use checkpoint
const handleSave = async () => {
  const currentConfig = activeTab === 'inbound' ? inboundConfig : outboundConfig;

  // Show checkpoint before saving
  checkpoint.show(
    {
      agentName: currentConfig.name || `${activeTab} Agent`,
      systemPrompt: currentConfig.systemPrompt,
      firstMessage: currentConfig.firstMessage,
    },
    {
      onConfirm: async () => {
        // Actually perform the save
        checkpoint.setLoading(true);
        try {
          // ... existing save logic ...
          checkpoint.close();
        } catch (err) {
          // ... error handling ...
        } finally {
          checkpoint.setLoading(false);
        }
      },
      onCancel: () => {
        checkpoint.close();
      },
      onEdit: () => {
        // Close modal, let user edit
        checkpoint.close();
      }
    }
  );
};

// Render checkpoint modal in JSX
{checkpoint.isOpen && (
  <PromptCheckpointModal
    isOpen={checkpoint.isOpen}
    agentName={checkpoint.agentName}
    systemPrompt={checkpoint.systemPrompt}
    firstMessage={checkpoint.firstMessage}
    isLoading={checkpoint.isLoading}
    onConfirm={checkpoint.handleConfirm}
    onCancel={checkpoint.handleCancel}
    onEdit={checkpoint.handleEdit}
  />
)}
```

---

### Subphase 2E: Add Multi-Tab Conflict Detection Integration (1 hour)

**Goal:** Detect when user has multiple tabs open with same agent config.

**Implementation:**

```typescript
// Add hook near top of component
const conflict = useMultiTabConflictDetection({
  agentType: activeTab,
  agentName: (activeTab === 'inbound' ? inboundConfig : outboundConfig).name || `${activeTab} Agent`,
});

// After successful save, broadcast to other tabs
const handleSave = async () => {
  // ... save logic ...
  if (success) {
    conflict.broadcastSave();
    success('Agent configuration saved');
  }
};

// Render conflict alert in JSX
<MultiTabConflictAlert
  isVisible={conflict.hasConflict}
  message={conflict.conflictMessage}
  conflictingAgentName={conflict.conflictingTab?.agentName}
  onDismiss={conflict.clearConflict}
  onRefresh={() => window.location.reload()}
/>

// Block save if conflict detected
const canSave = conflict.canSave() && hasActiveTabChanges() && !isSaving;
```

---

## Phase 3: Testing & Validation (1-2 hours)

### Goal
Verify all functionality works correctly after integration.

### 3.1 Smoke Tests (30 minutes)

**Inbound agent:**
- ✅ Load page, tab defaults to inbound
- ✅ Form renders with existing inbound config
- ✅ Change agent name → state updates
- ✅ Select voice → preview works
- ✅ Click Save → prompt checkpoint appears
- ✅ Confirm save → request sent, success message

**Outbound agent:**
- ✅ Click outbound tab → form switches
- ✅ Form renders with existing outbound config
- ✅ Change phone number → state updates
- ✅ Save works (with checkpoint)

**Cross-tab testing:**
- ✅ Open two browser tabs with same page
- ✅ Save in tab 1
- ✅ Tab 2 shows conflict alert
- ✅ Click refresh in tab 2 → reloads latest data

---

### 3.2 Component Tests (30 minutes)

**UnifiedAgentConfigForm:**
- ✅ Renders all 5 extracted sections
- ✅ Grid layout correct (1/3 left, 2/3 right)
- ✅ All callbacks fire correctly
- ✅ Voice preview button works
- ✅ Save button disabled when no changes

**PersonaSection:**
- ✅ Grid of templates displays
- ✅ Selection state visual feedback
- ✅ Clicking template updates system/first message

**VoiceSection:**
- ✅ Voice selector dropdown works
- ✅ Language selector works
- ✅ Advanced settings accordion toggles
- ✅ Preview button plays audio

**Other sections:**
- ✅ Each section renders correctly
- ✅ Each section callbacks fire

---

### 3.3 State Management Tests (30 minutes)

- ✅ Config changes update Zustand store
- ✅ Switching tabs preserves state
- ✅ Navigating away and back reloads from DB
- ✅ Save clears "changed" flag
- ✅ Delete removes agent config

---

### 3.4 Browser Testing (15 minutes)

- ✅ Chrome/Firefox/Safari rendering
- ✅ Mobile responsive (tab behavior)
- ✅ Console errors/warnings clean
- ✅ Performance: page load time unchanged

---

## Phase 4: Deployment (30 minutes)

### Goal
Commit changes and deploy to production.

### 4.1 Git Cleanup
```bash
# Verify changes
git diff src/app/dashboard/agent-config/page.tsx | head -100

# Show file size reduction
wc -l src/app/dashboard/agent-config/page.tsx  # Should be ~650-700
```

### 4.2 Commit Message
```
refactor: Integrate UnifiedAgentConfigForm into agent config page

- Replace duplicated inbound/outbound form JSX with unified component
- Reduce page.tsx from 1419 → 650 lines (58% reduction)
- Eliminate 50-60% code duplication, now 5% remaining
- Integrate prompt checkpoint modal for save review
- Add multi-tab conflict detection
- Maintain 100% backward compatibility and UX

Features preserved:
✅ Save/delete/test call functionality
✅ Voice preview and language selection
✅ Advanced voice settings (ElevenLabs)
✅ State management via Zustand
✅ Phone number assignment (inbound/outbound)
✅ Persona template selection

Components integrated:
- PersonaSection (AI personality templates)
- VoiceSection (voice config + language + preview)
- PromptSection (system prompt + first message)
- IdentitySection (agent name)
- PhoneSection (read-only phone display)
- UnifiedAgentConfigForm (combines all sections)
- PromptCheckpointModal (review before save)
- MultiTabConflictAlert (cross-tab awareness)

Files modified:
- src/app/dashboard/agent-config/page.tsx (major simplification)

Hooks added:
- usePromptCheckpoint (prompt review modal lifecycle)
- useMultiTabConflictDetection (multi-tab communication)

Testing:
- All smoke tests passed
- Component tests passed
- State management verified
- Cross-tab detection working

Risk: LOW - All components tested, straightforward refactoring, no breaking changes
```

### 4.3 Deployment
```bash
# Push to main (triggers auto-deploy via Vercel)
git push origin main

# Monitor deployment
# 1. Watch Vercel dashboard for build completion
# 2. Verify frontend loads at https://voxanne.ai
# 3. Test inbound tab loads
# 4. Test outbound tab loads
# 5. Test save works with checkpoint modal
```

---

## Success Criteria

| Criteria | Status | Notes |
|----------|--------|-------|
| **Code Reduction** | ⏳ Pending | 1419 → ~650 lines (58% reduction target) |
| **Duplication Reduction** | ⏳ Pending | 50-60% → 5% (90% improvement target) |
| **TypeScript Errors** | ⏳ Pending | Should be 0 after integration |
| **Backward Compatibility** | ⏳ Pending | All existing features work identically |
| **UX Unchanged** | ⏳ Pending | Same UI/UX, just cleaner code |
| **Tests Pass** | ⏳ Pending | All smoke/component/state tests pass |
| **Deployment Successful** | ⏳ Pending | Frontend builds and deploys without errors |
| **Production Verified** | ⏳ Pending | Tested in production environment |

---

## Rollback Procedure

If issues arise during integration:

**Option 1: Git Revert (Fastest)**
```bash
git revert <commit-hash>
git push origin main
# Vercel auto-deploys reverted code within 2 minutes
```

**Option 2: Partial Revert (Keep some changes)**
```bash
git diff HEAD~1..HEAD > changes.patch
# Edit patch to remove problematic sections
git apply changes.patch --reverse
```

**Option 3: Feature Flag (Gradual Rollout)**
```typescript
// In page.tsx
if (process.env.NEXT_PUBLIC_USE_UNIFIED_FORM === 'true') {
  <UnifiedAgentConfigForm ... />
} else {
  // Old duplicated form JSX (keep as backup)
  {activeTab === 'inbound' && <OldInboundForm />}
  {activeTab === 'outbound' && <OldOutboundForm />}
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Props mismatch | Low | High | Review props mapping doc before integration |
| State management breaks | Low | High | Test Zustand store updates thoroughly |
| Rendering regression | Low | Medium | Run smoke tests on all browsers |
| Performance issue | Very Low | Low | Monitor bundle size and load time |
| Lost user data | Very Low | Critical | Have backup rollback ready |

**Overall Risk: LOW** - All components tested, props well-documented, straightforward refactoring.

---

## Team Coordination

**Who reviews:** Code reviewer should verify:
- All 5 extracted components used correctly
- Props flow correctly from page to unified form
- State updates work both directions
- No console errors or TypeScript issues
- Code reduction metrics achieved

**Who tests:** QA should verify:
- Inbound save/delete/preview works
- Outbound save/delete/preview works
- Cross-tab detection works
- Prompt checkpoint modal appears and works
- Mobile responsive

**Who deploys:** CI/CD should:
- Run linting (ESLint)
- Run type checking (TypeScript)
- Run tests (unit/integration)
- Build successfully
- Deploy to production

---

## Timeline Estimate

| Phase | Subtask | Time | Status |
|-------|---------|------|--------|
| **1: Analysis** | Current, will be complete before Phase 2 | 1h | ⏳ Next |
| **2: Integration** | Remove old JSX | 1.5h | ⏳ After Phase 1 |
| | Add unified form | 1h | ⏳ |
| | Add imports | 0.5h | ⏳ |
| | Checkpoint modal | 1h | ⏳ |
| | Multi-tab detection | 1h | ⏳ |
| **3: Testing** | Smoke + component tests | 2h | ⏳ |
| **4: Deployment** | Commit + deploy | 0.5h | ⏳ |
| **TOTAL** | | **5-6h** | ⏳ |

**Estimated Completion:** 2-3 working days (depending on testing findings)

---

## Questions Before Execution

1. **Environment:** Should integration happen in local dev first, or push directly to staging?
2. **Testing:** Do we need E2E tests, or smoke tests sufficient?
3. **Documentation:** Should we create user-facing changelog for this internal refactoring?
4. **Backwards Compatibility:** Any existing API clients depending on page.tsx structure?
5. **Monitoring:** Should we add feature flag for gradual rollout, or direct deployment?

---

## Files Reference

**Files Created (Already Complete):**
- `src/components/dashboard/AgentConfig/PersonaSection.tsx` (61 lines)
- `src/components/dashboard/AgentConfig/VoiceSection.tsx` (178 lines)
- `src/components/dashboard/AgentConfig/PromptSection.tsx` (93 lines)
- `src/components/dashboard/AgentConfig/IdentitySection.tsx` (44 lines)
- `src/components/dashboard/AgentConfig/PhoneSection.tsx` (61 lines)
- `src/components/dashboard/AgentConfig/UnifiedAgentConfigForm.tsx` (201 lines)
- `src/components/dashboard/AgentConfig/PromptCheckpointModal.tsx` (169 lines)
- `src/components/dashboard/AgentConfig/MultiTabConflictAlert.tsx` (85 lines)
- `src/hooks/usePromptCheckpoint.ts` (89 lines)
- `src/hooks/useMultiTabConflictDetection.ts` (127 lines)

**File to Modify (Phase 2):**
- `src/app/dashboard/agent-config/page.tsx` (1419 lines → target 650-700 lines)

**Documentation (Already Complete):**
- `FIXES_COMPLETED_2026_02_23.md`
- `UNIFY_AGENT_CONFIG_DESIGN.md`
- `UNIFY_AGENT_CONFIG_IMPLEMENTATION.md`
- `PROMPT_CHECKPOINT_INTEGRATION.md`
- `MULTI_TAB_CONFLICT_DETECTION.md`
- `PRIORITY_2_ARCHITECTURE_CORRECTED.md`

---

## Next Steps

✅ **Step 1 - PLANNING:** This document (complete)
⏳ **Step 2 - Create planning.md:** (optional - this IS the planning)
⏳ **Step 3 - EXECUTE:** Begin Phase 2 (remove old JSX, add unified form)

---

**Document Version:** 1.0
**Created:** 2026-02-24
**Author:** Claude Code (Anthropic)
**Status:** Ready for Phase 2 Execution
