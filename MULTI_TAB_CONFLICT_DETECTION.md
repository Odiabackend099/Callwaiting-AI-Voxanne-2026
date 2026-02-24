# Multi-Tab Conflict Detection Guide

**Purpose:** Detect when multiple tabs are editing the same agent config, and alert users if one tab saves changes while another has unsaved changes.

**Status:** ✅ Components and hook created, ready for integration

**Files Created:**
1. `src/hooks/useMultiTabConflictDetection.ts` - Conflict detection hook
2. `src/components/dashboard/AgentConfig/MultiTabConflictAlert.tsx` - Alert UI
3. `MULTI_TAB_CONFLICT_DETECTION.md` - This integration guide

---

## Feature Overview

**Problem:** If a user has two browser tabs open with the same agent config:
1. They edit in Tab A and save
2. Tab B still has old data loaded
3. Tab B saves and overwrites Tab A's changes (race condition)
4. Data loss / confusion

**Solution:** Detect when another tab saves and alert the current tab:
- Show alert: "Changes detected in another tab"
- Block save until conflict resolved
- Offer "Refresh" button to reload latest data

**User Flow:**
1. User opens agent config in Tab A and Tab B
2. User edits in Tab A and clicks Save
3. Tab A saves successfully
4. Tab B detects save and shows conflict alert
5. User in Tab B can:
   - Click "Refresh" → reload latest data from server
   - Click "Dismiss" → acknowledge conflict (save still blocked)
6. After refresh, Tab B shows latest data and save is re-enabled

---

## Technical Architecture

### Communication Methods

The hook uses two approaches for cross-tab communication:

**Primary: BroadcastChannel API** (modern browsers)
- Fast, efficient inter-tab messaging
- Dedicated channel per agent type: `agent-config-inbound`, `agent-config-outbound`
- Real-time detection of saves

**Fallback: localStorage + storage events** (older browsers)
- Uses `storage` event listener
- Timestamp-based differentiation (detect messages from other tabs)
- Slightly higher latency but universal browser support

### Message Format

```typescript
// BroadcastChannel message
{
  type: 'save' | 'refresh',
  tabId: string,           // Unique ID for this tab (timestamp + random)
  timestamp: number,       // When the save happened
  agentName: string,       // Name of the agent being saved
}

// localStorage message (JSON)
{
  tabId: string,
  timestamp: number,
  agentName: string,
}
```

---

## Integration Steps

### Step 1: Import Hook and Component

In `src/app/dashboard/agent-config/page.tsx`:

```typescript
import { useMultiTabConflictDetection } from '@/hooks/useMultiTabConflictDetection';
import { MultiTabConflictAlert } from '@/components/dashboard/AgentConfig/MultiTabConflictAlert';
```

### Step 2: Initialize Hook

In the page component:

```typescript
export default function AgentConfigPage() {
  // ... existing hooks

  const conflict = useMultiTabConflictDetection({
    agentType: activeTab,           // 'inbound' | 'outbound'
    agentName: currentConfig.name || `${activeTab} Agent`,
  });

  // ... rest of component
}
```

### Step 3: Block Save if Conflict Exists

Modify the save handler to check for conflicts:

```typescript
const handleSave = async () => {
  // Block save if conflict detected
  if (!conflict.canSave()) {
    setError('Another tab has modified this agent. Please refresh to see the latest changes.');
    return;
  }

  setIsSaving(true);
  setSaveSuccess(false);
  setError(null);

  try {
    // ... existing save logic

    // After successful save, broadcast to other tabs
    conflict.broadcastSave();

    // ... rest of save logic
  } catch (err) {
    // error handling
  } finally {
    setIsSaving(false);
  }
};
```

### Step 4: Add Alert to JSX

In the render section, add the alert component:

```typescript
return (
  <div>
    {/* Existing JSX */}

    {/* Multi-tab conflict alert */}
    <MultiTabConflictAlert
      isVisible={conflict.hasConflict}
      message={conflict.conflictMessage}
      conflictingAgentName={conflict.conflictingTab?.agentName}
      onDismiss={conflict.clearConflict}
      onRefresh={() => {
        // Option 1: Full page reload
        window.location.reload();

        // Option 2: Refetch latest config from server
        // await refetchAgentConfig(activeTab);
        // conflict.clearConflict();
      }}
    />
  </div>
);
```

### Step 5: Disable Save Button on Conflict

Update the Save button to reflect conflict state:

