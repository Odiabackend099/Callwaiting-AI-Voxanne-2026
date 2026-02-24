# Prompt Checkpoint Integration Guide

**Purpose:** Add a confirmation dialog before saving agent configuration that allows users to review and customize their system prompt and first message.

**Status:** ✅ Components and hook created, ready for integration into agent-config/page.tsx

**Files Created:**
1. `src/components/dashboard/AgentConfig/PromptCheckpointModal.tsx` - Modal UI component
2. `src/hooks/usePromptCheckpoint.ts` - State management hook

---

## Feature Overview

**Problem:** Users may not realize they're about to save a prompt that's incomplete or doesn't match their business needs. The system prompt especially is critical to agent behavior.

**Solution:** Show a checkpoint modal that displays:
- Agent name (confirmation)
- System Prompt preview (expandable)
- First Message preview (expandable)
- Edit and Confirm buttons

**User Flow:**
1. User clicks "Save Agent" button
2. Prompt checkpoint modal appears
3. User can:
   - **Edit:** Close modal and return to form to make changes
   - **Confirm & Save:** Proceed with saving (shows loading state during save)
   - **Cancel:** Close modal without saving

---

## Integration Steps

### Step 1: Import the Hook and Modal

In `src/app/dashboard/agent-config/page.tsx`, add imports at the top:

```typescript
import { PromptCheckpointModal } from '@/components/dashboard/AgentConfig/PromptCheckpointModal';
import { usePromptCheckpoint } from '@/hooks/usePromptCheckpoint';
```

### Step 2: Initialize the Hook

Add this hook initialization in the page component:

```typescript
export default function AgentConfigPage() {
  // ... existing state and hooks

  const promptCheckpoint = usePromptCheckpoint();

  // ... rest of component
}
```

### Step 3: Modify handleSave Function

Replace the current `handleSave` function with this version that integrates the checkpoint:

```typescript
const handleSave = async () => {
  const currentAgent = activeTab;
  const currentConfig = activeTab === 'inbound' ? inboundConfig : outboundConfig;

  // Validate config first (fail fast if invalid)
  const validationError = validateAgentConfig(currentConfig, currentAgent);
  if (validationError) {
    setError(validationError);
    return;
  }

  // Show checkpoint modal with current prompt data
  promptCheckpoint.show(
    {
      agentName: currentConfig.name || `${currentAgent} Agent`,
      systemPrompt: currentConfig.systemPrompt,
      firstMessage: currentConfig.firstMessage,
    },
    {
      onConfirm: async () => {
        // Perform the actual save (existing save logic)
        await performActualSave(currentConfig, currentAgent);
      },
      onCancel: () => {
        // User cancelled - nothing to do
      },
    }
  );
};

// Helper function: Extract the existing save logic into this
async function performActualSave(config: AgentConfig, agentType: 'inbound' | 'outbound') {
  setIsSaving(true);
  setSaveSuccess(false);
  setError(null);
  setSavingAgent(agentType);

  try {
    const payload: any = {};

    if (agentType === 'inbound') {
      payload.inbound = {
        name: config.name,
        systemPrompt: config.systemPrompt,
        firstMessage: config.firstMessage,
        voiceId: config.voice,
        voiceProvider: config.voiceProvider,
        language: config.language,
        maxDurationSeconds: config.maxDuration,
        voiceStability: config.voiceStability ?? null,
        voiceSimilarityBoost: config.voiceSimilarityBoost ?? null,
      };
    } else if (agentType === 'outbound') {
      payload.outbound = {
        name: config.name,
        systemPrompt: config.systemPrompt,
        firstMessage: config.firstMessage,
        voiceId: config.voice,
        voiceProvider: config.voiceProvider,
        language: config.language,
        maxDurationSeconds: config.maxDuration,
        vapiPhoneNumberId: selectedOutboundNumberId || null,
        voiceStability: config.voiceStability ?? null,
        voiceSimilarityBoost: config.voiceSimilarityBoost ?? null,
      };
    }

    const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 30000,
      retries: 1,
    });

    if (!result?.success) {
      throw new Error(result?.error || 'Failed to sync agent configuration to Vapi');
    }

    // Update original config to reflect saved state
    if (agentType === 'inbound') {
      setOriginalInboundConfig(config);
    } else {
      setOriginalOutboundConfig(config);
    }

    // Warn if tools failed to sync
    if (result?.toolsSynced === false) {
      setError('Agent saved, but tools failed to sync to Vapi. Please try saving again. If the issue persists, contact support.');
    }

    setSaveSuccess(true);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);

  } catch (err) {
    console.error('Error saving:', err);
    setError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
  } finally {
    setIsSaving(false);
    setSavingAgent(null);
  }
}
```

### Step 4: Add Modal to Render

In the JSX, add the modal component right before the closing `</div>` of the main container:

```typescript
{/* At the end of the page, after all other elements */}
<PromptCheckpointModal
  isOpen={promptCheckpoint.isOpen}
  agentName={promptCheckpoint.agentName}
  systemPrompt={promptCheckpoint.systemPrompt}
  firstMessage={promptCheckpoint.firstMessage}
  isLoading={promptCheckpoint.isLoading}
  onConfirm={promptCheckpoint.handleConfirm}
  onEdit={promptCheckpoint.handleEdit}
  onCancel={promptCheckpoint.handleCancel}
/>
```

