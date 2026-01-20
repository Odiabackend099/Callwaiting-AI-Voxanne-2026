# URGENT: Current Vapi 2026 Supported Voices List

## Problem Statement
We're getting this Vapi API 400 error when users try to save agents:

```
The Neha voice is part of a legacy voice set that is being phased out, 
and new assistants cannot be created with this voice.
```

**Our current VOICE_REGISTRY includes**: Neha, Paige, Rohan, Hana, Harry, Elliot, Lily, Cole, Savannah, Spencer, Kylie, Leah, Tara, Jess, Leo, Dan, Mia, Zac, Zoe

**But these are apparently LEGACY as of January 2026**.

## Query for Perplexity

```
I need the DEFINITIVE list of currently supported Vapi voices as of January 2026.

CONTEXT:
- Platform: VoxAnne AI - Medical clinic voice platform
- Vapi API version: Current (Jan 2026)
- Issue: Users selecting voices from our list get "voice is part of a legacy voice set" 400 error
- Current voices in our system: Neha, Paige, Rohan, Hana, Harry, Elliot, Lily, Cole, Savannah, Spencer, Kylie, Leah, Tara, Jess, Leo, Dan, Mia, Zac, Zoe
- All these are being rejected as legacy

REQUIRED INFORMATION:
1. What is the CURRENT list of supported Vapi voice IDs (January 2026)?
2. Which voices have been deprecated/phased out?
3. What is the official API endpoint or documentation showing current supported voices?
4. Are there new voices added to replace the legacy set?
5. What is the recommended migration path for systems using legacy voices?

SPECIFIC REQUEST:
Please provide:
- Complete list of currently supported voice IDs with exact capitalization
- Any official Vapi documentation URL showing this list
- Confirmation of which voices in our list are deprecated
- Recommended replacement voices if applicable

This is blocking production - we need the authoritative current list from Vapi's 2026 API.
```

## Action Items

1. ✅ Copy the query above into Perplexity
2. Get the current supported voices list
3. Update VOICE_REGISTRY with ONLY currently supported voices
4. Remove any hardcoded defaults
5. Test agent save with new voice list

---

**Status**: CRITICAL - Production blocking  
**Cause Confirmed**: Legacy voice set in VOICE_REGISTRY  
**Solution Path**: Update registry with current Vapi 2026 voices