```typescript
<button
  onClick={handleSave}
  disabled={!hasActiveTabChanges() || isSaving || !conflict.canSave()}
  className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 text-sm ${
    !conflict.canSave()
      ? 'bg-amber-50 text-amber-600 border border-amber-200 cursor-not-allowed'
      : saveSuccess
        ? 'bg-surgical-50 text-surgical-600 border border-surgical-200'
        : hasActiveTabChanges()
          ? 'bg-surgical-600 hover:bg-surgical-700 text-white'
          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
  }`}
  title={!conflict.canSave() ? 'Refresh the page to resolve the conflict' : undefined}
>
  {!conflict.canSave() ? (
    <>
      <AlertTriangle className="w-4 h-4" />
      Conflict Detected
    </>
  ) : saveSuccess ? (
    <>
      <Check className="w-4 h-4" />
      Saved
    </>
  ) : (
    <>
      <Save className="w-4 h-4" />
      {isSaving ? 'Saving...' : 'Save Agent'}
    </>
  )}
</button>
```

---

## Component API

### useMultiTabConflictDetection Hook

**Parameters:**
```typescript
{
  agentType: 'inbound' | 'outbound',  // Type of agent being edited
  agentName: string,                   // Name of agent (for display)
}
```

**Return Value:**
```typescript
{
  // State
  hasConflict: boolean,                // True if another tab saved
  conflictMessage: string,             // Message to show user
  conflictingTab?: {                   // Info about conflicting tab
    timestamp: number,                 // When conflict occurred
    agentType: 'inbound' | 'outbound',
    agentName: string,
  },

  // Methods
  broadcastSave(): void,               // Call after successful save
  clearConflict(): void,               // Clear conflict state
  canSave(): boolean,                  // Check if save is allowed
  getTabId(): string,                  // Get this tab's unique ID
}
```

### MultiTabConflictAlert Component

**Props:**
```typescript
{
  isVisible: boolean,                  // Show/hide alert
  message: string,                     // Conflict message
  conflictingAgentName?: string,       // Name of agent in other tab
  onDismiss: () => void,              // Called when "Dismiss" clicked
  onRefresh?: () => void,             // Called when "Refresh" clicked (optional)
}
```

**Rendering:**
- Dismissable alert at bottom-right of screen
- Shows with amber warning styling
- Includes timestamp in message
- Two action buttons: "Refresh" and "Dismiss"

---

## Behavior Details

### Conflict Detection Process

1. **Tab A opens agent config** → Creates unique tab ID, subscribes to messages
2. **Tab B opens same agent config** → Different tab ID, same subscription
3. **Tab A saves changes** → Calls `broadcastSave()`
4. **BroadcastChannel sends message to Tab B** → Tab B receives in `onmessage`
5. **Tab B detects sender != self** → Sets `hasConflict = true`
6. **Alert appears in Tab B** → User sees "Changes detected"
7. **Tab B's save button disabled** → Prevents stale saves
8. **User clicks Refresh** → `onRefresh` callback (typically `window.location.reload()`)
9. **Page reloads** → Fetches latest config from server, conflict clears
10. **Save button re-enabled** → User can save their changes (which will merge if applicable)

### Message Broadcast

When Tab A saves successfully:

```typescript
conflict.broadcastSave();  // Called after API succeeds
```

This broadcasts:
```json
{
  "type": "save",
  "tabId": "tab-1706789500123-abc123def",
  "timestamp": 1706789512345,
  "agentName": "Inbound Agent"
}
```

### Fallback Behavior (No BroadcastChannel)

If browser doesn't support BroadcastChannel:
1. Hook catches error and falls back to localStorage
2. Stores message in localStorage key: `agent-config-{agentType}-save`
3. Other tabs receive `storage` event
4. Compare timestamps to detect if from another tab (>1000ms difference)
5. Same flow as BroadcastChannel

---

## User Experience

### Scenario 1: User Refreshes

```
Tab A: User edits → Clicks Save ✓
Tab B: [Alert] "Changes detected. Refresh to see changes."
       User clicks "Refresh" → Page reloads
       → Sees latest data from Tab A
       → Save button re-enabled
```

### Scenario 2: User Dismisses

```
Tab B: [Alert] "Changes detected. Refresh to see changes."
       User clicks "Dismiss"
       → Alert closes
       → Save button still disabled
       → User must manually refresh when ready