---

## Component API

### PromptCheckpointModal Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Whether modal is visible |
| `agentName` | `string` | Yes | Agent name to display in header |
| `systemPrompt` | `string` | Yes | System prompt text (expandable preview) |
| `firstMessage` | `string` | Yes | First message text (expandable preview) |
| `isLoading` | `boolean` | No | Show loading state in buttons (default: false) |
| `onConfirm` | `() => void` | Yes | Called when user clicks "Confirm & Save" |
| `onEdit` | `() => void` | Yes | Called when user clicks "Edit" |
| `onCancel` | `() => void` | Yes | Called when user clicks "Cancel" |

### usePromptCheckpoint Hook API

**Methods:**

```typescript
// Show the checkpoint modal with data and callbacks
show(data: {
  agentName: string;
  systemPrompt: string;
  firstMessage: string;
}, handlers: {
  onConfirm: () => void;
  onCancel: () => void;
}): void

// Close the modal
close(): void

// Set loading state (useful during async save)
setLoading(loading: boolean): void

// Internal handlers - connect to modal buttons
handleConfirm(): Promise<void>
handleCancel(): void
handleEdit(): void
```

**State Properties:**

```typescript
// Current modal state
isOpen: boolean
agentName: string
systemPrompt: string
firstMessage: string
isLoading: boolean
```

---

## Behavior Details

### Modal Interaction

**Expand/Collapse Sections:**
- System Prompt section shows first 24 lines by default (max-h-24)
- First Message section shows first 4 lines by default (max-h-16)
- Click section header to expand/collapse full text
- Helps focus on key information while allowing details when needed

**Warnings:**
- If system prompt or first message is empty, warning appears: "Your agent will use default prompts if you don't customize these"
- Encourages users to fill in at least system prompt for best results

**Button States:**
- All buttons disabled while saving (isLoading=true)
- "Confirm & Save" shows loading text during async operation
- Edit button closes modal and returns user to form

### Data Flow

```
handleSave()
  ↓
validate config
  ↓
promptCheckpoint.show() → Modal appears
  ↓
User chooses:
  ├─ Edit → handleEdit() → Modal closes → User edits form → Click Save again
  ├─ Cancel → handleCancel() → Modal closes → No save
  └─ Confirm & Save → handleConfirm() → performActualSave() → Success/Error
```

---

## UX Considerations

**Why This Helps:**

1. **Catches Incomplete Prompts:** Users see empty fields before they're committed
2. **Reduces Save Errors:** Validation happens before the checkpoint, so users never see "invalid config" messages after clicking save
3. **Increases Confidence:** Users see exactly what they're about to save
4. **Enables Customization:** "Edit" button allows last-minute adjustments without a full page reload
5. **Prevents Accidental Saves:** Extra confirmation step prevents "oops, I didn't mean to save that"

**Modal Positioning:**

- Fixed overlay with backdrop blur
- Centered on screen, responsive to viewport
- Max-width 2xl keeps content readable
- Max-height 90vh allows scrolling if needed
- Sticky header/footer stay visible while scrolling content

---

## Testing Checklist

After integration, verify:

- [ ] Modal appears when save button clicked
- [ ] Modal displays correct agent name, system prompt, first message
- [ ] Expanding/collapsing prompt sections works smoothly
- [ ] "Edit" button closes modal and focuses form
- [ ] "Cancel" button closes modal without saving
- [ ] "Confirm & Save" button shows loading state
- [ ] After save completes, success message appears
- [ ] If save fails, error message displays in form (not modal)
- [ ] Warning message appears when prompts are empty
- [ ] All buttons disabled while saving
- [ ] Modal backdrop click doesn't close (only buttons work)

---

## Future Enhancements

**Possible Improvements:**

1. **Prompt Suggestions:** Show AI-generated prompt suggestions based on agent type
2. **Preview Audio:** Play audio preview of first message in modal
3. **Character Count:** Show character count for system prompt (API may have limits)
4. **Save History:** Show diff between current and previously saved prompts
5. **Templates:** Offer to apply industry-specific prompt templates

---

## Files Modified

### Files to Update
- `src/app/dashboard/agent-config/page.tsx` - Import hook/modal, modify handleSave, add modal to JSX

### Files Created
- `src/components/dashboard/AgentConfig/PromptCheckpointModal.tsx` ✅
- `src/hooks/usePromptCheckpoint.ts` ✅
- `PROMPT_CHECKPOINT_INTEGRATION.md` (this file) ✅

---

## Notes

**Why Modal Instead of Alert:**
- HTML `alert()` is blocking and doesn't match design system
- Modal uses Voxanne's design tokens (colors, spacing, shadows)
- Allows rich content display (expandable sections, warnings)
- Better user experience with smooth animations

**State Management:**
- Hook manages all checkpoint state in one place
- Keeps page component clean and focused
- Reusable for other checkpoint workflows in future

**Performance:**
- Modal component is lightweight (CSS-in-JS only, no external libraries)
- No additional API calls
- Expandable/collapsible sections use CSS transitions (GPU-accelerated)
