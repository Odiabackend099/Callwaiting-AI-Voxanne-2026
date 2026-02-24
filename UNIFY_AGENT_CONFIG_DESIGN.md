# Unifying Inbound/Outbound Agent Configuration

**Status:** Design & Architecture (Implementation Ready)
**Purpose:** Reduce code duplication, improve maintainability, and create a unified agent configuration interface

**Date:** 2026-02-23
**Scope:** Refactor agent-config/page.tsx to use reusable unified components

---

## Current State Analysis

### Problem: Duplicated Code

Currently, the `src/app/dashboard/agent-config/page.tsx` has:

```typescript
// ❌ DUPLICATION PATTERN
const [inboundConfig, setInboundConfig] = useState<AgentConfig>(...);
const [inboundChanged, setInboundChanged] = useState(false);
const [outboundConfig, setOutboundConfig] = useState<AgentConfig>(...);
const [outboundChanged, setOutboundChanged] = useState(false);

// Separate handlers for each
const handleInboundNameChange = (name) => setInboundConfig(...);
const handleOutboundNameChange = (name) => setOutboundConfig(...);

// Duplicated UI sections
{activeTab === 'inbound' && (
  <>
    {/* Entire form for inbound */}
  </>
)}

{activeTab === 'outbound' && (
  <>
    {/* Entire form for outbound - mostly identical */}
  </>
)}
```

**Issues:**
- ~1400 lines of JSX with significant duplication
- Any bug fix needs to be applied twice
- Adding new fields requires two code changes
- Hard to maintain as features evolve
- Difficult to extract components from two identical forms

### Root Cause

The current design assumes inbound and outbound are fundamentally different, but they actually share:
- Same configuration schema (name, voice, language, prompts, etc.)
- Same validation rules
- Same UI patterns
- Same state management needs

The only real differences:
- **Phone number field:** Inbound shows assigned number, Outbound shows caller ID
- **Optional voiceStability/voiceSimilarityBoost:** Both use same fields
- **UI labels:** Minor wording differences ("First Message" vs "Call Script")

---

## Proposed Solution: Unified Agent Config Form

### Architecture

```
┌─────────────────────────────────────────────┐
│  AgentConfigPage (Tab Manager)              │
│  - activeTab state                          │
│  - orchestrates which form to show          │
│  - handles multi-tab conflict detection     │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌─────────────────┐    ┌─────────────────┐
│ UnifiedAgent    │    │ UnifiedAgent    │
│ ConfigForm      │    │ ConfigForm      │
│ (inbound)       │    │ (outbound)      │
│                 │    │                 │
│ Props:          │    │ Props:          │
│ - agentType     │    │ - agentType     │
│ - config        │    │ - config        │
│ - onSave        │    │ - onSave        │
│ - onChange      │    │ - onChange      │
└─────────────────┘    └─────────────────┘
        │                     │
        └──────────┬──────────┘
                   │ (both use)
        ┌──────────▼──────────┐
        │ Extracted           │
        │ Components:         │
        │ ├─ PersonaSection   │
        │ ├─ VoiceSection     │
        │ ├─ PromptSection    │
        │ ├─ PhoneSection     │
        │ └─ IdentitySection  │
        └─────────────────────┘
```

### Key Component: UnifiedAgentConfigForm

```typescript
interface UnifiedAgentConfigFormProps {
  agentType: 'inbound' | 'outbound';
  config: AgentConfig;
  originalConfig: AgentConfig;
  inboundStatus?: InboundStatus;
  outboundNumberId?: string;
  vapiNumbers?: VapiNumber[];
  hasChanges: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  error?: string;
  isDeleting?: boolean;
  previewingVoiceId?: string | null;
  previewPhase?: 'loading' | 'playing' | 'complete' | null;
  onConfigChange: (updatedConfig: Partial<AgentConfig>) => void;
  onSave: () => void;
  onPreviewVoice: (voiceId: string) => void;
  onStopPreview: () => void;
  onDelete?: () => void;
  voices: Voice[];
  advancedVoiceOpen: boolean;
  onAdvancedVoiceToggle: (open: boolean) => void;
}
```

---

## Implementation Plan

### Phase 1: Create Unified Form Component (2 hours)

**File:** `src/components/dashboard/AgentConfig/UnifiedAgentConfigForm.tsx`

**Responsibilities:**
- Accept a single AgentConfig and manage it
- Use extracted section components (PersonaSection, VoiceSection, etc.)
- Conditional rendering for inbound/outbound-specific fields
- Pass appropriate callbacks to child components

**Structure:**
```
UnifiedAgentConfigForm
├─ Left Column
│  ├─ IdentitySection
│  ├─ PhoneSection (conditional on agentType)
│  ├─ VoiceSection
│  └─ TestCallSection (optional)
├─ Right Column
│  ├─ PersonaSection
│  └─ PromptSection
└─ Footer
   ├─ Delete Button (if applicable)
   ├─ Save Button
   └─ Test Button
```

