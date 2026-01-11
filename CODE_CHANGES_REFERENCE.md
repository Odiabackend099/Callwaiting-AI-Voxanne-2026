# Code Changes Reference - Agent Configuration Refactor

Quick reference for all code modifications made during the refactoring.

---

## Backend Changes

### File: `backend/src/routes/founder-console-v2.ts`

#### Location: Lines 800-934

#### BEFORE (Original):
```typescript
router.get('/agent/config', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Only fetched OUTBOUND agent (BUG!)
    const [vapiResult, twilioResult, agentResult] = await Promise.all([
      supabase.from('integrations').select('config').eq('provider', INTEGRATION_PROVIDERS.VAPI).eq('org_id', orgId).limit(1).single(),
      supabase.from('integrations').select('config').eq('provider', INTEGRATION_PROVIDERS.TWILIO).eq('org_id', orgId).limit(1).single(),
      supabase.from('agents').select('id, system_prompt, voice, language, max_call_duration, first_message, vapi_assistant_id')
        .eq('role', AGENT_ROLES.OUTBOUND)  // ← ONLY OUTBOUND!
        .eq('org_id', orgId)
        .limit(1)
        .single()
    ]);

    const vapiIntegration = vapiResult.data;
    const twilioIntegration = twilioResult.data;
    const agent = agentResult.data;

    const vapiConfig = vapiIntegration?.config || {};
    const twilioConfig = twilioIntegration?.config || {};

    res.json({
      vapi: {
        publicKey: maskKey(vapiConfig.vapi_public_key),
        secretKey: maskKey(vapiConfig.vapi_api_key || vapiConfig.vapi_secret_key),
        systemPrompt: agent?.system_prompt || buildOutboundSystemPrompt(getDefaultPromptConfig()),
        voice: agent?.voice || 'paige',
        language: agent?.language || 'en-GB',
        maxCallDuration: agent?.max_call_duration || 600,
        firstMessage: agent?.first_message || 'Hello! This is CallWaiting AI calling...',
        phoneNumberId: vapiConfig.vapi_phone_number_id || ''
      },
      twilio: { ... }
    });
  } catch (error: any) {
    logger.exception('Failed to get agent config', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### AFTER (Refactored):
```typescript
router.get('/agent/config', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    const { role } = req.query;  // ← NEW: role parameter

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // NEW: Validate role parameter if provided
    if (role && !['inbound', 'outbound'].includes(role as string)) {
      res.status(400).json({ error: 'Invalid role. Must be "inbound" or "outbound"' });
      return;
    }

    // FIXED: Fetch BOTH inbound AND outbound agents
    const [vapiResult, twilioResult, inboundAgentResult, outboundAgentResult] = await Promise.all([
      supabase.from('integrations').select('config').eq('provider', INTEGRATION_PROVIDERS.VAPI).eq('org_id', orgId).limit(1).single(),
      supabase.from('integrations').select('config').eq('provider', INTEGRATION_PROVIDERS.TWILIO).eq('org_id', orgId).limit(1).single(),
      // NEW: Conditional fetch (skip if role=outbound)
      role === 'outbound' ? Promise.resolve({ data: null }) : supabase
        .from('agents')
        .select('id, system_prompt, voice, language, max_call_duration, first_message, vapi_assistant_id, role')
        .eq('role', AGENT_ROLES.INBOUND)
        .eq('org_id', orgId)
        .limit(1)
        .single(),
      // FIXED: Query for outbound, conditional (skip if role=inbound)
      role === 'inbound' ? Promise.resolve({ data: null }) : supabase
        .from('agents')
        .select('id, system_prompt, voice, language, max_call_duration, first_message, vapi_assistant_id, role')
        .eq('role', AGENT_ROLES.OUTBOUND)
        .eq('org_id', orgId)
        .limit(1)
        .single()
    ]);

    const vapiIntegration = vapiResult.data;
    const twilioIntegration = twilioResult.data;
    const inboundAgent = inboundAgentResult.data;    // ← NEW
    const outboundAgent = outboundAgentResult.data;  // ← FIXED (was just 'agent')

    const vapiConfig = vapiIntegration?.config || {};
    const twilioConfig = twilioIntegration?.config || {};

    // NEW: Build agents array
    const agents = [];

    if (inboundAgent) {
      agents.push({
        id: inboundAgent.id,
        role: 'inbound',
        systemPrompt: inboundAgent.system_prompt,
        voice: inboundAgent.voice,
        language: inboundAgent.language,
        maxCallDuration: inboundAgent.max_call_duration,
        firstMessage: inboundAgent.first_message,
        vapiAssistantId: inboundAgent.vapi_assistant_id
      });
    }

    if (outboundAgent) {
      agents.push({
        id: outboundAgent.id,
        role: 'outbound',
        systemPrompt: outboundAgent.system_prompt || buildOutboundSystemPrompt(getDefaultPromptConfig()),
        voice: outboundAgent.voice || 'paige',
        language: outboundAgent.language || 'en-GB',
        maxCallDuration: outboundAgent.max_call_duration || 600,
        firstMessage: outboundAgent.first_message || 'Hello! This is CallWaiting AI calling...',
        vapiAssistantId: outboundAgent.vapi_assistant_id
      });
    }

    // NEW: Build legacy vapi response for backward compatibility
    const legacyVapi = outboundAgent ? {
      publicKey: maskKey(vapiConfig.vapi_public_key),
      secretKey: maskKey(vapiConfig.vapi_api_key || vapiConfig.vapi_secret_key),
      systemPrompt: outboundAgent.system_prompt || buildOutboundSystemPrompt(getDefaultPromptConfig()),
      voice: outboundAgent.voice || 'paige',
      language: outboundAgent.language || 'en-GB',
      maxCallDuration: outboundAgent.max_call_duration || 600,
      firstMessage: outboundAgent.first_message || 'Hello! This is CallWaiting AI calling...',
      phoneNumberId: vapiConfig.vapi_phone_number_id || ''
    } : {
      publicKey: maskKey(vapiConfig.vapi_public_key),
      secretKey: maskKey(vapiConfig.vapi_api_key || vapiConfig.vapi_secret_key),
      systemPrompt: buildOutboundSystemPrompt(getDefaultPromptConfig()),
      voice: 'paige',
      language: 'en-GB',
      maxCallDuration: 600,
      firstMessage: 'Hello! This is CallWaiting AI calling...',
      phoneNumberId: vapiConfig.vapi_phone_number_id || ''
    };

    res.json({
      success: true,
      agents,  // ← NEW: Primary response
      vapiConfigured: Boolean(vapiIntegration),
      vapi: legacyVapi,  // ← Updated: Legacy format for backward compatibility
      twilio: {
        accountSid: maskKey(twilioConfig.twilio_account_sid),
        authToken: maskKey(twilioConfig.twilio_auth_token),
        fromNumber: twilioConfig.twilio_from_number || ''
      }
    });
  } catch (error: any) {
    logger.exception('Failed to get agent config', error);
    res.status(500).json({ error: error.message });
  }
});
```

#### Key Changes:
1. Added `role` query parameter validation
2. Fixed bug: Now queries for BOTH inbound and outbound agents
3. Added conditional database queries (only fetch requested role)
4. Added new `agents` array in response
5. Maintained `vapi` field for backward compatibility
6. Added performance optimization: Skip queries for non-requested roles

---

## Frontend Changes

### File: `src/app/dashboard/agent-config/page.tsx`

#### Change 1: Import `useSearchParams` (Line 4)

**BEFORE:**
```typescript
import { useRouter } from 'next/navigation';
```

**AFTER:**
```typescript
import { useRouter, useSearchParams } from 'next/navigation';
```

---

#### Change 2: Add Tab State with URL Support (Lines 44-47)

**BEFORE:**
```typescript
export default function AgentConfigPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
```

**AFTER:**
```typescript
export default function AgentConfigPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();

    // Tab navigation with URL param support
    const tabParam = searchParams.get('agent');
    const initialTab = (tabParam === 'inbound' || tabParam === 'outbound') ? tabParam : 'inbound';
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>(initialTab as 'inbound' | 'outbound');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
```

---

#### Change 3: Add Helper Function (Lines 261-265)

**BEFORE:**
```typescript
const inboundChanged = hasAgentChanged(inboundConfig, originalInboundConfig);
const outboundChanged = hasAgentChanged(outboundConfig, originalOutboundConfig);

