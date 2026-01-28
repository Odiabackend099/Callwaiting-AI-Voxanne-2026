# Voice System Documentation

## Overview

Voxanne AI supports 100+ voices across 7 providers:

- **Vapi Native:** 3 voices (Rohan, Elliot, Savannah)
- **ElevenLabs:** 100+ premium multilingual voices
- **OpenAI TTS:** 6 neural voices (alloy, echo, fable, onyx, nova, shimmer)
- **Google Cloud TTS:** 40+ voices (WaveNet, Neural2)
- **Azure Speech:** 50+ neural voices
- **PlayHT:** Custom voice library
- **Rime AI:** Accent-controlled voices

All voices are managed through a centralized registry that serves as the single source of truth for voice metadata, provider configuration, and legacy voice compatibility.

---

## Architecture

### Single Source of Truth (SSOT)

The voice system uses a TypeScript registry pattern to centralize all voice definitions:

**Location:** `/backend/src/config/voice-registry.ts` (700+ lines)

**Key Concept:** Voice metadata is stored in TypeScript (not the database) for:
- **Type Safety:** Compile-time validation of voice/provider combinations
- **Version Control:** All changes tracked in Git history
- **Fast Loading:** No database queries needed for voice lookups
- **Easy Maintenance:** Simple array modification to add new voices

### Voice Metadata Structure

```typescript
export interface VoiceMetadata {
  id: string;                    // Voice ID for API calls (e.g., 'Rohan', 'alloy')
  name: string;                  // Human-readable name (e.g., 'Rohan (Professional)')
  provider: 'vapi' | 'elevenlabs' | 'openai' | 'google' | 'azure' | 'playht' | 'rime';
  gender: 'male' | 'female' | 'neutral';
  language: string;              // Primary language (e.g., 'en-US', 'es-ES')
  characteristics: string[];     // Descriptors (e.g., ['professional', 'warm'])
  accent?: string;               // Optional accent (e.g., 'Southern American')
  use_cases: string[];          // Best for (e.g., ['customer_service', 'healthcare'])
  latency: 'low' | 'medium';    // Response time category
  quality: 'standard' | 'premium' | 'neural';
  status: 'active' | 'deprecated';
  multilingual?: boolean;        // Supports multiple languages
  requires_api_key?: boolean;    // Needs third-party API key configuration
  deprecated_aliases?: string[]; // Legacy names that map to this voice
}
```

### Voice Registry Organization

The registry is organized into provider-specific arrays:

```typescript
export const VAPI_NATIVE_VOICES: VoiceMetadata[] = [...];
export const ELEVENLABS_VOICES: VoiceMetadata[] = [...];
export const OPENAI_VOICES: VoiceMetadata[] = [...];
export const GOOGLE_VOICES: VoiceMetadata[] = [...];
export const AZURE_VOICES: VoiceMetadata[] = [...];
export const PLAYHT_VOICES: VoiceMetadata[] = [...];
export const RIME_AI_VOICES: VoiceMetadata[] = [...];
export const DEPRECATED_VOICES: VoiceMetadata[] = [...];

export const VOICE_REGISTRY: VoiceMetadata[] = [
  ...VAPI_NATIVE_VOICES,
  ...ELEVENLABS_VOICES,
  ...OPENAI_VOICES,
  ...GOOGLE_VOICES,
  ...AZURE_VOICES,
  ...PLAYHT_VOICES,
  ...RIME_AI_VOICES,
  ...DEPRECATED_VOICES,
];
```

### Database Schema

The agents table has been enhanced with voice provider tracking:

```sql
-- agents table columns related to voice
voice TEXT NOT NULL DEFAULT 'Rohan';
voice_provider TEXT CHECK (voice_provider IN ('vapi', 'elevenlabs', 'openai', 'google', 'azure', 'playht', 'rime'));

-- Index for performance
CREATE INDEX idx_agents_voice_provider ON agents(org_id, voice_provider, voice);
```

**Why voice_provider in database?**
- Enables distinguishing between voices with the same name from different providers
- Allows querying agents by provider (e.g., "Which agents use ElevenLabs?")
- Supports future provider-specific features (e.g., filtering to providers with API keys configured)

---

## Helper Functions

### Get All Active Voices

```typescript
import { getActiveVoices } from '@/backend/src/config/voice-registry';

// Returns all active voices (excludes deprecated)
const voices = getActiveVoices();
// Returns: VoiceMetadata[] with ~50+ voices
```

### Filter by Provider