**Example Implementation Pattern:**
```typescript
export const UnifiedAgentConfigForm: React.FC<UnifiedAgentConfigFormProps> = ({
  agentType,
  config,
  onConfigChange,
  // ... other props
}) => {
  const setConfig = (updates: Partial<AgentConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left Column - Identity & Voice */}
      <div className="lg:col-span-1 space-y-6">
        <IdentitySection
          name={config.name}
          agentType={agentType}
          onNameChange={(name) => setConfig({ name })}
        />

        <PhoneSection
          agentType={agentType}
          inboundStatus={inboundStatus}
          outboundNumberId={outboundNumberId}
          vapiNumbers={vapiNumbers}
        />

        <VoiceSection
          voice={config.voice}
          voiceProvider={config.voiceProvider}
          // ... other voice props
          onVoiceChange={(voiceId, provider) =>
            setConfig({ voice: voiceId, voiceProvider: provider })
          }
          // ... other handlers
        />
      </div>

      {/* Right Column - Personality & Prompts */}
      <div className="lg:col-span-2 space-y-6">
        <PersonaSection
          templates={personas}
          selectedTemplateId={config.personaTemplateId}
          onSelectTemplate={(templateId) => {
            const template = personas.find((p) => p.id === templateId);
            if (template) {
              setConfig({
                systemPrompt: template.systemPrompt,
                firstMessage: template.firstMessage,
                personaTemplateId: templateId,
              });
            }
          }}
        />

        <PromptSection
          systemPrompt={config.systemPrompt}
          firstMessage={config.firstMessage}
          onSystemPromptChange={(prompt) => setConfig({ systemPrompt: prompt })}
          onFirstMessageChange={(msg) => setConfig({ firstMessage: msg })}
        />
      </div>
    </div>
  );
};
```

### Phase 2: Refactor Page Component (3 hours)

**File:** `src/app/dashboard/agent-config/page.tsx`

**Changes:**
1. Simplify state: Use two instances of same config instead of separate states
2. Simplify handlers: Generic handlers that work for both agents
3. Remove conditional UI bloat: Use `<UnifiedAgentConfigForm />` for both tabs
4. Keep minimal: Tab selection, prompt checkpoint, save orchestration

**New Structure:**
```typescript
export default function AgentConfigPage() {
  // State for both agents (simpler)
  const [inboundConfig, setInboundConfig] = useState<AgentConfig>(...);
  const [outboundConfig, setOutboundConfig] = useState<AgentConfig>(...);
  const [inboundChanged, setInboundChanged] = useState(false);
  const [outboundChanged, setOutboundChanged] = useState(false);

  // Single handler for config changes (works for both)
  const handleConfigChange = (agentType: 'inbound' | 'outbound', updates: Partial<AgentConfig>) => {
    if (agentType === 'inbound') {
      setInboundConfig((c) => ({ ...c, ...updates }));
      setInboundChanged(true);
    } else {
      setOutboundConfig((c) => ({ ...c, ...updates }));
      setOutboundChanged(true);
    }
  };

  // Render (much simpler)
  const currentConfig = activeTab === 'inbound' ? inboundConfig : outboundConfig;

  return (
    <div>
      {/* Tab navigation */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Unified form for either agent */}
      <UnifiedAgentConfigForm
        agentType={activeTab}
        config={currentConfig}
        onConfigChange={(updates) => handleConfigChange(activeTab, updates)}
        // ... other props
      />

      {/* Prompt checkpoint modal */}
      <PromptCheckpointModal {...promptCheckpointProps} />

      {/* Multi-tab conflict alert */}
      <MultiTabConflictAlert {...conflictProps} />
    </div>
  );
}
```

### Phase 3: Remove Duplication (1 hour)

**Lines Removed:** ~500-600 lines of duplicated JSX
**Result:** Page reduces from 1419 lines to ~600-700 lines

**Specific Changes:**
- Remove duplicated section JSX for inbound/outbound
- Remove duplicated state initialization
- Remove duplicated event handlers
- Consolidate validation logic
- Consolidate error handling

---

## Benefits After Unification

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Code Duplication** | 50-60% duplication | ~5% duplication | 90% reduction |
| **Page Size** | 1419 lines | ~600 lines | 58% reduction |
| **Maintainability** | High (two copies to update) | Low (single source) | 2x easier |
| **Testing** | Two forms to test | One form to test | 2x faster |
| **Adding Features** | 2 places to edit | 1 place to edit | 2x faster |
| **Bug Fixes** | Need to fix twice | Fix once | Instant consistency |
| **Component Reuse** | Limited | High (all sections reuse) | Better architecture |

---

## Migration Path

### Option A: Big Bang Refactor (Lower Risk)
1. Create `UnifiedAgentConfigForm.tsx` alongside existing code
2. Test thoroughly in isolated component tests
3. Switch page to use unified form (one file change)
4. Remove old duplicated code