const hasChanges = () => inboundChanged || outboundChanged;
```

**AFTER:**
```typescript
const inboundChanged = hasAgentChanged(inboundConfig, originalInboundConfig);
const outboundChanged = hasAgentChanged(outboundConfig, originalOutboundConfig);

const hasChanges = () => inboundChanged || outboundChanged;

const hasActiveTabChanges = () => {
    if (activeTab === 'inbound') return inboundChanged;
    if (activeTab === 'outbound') return outboundChanged;
    return false;
};
```

---

#### Change 4: Update Save Logic (Lines 296-387)

**BEFORE:**
```typescript
const handleSave = async () => {
    if (!vapiConfigured) {
        setError('Please configure your Vapi API key in the API Keys page first.');
        return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
        const payload: any = {};

        // Only include inbound config if it has changes
        if (inboundChanged) {
            const inboundError = validateAgentConfig(inboundConfig, 'inbound');
            if (inboundError) {
                setError(inboundError);
                setIsSaving(false);
                return;
            }

            payload.inbound = { ... };
        }

        // Only include outbound config if it has changes
        if (outboundChanged) {
            const outboundError = validateAgentConfig(outboundConfig, 'outbound');
            if (outboundError) {
                setError(outboundError);
                setIsSaving(false);
                return;
            }

            payload.outbound = { ... };
        }

        // If no changes, don't send
        if (!payload.inbound && !payload.outbound) {
            setError('No changes to save');
            setIsSaving(false);
            return;
        }

        // Save agents independently
        const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', { ... });

        if (!result?.success) {
            throw new Error(result?.error || 'Failed to sync agent configuration to Vapi');
        }

        // Update original configs only for agents that were saved
        if (inboundChanged) {
            setOriginalInboundConfig(inboundConfig);
        }
        if (outboundChanged) {
            setOriginalOutboundConfig(outboundConfig);
        }

        setSaveSuccess(true);
        // ... timeout logic
    } catch (err) {
        console.error('Error saving:', err);
        setError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    } finally {
        setIsSaving(false);
    }
};
```

**AFTER:**
```typescript
const handleSave = async () => {
    if (!vapiConfigured) {
        setError('Please configure your Vapi API key in the API Keys page first.');
        return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
        // Build payload for ONLY the active tab
        const payload: any = {};

        // Save only the ACTIVE tab's agent
        if (activeTab === 'inbound' && inboundChanged) {
            const inboundError = validateAgentConfig(inboundConfig, 'inbound');
            if (inboundError) {
                setError(inboundError);
                setIsSaving(false);
                return;
            }

            payload.inbound = { ... };
        }

        if (activeTab === 'outbound' && outboundChanged) {
            const outboundError = validateAgentConfig(outboundConfig, 'outbound');
            if (outboundError) {
                setError(outboundError);
                setIsSaving(false);
                return;
            }

            payload.outbound = { ... };
        }

        if (!payload.inbound && !payload.outbound) {
            setError('No changes to save');
            setIsSaving(false);
            return;
        }

        // Save to backend
        const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', { ... });

        if (!result?.success) {
            throw new Error(result?.error || 'Failed to sync agent configuration to Vapi');
        }

        // Update original config for ACTIVE tab only
        if (activeTab === 'inbound') {
            setOriginalInboundConfig(inboundConfig);
        } else {
            setOriginalOutboundConfig(outboundConfig);
        }

        setSaveSuccess(true);
        // ... timeout logic
    } catch (err) {
        console.error('Error saving:', err);
        setError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    } finally {
        setIsSaving(false);
    }
};
```

---

#### Change 5: Update Save Button (Lines 468-494)

**BEFORE:**
```typescript
<button
    onClick={handleSave}
    disabled={!hasChanges() || isSaving || !vapiConfigured}
    className={`px-6 py-3 rounded-xl font-medium shadow-lg transition-all flex items-center gap-2 ${saveSuccess
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        : hasChanges() && vapiConfigured
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-xl'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
        }`}