```

### Scenario 3: User Ignores

```
Tab B: User continues editing with old data
       Tries to Save → Button disabled, can't proceed
       → Forced to refresh
```

---

## Edge Cases Handled

**Case 1: Same Tab Saves Multiple Times**
- Tab ID comparison prevents infinite loops
- Only messages from different tabs trigger conflict

**Case 2: Very Fast Consecutive Saves**
- Each save broadcasts new message
- Most recent message overwrites previous
- User sees latest timestamp

**Case 3: Tab Closes While Alert Showing**
- BroadcastChannel automatically cleans up
- No memory leaks or dangling listeners

**Case 4: localStorage Disabled**
- Both approaches disabled safely
- Hook returns no-op functions
- App continues to work (no conflict detection, but no errors)

**Case 5: Mixed Support**
- Some tabs have BroadcastChannel, others don't
- Each tab uses what's available
- Communication works across implementations

---

## Performance Considerations

**Memory:**
- One listener per tab (BroadcastChannel or storage event)
- Minimal state: 3-4 properties
- No polling or intervals

**Network:**
- No additional API calls
- Uses client-side messaging only
- Zero server overhead

**Latency:**
- BroadcastChannel: <1ms
- localStorage: 10-50ms
- Both negligible for UX

---

## Testing Checklist

After integration, verify:

- [ ] Open agent config in two tabs (Tab A and Tab B)
- [ ] Edit and save in Tab A
- [ ] Tab B shows conflict alert immediately
- [ ] Tab B's save button is disabled
- [ ] Click "Refresh" in Tab B → page reloads
- [ ] Tab B shows latest data from Tab A
- [ ] Tab B's save button is enabled after refresh
- [ ] Alert has correct timestamp
- [ ] Alert has correct agent name
- [ ] "Dismiss" button closes alert (but save still disabled)
- [ ] Tab C (third tab) also gets alert if Tab A saves again
- [ ] After page refresh, old tabs detect as stale
- [ ] Works in Firefox, Safari, Chrome (cross-browser)

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge | Mobile |
|---------|--------|---------|--------|------|--------|
| BroadcastChannel | ✅ 54+ | ✅ 38+ | ✅ 15.4+ | ✅ 79+ | ✅ Recent |
| localStorage | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| Fallback | Automatic if needed | Automatic if needed | N/A (has BC) | N/A (has BC) | Automatic |

---

## Future Enhancements

**Possible Improvements:**

1. **Automatic Merge:** Instead of blocking, offer to merge changes
   - Show diff of changes from both tabs
   - User selects which version for each field
   - Seamless continuation

2. **Sync Instead of Refresh:** Fetch latest config without page reload
   - Faster UX (no full page reload)
   - Preserve any additional local state
   - Smoother experience

3. **Collaboration Mode:** Show which fields changed in other tab
   - Highlight changed fields
   - Show timestamp and tab info
   - Better understanding of what changed

4. **Conflict Logging:** Send conflict events to analytics
   - Understand frequency of multi-tab editing
   - Identify patterns (specific user types, time of day)
   - Inform UI/UX improvements

5. **Debounced Broadcasts:** Batch saves in rapid succession
   - Reduce message volume if user spam-clicks save
   - More efficient for localStorage fallback
   - Still real-time for user perception

---

## Notes

**Why Not Automatic Merge:**
- Merging complex nested configs is error-prone
- User might not notice merged changes
- Manual refresh ensures user awareness
- Safer default behavior for sensitive agent settings

**Why Not Real-Time Sync:**
- Agent configs contain complex state
- Potential for race conditions in background syncing
- User might have intentionally diverged from latest
- Full refresh is safest option

**Why Not Disable Tab:**
- User might not realize why save is blocked
- Alert + disabled button = clear message
- Refresh is simple action, user regains control

---

## Files Modified

### Files to Update
- `src/app/dashboard/agent-config/page.tsx` - Import hook/component, integrate into page

### Files Created
- `src/hooks/useMultiTabConflictDetection.ts` ✅
- `src/components/dashboard/AgentConfig/MultiTabConflictAlert.tsx` ✅
- `MULTI_TAB_CONFLICT_DETECTION.md` (this file) ✅

---

## Related Documentation

- `PROMPT_CHECKPOINT_INTEGRATION.md` - Prompt review modal
- `src/app/dashboard/agent-config/page.tsx` - Main agent config page
- `usePromptCheckpoint.ts` - Prompt review hook