**Pros:**
- Atomic, easy to review
- Easy to rollback if issues
- All testing happens in isolation

**Cons:**
- Larger single change
- Needs thorough QA before merge

### Option B: Incremental Refactor (Higher Risk)
1. Extract one section at a time
2. Update page to use each extracted component
3. Gradually eliminate duplication
4. Final step: create unified form

**Pros:**
- Smaller commits
- Easier to spot problems

**Cons:**
- Multiple partial deployments
- More review overhead
- Harder to track progress

**Recommendation:** Option A (Big Bang) for this codebase because:
- Component is well-scoped and testable
- Risk is contained to one file
- Benefits of atomic change outweigh incremental complexity

---

## Test Coverage Required

After unification, verify:

### Unit Tests
- [ ] UnifiedAgentConfigForm renders with inbound agent type
- [ ] UnifiedAgentConfigForm renders with outbound agent type
- [ ] Config changes propagate to parent via onConfigChange callback
- [ ] PhoneSection conditionally shows for inbound
- [ ] PhoneSection conditionally shows for outbound
- [ ] All sections accept correct props
- [ ] Save button state reflects hasChanges prop

### Integration Tests
- [ ] Tab switching preserves inbound config
- [ ] Tab switching preserves outbound config
- [ ] Config changes don't leak between tabs
- [ ] Save works for inbound agent
- [ ] Save works for outbound agent
- [ ] Prompt checkpoint appears for both agent types
- [ ] Multi-tab conflict detection works for both types

### Manual Testing
- [ ] Edit inbound agent → save → verify changes in API
- [ ] Edit outbound agent → save → verify changes in API
- [ ] Switch tabs without saving → changes preserved
- [ ] Delete agent (both types) still works
- [ ] Test call functionality still works
- [ ] Phone section displays correctly for each type

---

## File Changes Summary

### New Files
- `src/components/dashboard/AgentConfig/UnifiedAgentConfigForm.tsx` - Unified form component

### Modified Files
- `src/app/dashboard/agent-config/page.tsx` - Refactor to use unified form (major changes)
- `src/app/dashboard/agent-config/page.tsx` - Remove ~600 lines of duplicated JSX

### Deleted Files
- None (code removed, not files)

### Reused Existing Files
- `src/components/dashboard/AgentConfig/PersonaSection.tsx` ✅
- `src/components/dashboard/AgentConfig/VoiceSection.tsx` ✅
- `src/components/dashboard/AgentConfig/PromptSection.tsx` ✅
- `src/components/dashboard/AgentConfig/IdentitySection.tsx` ✅
- `src/components/dashboard/AgentConfig/PhoneSection.tsx` ✅

---

## Estimated Effort

| Phase | Task | Time | Notes |
|-------|------|------|-------|
| 1 | Create UnifiedAgentConfigForm | 2 hrs | New component, combines existing sections |
| 2 | Refactor page component | 3 hrs | Remove duplication, switch to unified form |
| 3 | Testing & QA | 2 hrs | Unit + integration + manual |
| **Total** | **Complete Unification** | **7 hrs** | One developer, low risk |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Config state lost | Low | High | Preserve state through refactor, atomic change |
| Save functionality breaks | Low | High | Test both agent types before deploy |
| Regression in validation | Medium | Medium | Keep existing validators, test thoroughly |
| Component layout breaks | Medium | Low | Responsive design already tested in sections |
| Performance degradation | Low | Low | Same components, same logic, no perf impact |

**Overall Risk: LOW** - This is a refactoring, not a feature change. Existing functionality is preserved.

---

## Success Criteria

✅ After unification, verify:

1. **Code Quality**
   - [ ] Page size reduced to <700 lines
   - [ ] Duplication <5%
   - [ ] All sections reuse extracted components

2. **Functionality**
   - [ ] Inbound agent config save works
   - [ ] Outbound agent config save works
   - [ ] Tab switching preserves state
   - [ ] Config validation still works
   - [ ] Delete still works

3. **UX**
   - [ ] No visual regression
   - [ ] Same save performance
   - [ ] Prompt checkpoint still works
   - [ ] Multi-tab conflict still works

4. **Testing**
   - [ ] All unit tests pass
   - [ ] All integration tests pass
   - [ ] Manual QA complete

---

## Next Steps

1. **Now:** Create `UnifiedAgentConfigForm.tsx` with extracted components
2. **Then:** Refactor `page.tsx` to use unified form
3. **Test:** Verify all functionality works for both agent types
4. **Deploy:** With confidence that code is cleaner, more maintainable

---

## Related Documentation

- `PROMPT_CHECKPOINT_INTEGRATION.md` - Prompt review before save
- `MULTI_TAB_CONFLICT_DETECTION.md` - Multi-tab awareness
- Component extraction guides for PersonaSection, VoiceSection, etc.