>
    {isSaving ? (
        <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
        </>
    ) : saveSuccess ? (
        <>
            <Check className="w-5 h-5" />
            Saved!
        </>
    ) : (
        <>
            <Save className="w-5 h-5" />
            Save Changes
        </>
    )}
</button>
```

**AFTER:**
```typescript
<button
    onClick={handleSave}
    disabled={!hasActiveTabChanges() || isSaving || !vapiConfigured}
    className={`px-6 py-3 rounded-xl font-medium shadow-lg transition-all flex items-center gap-2 ${saveSuccess
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        : hasActiveTabChanges() && vapiConfigured
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-xl'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
        }`}
>
    {isSaving ? (
        <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving {activeTab === 'inbound' ? 'Inbound' : 'Outbound'} Agent...
        </>
    ) : saveSuccess ? (
        <>
            <Check className="w-5 h-5" />
            Saved!
        </>
    ) : (
        <>
            <Save className="w-5 h-5" />
            Save {activeTab === 'inbound' ? 'Inbound' : 'Outbound'} Agent
        </>
    )}
</button>
```

---

#### Change 6: Replace Grid Layout with Tabs (Lines 542-828)

**BEFORE:**
```typescript
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
    {/* INBOUND AGENT */}
    <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2 mb-1">
                <Phone className="w-6 h-6" />
                Inbound Agent
            </h2>
            {/* ... inbound form fields ... */}
        </div>
    </div>

    {/* OUTBOUND AGENT */}
    <div className="space-y-6">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-emerald-900 flex items-center gap-2 mb-1">
                📤 Outbound Agent
            </h2>
            {/* ... outbound form fields ... */}
        </div>
    </div>