```typescript
import { getVoicesByProvider } from '@/backend/src/config/voice-registry';

// Get Vapi native voices
const vapiVoices = getVoicesByProvider('vapi');
// Returns: [Rohan, Elliot, Savannah]

// Get OpenAI voices
const openaiVoices = getVoicesByProvider('openai');
// Returns: [alloy, echo, fable, onyx, nova, shimmer]
```

### Get Voice by ID (Case-Insensitive)

```typescript
import { getVoiceById } from '@/backend/src/config/voice-registry';

// Exact match
const voice = getVoiceById('Rohan');
// Returns: { id: 'Rohan', name: 'Rohan (Professional)', provider: 'vapi', ... }

// Case-insensitive
const voice = getVoiceById('rohan');
// Returns: Same voice metadata

// By deprecated alias
const voice = getVoiceById('neha');
// Returns: Metadata for Savannah (neha's modern equivalent)
```

### Normalize Legacy Voices

```typescript
import { normalizeLegacyVoice } from '@/backend/src/config/voice-registry';

// Female legacy voices map to Savannah
const result = normalizeLegacyVoice('paige');
// Returns: { voice: 'Savannah', provider: 'vapi' }

// Male legacy voices map to Rohan
const result = normalizeLegacyVoice('cole');
// Returns: { voice: 'Rohan', provider: 'vapi' }

// Active voices pass through
const result = normalizeLegacyVoice('alloy');
// Returns: { voice: 'alloy', provider: 'openai' }

// Unknown voices default to Rohan
const result = normalizeLegacyVoice('unknown-voice');
// Returns: { voice: 'Rohan', provider: 'vapi' }
```

### Validate Voice & Provider

```typescript
import { isValidVoice } from '@/backend/src/config/voice-registry';

// Valid voice
isValidVoice('Rohan', 'vapi');
// Returns: true

// Invalid voice
isValidVoice('invalid-voice', 'vapi');
// Returns: false

// Correct voice, wrong provider
isValidVoice('Rohan', 'openai');
// Returns: false

// Deprecated voice
isValidVoice('neha', 'vapi');
// Returns: false (neha is deprecated, should use Savannah)
```

### Filter Voices with Multiple Criteria

```typescript
import { filterVoices } from '@/backend/src/config/voice-registry';

// By provider
const voices = filterVoices({ provider: 'openai' });
// Returns: 6 OpenAI voices

// By gender
const voices = filterVoices({ gender: 'female' });
// Returns: All female voices across all providers

// By use case
const voices = filterVoices({ use_case: 'customer_service' });
// Returns: Voices suitable for customer service

// By search term
const voices = filterVoices({ search: 'professional' });
// Returns: Voices with "professional" in name or characteristics

// Combined filters
const voices = filterVoices({
  provider: 'vapi',
  gender: 'male',
  search: 'calm'
});
// Returns: Male Vapi voices with "calm" in metadata
```

---

## Adding New Voices

### Step 1: Open Voice Registry

```bash
cd backend/src/config/voice-registry.ts
```

### Step 2: Add Voice to Appropriate Provider Array

```typescript
// Example: Add new ElevenLabs voice
export const ELEVENLABS_VOICES: VoiceMetadata[] = [
  // ... existing voices
  {
    id: 'new-voice-id',  // ID from ElevenLabs API documentation
    name: 'New Voice (Descriptor)',
    provider: 'elevenlabs',
    gender: 'female',  // 'male', 'female', or 'neutral'
    language: 'en-US',
    characteristics: ['professional', 'warm', 'engaging'],
    accent: 'Optional accent description',
    use_cases: ['customer_service', 'sales'],
    latency: 'low',  // 'low' or 'medium'
    quality: 'premium',  // 'standard', 'premium', or 'neural'
    status: 'active',
    requires_api_key: true,  // true if needs third-party API key
    multilingual: false,  // true if supports multiple languages
  },
];
```

### Step 3: Deploy

The new voice automatically appears in:
- ✅ Voice selector UI (no frontend changes needed)
- ✅ API `/api/assistants/voices/available` endpoint
- ✅ All filtering and search operations
- ✅ Type validation via TypeScript

**No database changes needed. No code deployment required. Just commit to Git.**

### Step 4: Verify

```bash
# Fetch voices via API
curl https://api.voxanne.ai/api/assistants/voices/available?provider=elevenlabs

# Should include your new voice in the response
```

---

## Voice Providers Configuration

### Vapi Native (Always Available)

Vapi Native voices are included in the standard Vapi API and require no additional configuration.

**Voices:** Rohan, Elliot, Savannah

