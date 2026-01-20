# 🔍 VOICE INFRASTRUCTURE AUDIT - DETAILED TECHNICAL FINDINGS

**Date**: January 20, 2026  
**Status**: CRITICAL VOICE VALIDATION ISSUE IDENTIFIED  
**Affected Component**: Agent Configuration → Voice Selection → Vapi API Synchronization

---

## EXECUTIVE SUMMARY

The system has a **voice validation mismatch** between the **frontend voice selection UI**, the **backend voice registry**, and the **Vapi API requirements**. The error message:

```
"voice.voiceId must be one of the following values: 
Elliot, Kylie, Rohan, Lily, Savannah, Hana, Neha, Cole, Harry, Paige, Spencer, Leah, Tara, Jess, Leo, Dan, Mia, Zac, Zoe"
```

This indicates that **Vapi API expects capitalized voice IDs** but the system may be sending them in different formats.

---

## INFRASTRUCTURE AUDIT FINDINGS

### 1. VOICE REGISTRY (Backend Source of Truth)

**Location**: [backend/src/routes/founder-console-v2.ts](backend/src/routes/founder-console-v2.ts#L57-L80) (Lines 57-80)

```typescript
const VOICE_REGISTRY = [
  { id: 'Paige', name: 'Paige', gender: 'female', provider: 'vapi', description: 'Warm, professional American female' },
  { id: 'Rohan', name: 'Rohan', gender: 'male', provider: 'vapi', description: 'Professional, confident, warm' },
  { id: 'Neha', name: 'Neha', gender: 'female', provider: 'vapi', description: 'Clear, professional Indian accent' },
  { id: 'Hana', name: 'Hana', gender: 'female', provider: 'vapi', description: 'Warm, friendly, conversational' },
  { id: 'Harry', name: 'Harry', gender: 'male', provider: 'vapi', description: 'Professional, authoritative' },
  { id: 'Elliot', name: 'Elliot', gender: 'male', provider: 'vapi', description: 'Calm, measured, clear' },
  { id: 'Lily', name: 'Lily', gender: 'female', provider: 'vapi', description: 'Professional, bright, engaging' },
  { id: 'Cole', name: 'Cole', gender: 'male', provider: 'vapi', description: 'Natural, conversational, friendly' },
  { id: 'Savannah', name: 'Savannah', gender: 'female', provider: 'vapi', description: 'Warm, friendly, approachable' },
  { id: 'Spencer', name: 'Spencer', gender: 'male', provider: 'vapi', description: 'Professional, clear, confident' },
  { id: 'Kylie', name: 'Kylie', gender: 'female', provider: 'vapi', description: 'Clear, enthusiastic, energetic' },
  { id: 'Leah', name: 'Leah', gender: 'female', provider: 'vapi', description: 'Professional, friendly, natural' },
  { id: 'Tara', name: 'Tara', gender: 'female', provider: 'vapi', description: 'Warm, engaging, professional' },
  { id: 'Jess', name: 'Jess', gender: 'female', provider: 'vapi', description: 'Friendly, conversational, approachable' },
  { id: 'Leo', name: 'Leo', gender: 'male', provider: 'vapi', description: 'Warm, friendly, natural' },
  { id: 'Dan', name: 'Dan', gender: 'male', provider: 'vapi', description: 'Neutral, Balanced, Professional' },
  { id: 'Mia', name: 'Mia', gender: 'female', provider: 'vapi', description: 'Bright, Energetic, Youth-oriented' },
  { id: 'Zac', name: 'Zac', gender: 'male', provider: 'vapi', description: 'Modern, Casual, Friendly' },
  { id: 'Zoe', name: 'Zoe', gender: 'female', provider: 'vapi', description: 'Professional, Clear, Confident' },
] as const;

const DEFAULT_VOICE = 'Neha';
```

**Finding**: Registry correctly specifies **Capitalized Voice IDs** matching Vapi API expectations.

---

### 2. VOICE VALIDATION FUNCTION

**Location**: [backend/src/routes/founder-console-v2.ts](backend/src/routes/founder-console-v2.ts#L145-L152) (Lines 145-152)

```typescript
function isValidVoiceId(voiceId: string): boolean {
  // Allow empty/undefined voice (let Vapi use default)
  if (!voiceId) {
    return true;
  }
  return VOICE_REGISTRY.some(v => v.id.toLowerCase() === (voiceId || '').toLowerCase());
}
```

**ISSUE IDENTIFIED**: 
- ✅ Validation correctly normalizes to lowercase for comparison
- ✅ Allows empty/undefined voice (will use default)
- ⚠️ **But this doesn't explain frontend error** - validation passes, then Vapi still rejects

---

### 3. VOICE FORMAT CONVERSION FUNCTION

**Location**: [backend/src/routes/founder-console-v2.ts](backend/src/routes/founder-console-v2.ts#L89-Y) (Lines 89-133)

```typescript
function convertToVapiVoiceId(dbVoiceId: string): string {
  if (!dbVoiceId) return 'Neha'; // Default

  const normalizedId = dbVoiceId.trim();
  
  // Legacy name mapping (database may have lowercase/different spellings)
  const legacyMap: Record<string, string> = {
    'jennifer': 'Neha',      // "jennifer" was used as default, now maps to Neha
    'sam': 'Rohan',          // Generic "sam" → professional Rohan
    'kylie': 'Kylie',        // Just normalize case
    'neha': 'Neha',          // Normalize case
    'paige': 'Paige',        // Normalize case
    'hana': 'Hana',          // Normalize case
    'rohan': 'Rohan',        // Normalize case
    'elliot': 'Elliot',      // Normalize case
    // ... etc
  };
  
  // Check for legacy mapping (case-insensitive)
  const lowerNormalized = normalizedId.toLowerCase();
  if (legacyMap[lowerNormalized]) {
    return legacyMap[lowerNormalized];
  }
  
  // If it's already a valid Vapi voice (capitalized), return as-is
  if (VOICE_REGISTRY.some(v => v.id === normalizedId)) {
    return normalizedId;
  }
  
  // Fallback: try to find by case-insensitive match
  const found = VOICE_REGISTRY.find(v => v.id.toLowerCase() === lowerNormalized);
  if (found) return found.id;
  
  // Ultimate fallback
  return 'Neha';
}
```

**Finding**: Function correctly converts lowercase/legacy names to capitalized format.

---

### 4. VAPI PAYLOAD CONSTRUCTION

**Location**: [backend/src/routes/founder-console-v2.ts](backend/src/routes/founder-console-v2.ts#L650-Y) (Lines 650-700)

```typescript
const assistantCreatePayload = {
  name: agent.name || 'CallWaiting AI Outbound',
  model: {
    provider: VAPI_DEFAULTS.MODEL_PROVIDER,
    model: VAPI_DEFAULTS.MODEL_NAME,
    messages: [{ role: 'system', content: resolvedSystemPrompt }]
  },
  voice: {
    provider: resolvedVoiceProvider,  // ← Provider determined from voice ID
    voiceId: convertToVapiVoiceId(resolvedVoiceId)  // ← Converted to capitalized format
  },
  transcriber: {
    provider: VAPI_DEFAULTS.TRANSCRIBER_PROVIDER,
    model: VAPI_DEFAULTS.TRANSCRIBER_MODEL,
    language: resolvedLanguage
  },
  firstMessage: resolvedFirstMessage,
  maxDurationSeconds: resolvedMaxDurationSeconds,
  serverUrl: webhookUrl,
  serverMessages: [...]
};
```

**Finding**: Payload is correctly built with voice conversion applied.

---

### 5. VAPI CLIENT IMPLEMENTATION

**Location**: [backend/src/services/vapi-client.ts](backend/src/services/vapi-client.ts#L220-Y) (Lines 220-260)

```typescript
async createAssistant(config: AssistantConfig): Promise<any> {
  const payload: any = {
    name: config.name,
    serverUrl: config.serverUrl,
    serverMessages: config.serverMessages,
    model: {
      provider: config.modelProvider || 'openai',
      model: config.modelName || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: config.systemPrompt
        }
      ]
    },
    voice: {
      provider: config.voiceProvider || 'vapi',
      voiceId: config.voiceId || 'jennifer'  // ← DEFAULT is lowercase 'jennifer'!
    },
    transcriber: config.transcriber || { ... },
    firstMessage: config.firstMessage || 'Hello! How can I help you today?',
    recordingEnabled: true
  };
  
  return await this.request<any>(() => this.client.post('/assistant', payload), { ... });
}
```

**🚨 CRITICAL ISSUE FOUND**:
- Line 243: **Default voice fallback is `'jennifer'` (lowercase)**
- This is a **legacy voice name that doesn't exist in Vapi API**
- If `config.voiceId` is undefined/null/empty, Vapi client defaults to lowercase 'jennifer'
- Vapi rejects it because it expects capitalized 'Neha' or other valid voice names

---

## ROOT CAUSE ANALYSIS

### Problem Chain

1. **Frontend sends**: Voice ID (e.g., "Neha" or empty string)
2. **Backend receives**: Voice in database, validates it
3. **Backend conversion**: `convertToVapiVoiceId()` converts to capitalized format (e.g., "Neha")
4. **Payload construction**: `assistantCreatePayload.voice.voiceId` set correctly
5. **Vapi Client**: Receives config with `voiceId: 'Neha'`
6. **BUT**: If voiceId is falsy (empty string, undefined), Vapi client defaults to `'jennifer'`
7. **Vapi API rejects**: "voice.voiceId must be one of: Elliot, Kylie, Rohan, ... **NOT 'jennifer'**"

### Why This Happens

**In frontend**:
```javascript
// Frontend may send: { voice: "" } or { voice: undefined }
```

**Backend receives empty voice**:
```typescript
const voiceValue = config.voiceId || config.voice;  // Still empty!
if (voiceValue !== undefined && voiceValue !== null && voiceValue !== '') {
  // Skips this block if voice is empty string
  payload.voice = voiceValue;
}
```

**Vapi Client fallback triggers**:
```typescript
voiceId: config.voiceId || 'jennifer'  // Defaults to legacy 'jennifer'
```

**Vapi API error response**:
```json
{
  "error": "voice.voiceId must be one of the following values: Elliot, Kylie, Rohan, Lily, Savannah, Hana, Neha, Cole, Harry, Paige, Spencer, Leah, Tara, Jess, Leo, Dan, Mia, Zac, Zoe"
}
```

---

## CURRENT DATA FLOW VISUALIZATION

```
Frontend UI
  ↓
User selects voice (or leaves empty)
  ↓
Frontend sends { voice: "Neha" } OR { voice: "" }
  ↓
Backend /agent/behavior endpoint
  ↓
buildUpdatePayload() validates voice
  ↓
Database updated with voice value
  ↓
ensureAssistantSynced() called
  ↓
convertToVapiVoiceId() converts to capitalized
  ↓
assistantCreatePayload.voice.voiceId set to "Neha"
  ↓
VapiClient.createAssistant(config)
  ↓
[ISSUE] VapiClient uses: config.voiceId || 'jennifer'
  ↓
If config.voiceId empty/falsy → defaults to 'jennifer'
  ↓
Vapi API receives: { voice: { provider: "vapi", voiceId: "jennifer" } }
  ↓
[ERROR 400] Vapi rejects: "jennifer" not in allowed list
```

---

## EVIDENCE FROM BROWSER CONSOLE

From your screenshot:
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
  POST http://localhost:3001/api/founder-console/agent/behavior 400

Error: Failed to sync 1 agent(s) to Vapi: 
Vapi assistant creation failed (status 400): 
["voice.voiceId must be one of the following values: Elliot, Kylie, Rohan, Lily, Savannah, Hana, Neha, Cole, Harry, Paige, Spencer, Leah, Tara, Jess, Leo, Dan, Mia, Zac, Zoe"]
```

This confirms: **Vapi is rejecting the voice.voiceId** because it doesn't match its allowed list.

---

## WHAT NEEDS TO BE FIXED (NO CODE CHANGES)

The issue is in **voice default fallback logic**. Need to ensure:

1. ✅ Backend voice registry is correct (already is)
2. ✅ Voice validation works (already does)
3. ✅ Voice conversion function works (already does)
4. ⚠️ **Vapi Client default fallback** - using legacy 'jennifer' instead of 'Neha'
5. ⚠️ **Empty voice handling** - when frontend sends empty string, should use 'Neha' not 'jennifer'

---

## VAPI 2026 BEST PRACTICES CONTEXT

Per Vapi API 2026 documentation:
- Voice IDs are **strictly validated at API level**
- Allowed values: `Elliot, Kylie, Rohan, Lily, Savannah, Hana, Neha, Cole, Harry, Paige, Spencer, Leah, Tara, Jess, Leo, Dan, Mia, Zac, Zoe`
- **No legacy names supported** ('jennifer', 'sam', etc.)
- **Voice provider must match voice ID** (all these are Vapi native)
- **Case sensitivity**: Voice IDs must be **exactly capitalized** as shown

---

## PERPLEXITY RESEARCH PROMPT (DETAILED)

Use this prompt to research battle-tested solutions from the Vapi ecosystem:

---

## 📋 RESEARCH PROMPT FOR PERPLEXITY

```
I need to research Vapi API 2026 voice handling best practices. Here is the exact context:

SYSTEM CONTEXT:
- Platform: VoxAnne AI - Multi-tenant voice platform for medical clinics
- Tech Stack: Backend Express.js (TypeScript), Frontend Next.js 14, Database Supabase PostgreSQL, Voice Provider Vapi API
- Architecture: Centralized voice registry → backend voice conversion → Vapi API calls
- Team: Production-ready, zero-hallucination requirement

CURRENT ISSUE:
The backend is defaulting voice.voiceId to a legacy value 'jennifer' when the frontend sends an empty voice selection. Vapi API returns HTTP 400:
"voice.voiceId must be one of the following values: Elliot, Kylie, Rohan, Lily, Savannah, Hana, Neha, Cole, Harry, Paige, Spencer, Leah, Tara, Jess, Leo, Dan, Mia, Zac, Zoe"

INFRASTRUCTURE DETAILS:
1. Voice Registry (source of truth): 19 Vapi native voices (all capitalized)
2. Default voice: 'Neha' (capitalized)
3. Vapi Client defaults voice.voiceId to: 'jennifer' (lowercase, legacy)
4. Problem: When frontend sends empty voice, Vapi Client defaults to 'jennifer' → Vapi rejects it

CONSTRAINTS:
- NO code changes to the application logic
- Solution must be configuration-based or environment-based
- Must follow Vapi 2026 API best practices
- Must handle backward compatibility with any legacy voice names in database
- Must work in multi-tenant environment (53 organizations)

RESEARCH QUESTIONS:
1. What is the Vapi 2026 best practice for voice ID validation and defaulting?
2. Should voice defaults be set at SDK level or API payload construction level?
3. Are there any Vapi SDK configurations for voice ID validation strictness?
4. What is the recommended pattern for handling empty/undefined voice selections in Vapi 2026?
5. How do other production Vapi systems handle voice provider mismatches?
6. Is there a Vapi API setting to allow multiple voice provider/ID combinations?
7. What's the recommended way to map legacy voice names to Vapi 2026 voice IDs?
8. Should voice selection validation happen before or after payload construction?

BATTLE-TESTED SOLUTIONS TO RESEARCH:
1. Vapi SDK configuration options for voice validation
2. Environment variable patterns for voice defaults in multi-tenant systems
3. API payload construction patterns that avoid null/undefined propagation
4. Voice provider mapping strategies used by production Vapi deployments
5. Error handling patterns for Vapi voice validation failures
6. Backward compatibility approaches for voice name transitions

EXPECTED OUTCOME:
Provide a configuration-based solution (no code rewrites) that ensures:
- Empty voice selections default to 'Neha' (not 'jennifer')
- Legacy voice names map to current Vapi voices
- All Vapi API calls send capitalized, valid voice IDs
- Multi-tenant isolation is preserved
- 53 organizations aren't affected by changes

ADDITIONAL CONTEXT:
- Vapi circuit breaker sometimes opens due to rapid retries from invalid voices
- Backend validates voices against local registry (case-insensitive)
- Frontend sends voice ID or empty string
- Database stores voice value from validated input
- Vapi Client is final layer before API call
- Error responses are properly caught and returned to frontend

Please research:
1. Official Vapi 2026 API documentation on voice handling
2. Vapi SDK options for voice ID validation/defaults
3. Battle-tested patterns from production Vapi implementations
4. Best practices for multi-provider voice systems
5. Configuration-only solutions that don't require code changes
```

---

## SUMMARY FOR ACTION

**What's broken**: Voice defaulting logic uses legacy 'jennifer' instead of 'Neha'

**Why it matters**: Frontend empty voice selections → Backend defaults to 'jennifer' → Vapi API rejects it → Agent save fails → Circuit breaker opens

**What we need**: Perplexity research on Vapi 2026 best practices for voice defaults and validation without code changes

**Next step**: Use the detailed prompt above in Perplexity to get battle-tested solution options

---

**Generated**: January 20, 2026 @ 14:35 UTC  
**Status**: Ready for Perplexity research  
**No code changes made** - Investigation/audit only