</div>
```

**AFTER:**
```typescript
{/* Tab Navigation */}
<div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-xl inline-flex mb-8">
    <button
        onClick={() => {
            setActiveTab('inbound');
            router.push('/dashboard/agent-config?agent=inbound');
        }}
        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'inbound'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
        }`}
    >
        <Phone className="w-4 h-4" />
        Inbound Agent
        {inboundStatus?.inboundNumber && (
            <span className="text-xs opacity-70">({inboundStatus.inboundNumber})</span>
        )}
    </button>
    <button
        onClick={() => {
            setActiveTab('outbound');
            router.push('/dashboard/agent-config?agent=outbound');
        }}
        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'outbound'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
        }`}
    >
        <Phone className="w-4 h-4" />
        Outbound Agent
        {inboundStatus?.inboundNumber && (
            <span className="text-xs opacity-70">(Caller ID: {inboundStatus.inboundNumber})</span>
        )}
    </button>
</div>

{/* INBOUND AGENT TAB */}
{activeTab === 'inbound' && (
<div className="space-y-6 max-w-3xl">
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2 mb-1">
            <Phone className="w-6 h-6" />
            Inbound Agent
        </h2>
        {/* ... inbound form fields ... */}
    </div>
</div>
)}

{/* OUTBOUND AGENT TAB */}
{activeTab === 'outbound' && (
<div className="space-y-6 max-w-3xl">
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-emerald-900 flex items-center gap-2 mb-1">
            📤 Outbound Agent
        </h2>
        {/* ... outbound form fields ... */}
    </div>
</div>
)}
```

---

## Summary of Changes

### Lines Modified
- **Backend**: 135 lines (800-934 in founder-console-v2.ts)
- **Frontend**: ~100 lines across multiple locations

### Total Files Changed: 2
1. `backend/src/routes/founder-console-v2.ts`
2. `src/app/dashboard/agent-config/page.tsx`

### New Patterns Introduced
- URL parameter-based tab navigation
- Conditional component rendering
- Helper functions for state logic
- Pill-style tab styling (matches existing patterns)

### Backward Compatibility
- ✅ API remains backward compatible
- ✅ Old links work without `?agent` param
- ✅ Legacy response format still available
- ✅ No breaking changes

All changes follow existing codebase patterns and maintain consistency with the Test and Calls pages implementation.