**No setup required. Works out of the box.**

### ElevenLabs (Premium)

ElevenLabs provides 100+ premium multilingual voices. Requires API key.

**Setup:**
1. Create account at https://elevenlabs.io
2. Get API key from Settings → API Keys
3. Add to org credentials (feature coming soon):
   ```
   ELEVENLABS_API_KEY=your-key-here
   ```

**Note:** Currently, ElevenLabs voices appear in the selector but require org-level API key configuration (to be implemented).

### OpenAI TTS (Neural Quality)

OpenAI TTS provides 6 high-quality neural voices.

**Setup:**
1. Get API key from https://platform.openai.com/account/api-keys
2. Add to org credentials (feature coming soon)

**Note:** OpenAI voices appear in the selector but require org-level API key configuration (to be implemented).

### Google Cloud TTS

Google Cloud offers 40+ multilingual voices with WaveNet quality.

**Setup:**
1. Create GCP project
2. Enable Cloud Text-to-Speech API
3. Create service account and download JSON key
4. Add to org credentials (feature coming soon)

### Azure Speech

Microsoft Azure provides 50+ neural voices with regional variants.

**Setup:**
1. Create Azure Speech resource
2. Get API key from Azure Portal
3. Add to org credentials (feature coming soon)

### PlayHT & Rime AI

Similar setup to other third-party providers. Documentation available upon request.

---

## Legacy Voice Migration

### What Happened

Agents created before 2026 used deprecated voice names that no longer work in the current VAPI API. These include:

**Female Legacy Voices:**
- paige, neha, hana, lily, kylie, leah, tara, jess, mia, zoe → **Savannah**

**Male Legacy Voices:**
- harry, cole, spencer, leo, dan, zac → **Rohan**

### Auto-Migration

All legacy voices are automatically migrated through two mechanisms:

**1. Database Migration (One-time)**

```sql
-- Migration: 20260129_voice_provider_column.sql
-- Runs once when deployed
UPDATE agents SET
  voice = CASE
    WHEN LOWER(voice) IN ('neha', 'paige', 'hana', 'lily', 'kylie', ...) THEN 'Savannah'
    WHEN LOWER(voice) IN ('harry', 'cole', 'spencer', 'leo', 'dan', 'zac') THEN 'Rohan'
    ELSE voice
  END,
  voice_provider = 'vapi'
WHERE voice_provider IS NULL AND voice IS NOT NULL;
```

**2. Runtime Normalization (Defensive)**

If a legacy voice somehow bypasses the database migration, the `normalizeLegacyVoice()` function catches it at runtime:

```typescript
const normalized = normalizeLegacyVoice('paige');
// Returns: { voice: 'Savannah', provider: 'vapi' }
```

### Transparent to Users

Users don't need to do anything. Existing agents automatically use modern voices:
- Click "Update Agent" → Agent still works with migrated voice
- No errors, no manual reconfiguration needed

### Verification

To verify legacy voices in your database:

```sql
-- Check agents with legacy voices (before migration)
SELECT COUNT(*) FROM agents
WHERE voice IN ('paige', 'neha', 'harry', 'cole', 'spencer', 'leo');

-- Should return 0 after migration runs
```

---

## API Reference

### Get Available Voices

**Endpoint:** `GET /api/assistants/voices/available`

**Query Parameters:**
- `provider` (optional): Filter by provider (`vapi`, `elevenlabs`, `openai`, `google`, `azure`, `playht`, `rime`)
- `gender` (optional): Filter by gender (`male`, `female`, `neutral`)
- `language` (optional): Filter by language (`en-US`, `es-ES`, etc.)
- `use_case` (optional): Filter by use case (`customer_service`, `healthcare`, `sales`, `narration`, etc.)
- `search` (optional): Search by name, characteristics, or accent

**Example Request:**

```bash
# Get all OpenAI voices
curl "https://api.voxanne.ai/api/assistants/voices/available?provider=openai"

# Get female customer service voices
curl "https://api.voxanne.ai/api/assistants/voices/available?gender=female&use_case=customer_service"

# Search for professional voices
curl "https://api.voxanne.ai/api/assistants/voices/available?search=professional"
```

**Response:**

```json
{
  "voices": [
    {
      "id": "Rohan",
      "name": "Rohan (Professional)",
      "provider": "vapi",
      "gender": "male",
      "language": "en-US",
      "characteristics": "bright, optimistic, cheerful, energetic",
      "accent": "Indian American",
      "bestFor": "customer_service, sales, healthcare",
      "latency": "low",
      "quality": "standard",
      "isDefault": true,
      "requiresApiKey": false
    },
    // ... more voices
  ]
}
```

### Update Agent Voice

**Endpoint:** `POST /api/founder-console/agent/behavior`

**Request Body:**

```json
{
  "agentRole": "inbound",
  "inbound": {
    "voice": "Rohan",  // Voice ID
    "voiceProvider": "vapi",  // Voice provider
    // ... other config
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Agent behavior updated successfully",
  "agent": {
    "id": "agent-123",
    "voice": "Rohan",
    "voice_provider": "vapi",
    // ... other fields
  }
}
```

---

## Troubleshooting

### Issue: Voice Not Appearing in Selector

**Check:**
1. Is the voice status set to `'active'` in the registry? (Not `'deprecated'`)
2. Is the provider filter excluding it? (Try "All Providers")
3. Is there a search filter hiding it?

**Solution:**
```typescript
// Open: /backend/src/config/voice-registry.ts
// Verify: status: 'active' (not 'deprecated')
// Then: Redeploy frontend (no backend changes needed)
```

### Issue: "Unknown Voice" Error When Creating Agent

**Problem:** Voice no longer exists or provider mismatch

**Solution:**
1. Check voice ID is spelled correctly (case-sensitive)
2. Verify provider matches voice availability
3. For legacy voices (paige, neha, harry), ensure database migration ran

**Code:**
```typescript
// Before saving, validate:
import { isValidVoice } from '@/backend/src/config/voice-registry';

if (!isValidVoice(voiceId, provider)) {
  throw new Error(`Invalid voice: ${voiceId} with provider: ${provider}`);
}
```

### Issue: VAPI API Error "Unknown Voice"

**Problem:** Voice ID sent to VAPI doesn't exist

**Check:**
1. Voice metadata id matches VAPI's expected ID (case-sensitive)
2. Provider configuration is correct
3. For new providers, ensure API key is configured

**Debug:**
```bash
# Verify voice exists in registry
curl "https://api.voxanne.ai/api/assistants/voices/available" | grep "voice-id"

# Should return voice metadata if valid
```

### Issue: Legacy Voice Still Showing

**Problem:** Agent with old voice name (paige, harry, etc.)

**Solution:**
1. Database migration may not have run yet
2. Force normalization by editing and re-saving the agent
3. Or trigger database cleanup:
   ```sql
   SELECT book_appointment_with_lock(...);  -- Not the actual command
   ```

**Code:**
```typescript
// For agents with legacy voices, apply normalization:
import { normalizeLegacyVoice } from '@/backend/src/config/voice-registry';

const normalized = normalizeLegacyVoice(agent.voice);
agent.voice = normalized.voice;
agent.voice_provider = normalized.provider;
await agent.save();
```

### Issue: Premium Voice Requires API Key

**Problem:** ElevenLabs/OpenAI/Google voice selected but org doesn't have API key

**Solution:**
1. User needs to add API key in organization settings (feature coming soon)
2. For now, use Vapi Native voices (always available)
3. Contact support to enable premium voice provider

**Code:**
```typescript
if (voice.requires_api_key) {
  const hasApiKey = await checkOrgHasProviderApiKey(orgId, voice.provider);
  if (!hasApiKey) {
    throw new Error(`Organization needs ${voice.provider} API key to use this voice`);
  }
}
```

---

## Frequently Asked Questions

**Q: Can I customize voice characteristics?**
A: Voice characteristics are fixed per voice (determined by provider). To change tone, modify the system prompt instead of the voice.

**Q: What happens if Vapi removes a voice?**
A: Add to DEPRECATED_VOICES array, update normalization logic. Existing agents auto-migrate to similar voice.

**Q: Can I add a custom voice?**
A: Yes! Add to VOICE_REGISTRY with custom metadata. Works for ElevenLabs custom voices and other providers that support cloning.

**Q: How many voices do we support?**
A: 100+ actively supported. New voices added as providers release them.

**Q: Do users see all 100+ voices?**
A: Yes, but VoiceSelector has both simple mode (dropdown) and advanced mode (search/filter) to manage large lists.

**Q: What if two providers have a voice with the same name?**
A: Impossible - voice ID is unique per provider. The `provider` field distinguishes them.

---

## Related Documentation

- [Agent Configuration Guide](../docs/AGENT_CONFIG.md)
- [API Documentation](../docs/API.md)
- [Backend Architecture](../CONTRIBUTING.md)
- [Voice Registry Source Code](../backend/src/config/voice-registry.ts)
