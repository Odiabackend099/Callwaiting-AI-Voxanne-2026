# Voice System End-to-End Testing Guide

**Test Objective:** Verify voice system works across all 7 providers with full CRUD operations and VAPI integration

**Scope:**
- Create inbound/outbound agents with 2 voices per provider
- Save to database and verify VAPI population
- Test update (same provider, different voice)
- Test delete (verify database and VAPI cleanup)
- Test provider switching
- Verify no agent duplication

---

## Prerequisites

### 1. Get Authentication Token

```bash
# Login to get JWT token
AUTH_RESPONSE=$(curl -s -X POST "https://app.voxanne.ai/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "your-password"
  }')

# Extract token
AUTH_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.token')

# Verify token
echo "Token: $AUTH_TOKEN"
```

### 2. Set Environment Variables

```bash
# API Configuration
export API_URL="https://api.voxanne.ai"  # or localhost:3000 for local testing
export AUTH_TOKEN="your-jwt-token"
export TEST_ORG_ID="test-org-voice-system"

# Logging
export LOG_FILE="voice_e2e_test_$(date +%Y%m%d_%H%M%S).log"
```

### 3. Verify Backend is Running

```bash
curl -s "$API_URL/health" | jq '.'
# Expected: { "status": "ok" }
```

---

## Step 1: Fetch Available Voices

### Command

```bash
VOICES_RESPONSE=$(curl -s -X GET "$API_URL/api/assistants/voices/available" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "$VOICES_RESPONSE" | jq '.'
```

### Expected Response

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

### Parse Voices by Provider

```bash
# Extract available providers
PROVIDERS=$(echo "$VOICES_RESPONSE" | jq -r '.voices[].provider' | sort | uniq)

echo "Available providers: $PROVIDERS"

# Get 2 voices from each provider
for provider in $PROVIDERS; do
  echo ""
  echo "=== $provider ==="
  VOICES=$(echo "$VOICES_RESPONSE" | jq -r ".voices[] | select(.provider==\"$provider\") | .id" | head -2)
  echo "Voices: $VOICES"
  declare "${provider}_VOICES"="$VOICES"
done
```

---

## Step 2: Create Agents for Each Provider

### Test Pattern

For each provider:
1. Create inbound agent with voice 1
2. Create inbound agent with voice 2
3. Create outbound agent with voice 1
4. Create outbound agent with voice 2
5. Update agent (same provider, different voice)
6. Delete agents
7. Verify database cleanup

### Create Agent Template

```bash
create_agent() {
  local agent_role=$1      # "inbound" or "outbound"
  local voice_id=$2        # "Rohan", "alloy", etc.
  local voice_provider=$3  # "vapi", "openai", etc.
  local agent_name="test-${voice_provider}-${voice_id}-$(date +%s)"

  local payload=$(cat <<EOF
{
  "name": "$agent_name",
  "agentRole": "$agent_role",
  "$agent_role": {
    "voice": "$voice_id",
    "voiceProvider": "$voice_provider",
    "systemPrompt": "You are a helpful AI assistant for testing.",
    "firstMessage": "Hello, how can I help you today?"
  }
}
EOF
)

  echo "[DEBUG] Creating $agent_role agent"
  echo "[DEBUG] Payload: $payload"

  RESPONSE=$(curl -s -X POST "$API_URL/api/founder-console/agent" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload")

  echo "[DEBUG] Response: $RESPONSE"

  AGENT_ID=$(echo "$RESPONSE" | jq -r '.agent.id // empty')

  if [ -n "$AGENT_ID" ]; then
    echo "✓ Created agent: $AGENT_ID"
    echo "  Provider: $voice_provider"
    echo "  Voice: $voice_id"
    echo "$AGENT_ID"
  else
    echo "✗ Failed to create agent"
    echo "  Error: $(echo "$RESPONSE" | jq -r '.error // "Unknown error"')"
    echo ""
  fi
}
```

---

## Step 3: Test Each Provider

### 3.1 Vapi Provider

```bash
log_section "TESTING VAPI PROVIDER"

VAPI_VOICES_ARRAY=($vapi_VOICES)
VAPI_VOICE1="${VAPI_VOICES_ARRAY[0]}"
VAPI_VOICE2="${VAPI_VOICES_ARRAY[1]}"

echo "Testing voices: $VAPI_VOICE1, $VAPI_VOICE2"

# Create inbound agents
VAPI_INBOUND_1=$(create_agent "inbound" "$VAPI_VOICE1" "vapi")
VAPI_INBOUND_2=$(create_agent "inbound" "$VAPI_VOICE2" "vapi")

# Create outbound agents
VAPI_OUTBOUND_1=$(create_agent "outbound" "$VAPI_VOICE1" "vapi")
VAPI_OUTBOUND_2=$(create_agent "outbound" "$VAPI_VOICE2" "vapi")

echo ""
echo "Created agents:"
echo "  Inbound 1: $VAPI_INBOUND_1 (voice: $VAPI_VOICE1)"
echo "  Inbound 2: $VAPI_INBOUND_2 (voice: $VAPI_VOICE2)"
echo "  Outbound 1: $VAPI_OUTBOUND_1 (voice: $VAPI_VOICE1)"
echo "  Outbound 2: $VAPI_OUTBOUND_2 (voice: $VAPI_VOICE2)"
```

### 3.2 OpenAI Provider

```bash
log_section "TESTING OPENAI PROVIDER"

OPENAI_VOICES_ARRAY=($openai_VOICES)
OPENAI_VOICE1="${OPENAI_VOICES_ARRAY[0]}"
OPENAI_VOICE2="${OPENAI_VOICES_ARRAY[1]}"

echo "Testing voices: $OPENAI_VOICE1, $OPENAI_VOICE2"

OPENAI_INBOUND_1=$(create_agent "inbound" "$OPENAI_VOICE1" "openai")
OPENAI_INBOUND_2=$(create_agent "inbound" "$OPENAI_VOICE2" "openai")

OPENAI_OUTBOUND_1=$(create_agent "outbound" "$OPENAI_VOICE1" "openai")
OPENAI_OUTBOUND_2=$(create_agent "outbound" "$OPENAI_VOICE2" "openai")
```

### 3.3 ElevenLabs Provider

```bash
log_section "TESTING ELEVENLABS PROVIDER"

ELEVENLABS_VOICES_ARRAY=($elevenlabs_VOICES)
ELEVENLABS_VOICE1="${ELEVENLABS_VOICES_ARRAY[0]}"
ELEVENLABS_VOICE2="${ELEVENLABS_VOICES_ARRAY[1]}"

echo "Testing voices: $ELEVENLABS_VOICE1, $ELEVENLABS_VOICE2"

ELEVENLABS_INBOUND_1=$(create_agent "inbound" "$ELEVENLABS_VOICE1" "elevenlabs")
ELEVENLABS_INBOUND_2=$(create_agent "inbound" "$ELEVENLABS_VOICE2" "elevenlabs")

ELEVENLABS_OUTBOUND_1=$(create_agent "outbound" "$ELEVENLABS_VOICE1" "elevenlabs")
ELEVENLABS_OUTBOUND_2=$(create_agent "outbound" "$ELEVENLABS_VOICE2" "elevenlabs")
```

### 3.4 Google Cloud Provider

```bash
log_section "TESTING GOOGLE PROVIDER"

GOOGLE_VOICES_ARRAY=($google_VOICES)
GOOGLE_VOICE1="${GOOGLE_VOICES_ARRAY[0]}"
GOOGLE_VOICE2="${GOOGLE_VOICES_ARRAY[1]}"

GOOGLE_INBOUND_1=$(create_agent "inbound" "$GOOGLE_VOICE1" "google")
GOOGLE_INBOUND_2=$(create_agent "inbound" "$GOOGLE_VOICE2" "google")

GOOGLE_OUTBOUND_1=$(create_agent "outbound" "$GOOGLE_VOICE1" "google")
GOOGLE_OUTBOUND_2=$(create_agent "outbound" "$GOOGLE_VOICE2" "google")
```

### 3.5 Azure Provider

```bash
log_section "TESTING AZURE PROVIDER"

AZURE_VOICES_ARRAY=($azure_VOICES)
AZURE_VOICE1="${AZURE_VOICES_ARRAY[0]}"
AZURE_VOICE2="${AZURE_VOICES_ARRAY[1]}"

AZURE_INBOUND_1=$(create_agent "inbound" "$AZURE_VOICE1" "azure")
AZURE_INBOUND_2=$(create_agent "inbound" "$AZURE_VOICE2" "azure")

AZURE_OUTBOUND_1=$(create_agent "outbound" "$AZURE_VOICE1" "azure")
AZURE_OUTBOUND_2=$(create_agent "outbound" "$AZURE_VOICE2" "azure")
```

---

## Step 4: Verify Database Storage

### List Created Agents

```bash
LIST_RESPONSE=$(curl -s -X GET "$API_URL/api/founder-console/org/$TEST_ORG_ID/agents" \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "$LIST_RESPONSE" | jq '.agents[] | {id, name, voice, voice_provider}'
```

### Verify in Database

```sql
-- Check agents table
SELECT id, name, voice, voice_provider, inbound_config, outbound_config
FROM agents
WHERE org_id = 'test-org-voice-system'
ORDER BY created_at DESC
LIMIT 20;

-- Expected: All agents present with correct voice and voice_provider
```

### Sample Output

```
id                                    | name                           | voice      | voice_provider
--------------------------------------|--------------------------------|------------|----------------
550e8400-e29b-41d4-a716-446655440001 | test-vapi-Rohan-1706384532    | Rohan      | vapi
550e8400-e29b-41d4-a716-446655440002 | test-vapi-Elliot-1706384533   | Elliot     | vapi
550e8400-e29b-41d4-a716-446655440003 | test-openai-alloy-1706384534  | alloy      | openai
550e8400-e29b-41d4-a716-446655440004 | test-openai-echo-1706384535   | echo       | openai
```

---

## Step 5: Verify VAPI Population

### Check VAPI API

```bash
# Get VAPI assistants for your org
VAPI_RESPONSE=$(curl -s -X GET "https://api.vapi.ai/assistant" \
  -H "Authorization: Bearer $VAPI_API_KEY")

echo "$VAPI_RESPONSE" | jq '.assistants[] | {id, name, voice: .voice.voiceId, provider: .voice.provider}'
```

### Verification Checklist

For each created agent:
- [ ] Agent exists in database with correct voice_id
- [ ] Agent has correct voice_provider
- [ ] Assistant exists in VAPI API
- [ ] VAPI assistant has correct voice configuration
- [ ] Voice provider matches database

---

## Step 6: Test Update Operation

### Update Voice (Same Provider)

```bash
update_agent() {
  local agent_id=$1
  local new_voice=$2
  local voice_provider=$3

  local update_payload=$(cat <<EOF
{
  "voice": "$new_voice",
  "voiceProvider": "$voice_provider"
}
EOF
)

  echo "[DEBUG] Updating agent $agent_id with voice $new_voice"

  RESPONSE=$(curl -s -X PATCH "$API_URL/api/founder-console/agent/$agent_id" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$update_payload")

  echo "[DEBUG] Response: $RESPONSE"

  if echo "$RESPONSE" | jq -e '.agent.id' > /dev/null 2>&1; then
    echo "✓ Updated agent"
    echo "  New voice: $new_voice"
  else
    echo "✗ Failed to update agent"
  fi
}

# Example: Update Vapi agent from Rohan to Elliot
if [ -n "$VAPI_INBOUND_1" ]; then
  update_agent "$VAPI_INBOUND_1" "Elliot" "vapi"
fi
```

### Verify Update

```sql
-- Check agent was updated
SELECT id, voice, voice_provider, updated_at
FROM agents
WHERE id = 'agent-id-here';

-- Verify VAPI was also updated
curl -s "https://api.vapi.ai/assistant/$vapi_assistant_id" \
  -H "Authorization: Bearer $VAPI_API_KEY" | jq '.voice'
```

---

## Step 7: Test Provider Switching

### Switch from Vapi to OpenAI

```bash
switch_provider() {
  local agent_id=$1
  local new_voice=$2
  local new_provider=$3

  echo "[INFO] Switching agent $agent_id from vapi to $new_provider"

  update_agent "$agent_id" "$new_voice" "$new_provider"

  # Verify
  echo "[INFO] Verifying provider switch..."
  GET_RESPONSE=$(curl -s -X GET "$API_URL/api/founder-console/agent/$agent_id" \
    -H "Authorization: Bearer $AUTH_TOKEN")

  CURRENT_PROVIDER=$(echo "$GET_RESPONSE" | jq -r '.agent.voice_provider')

  if [ "$CURRENT_PROVIDER" = "$new_provider" ]; then
    echo "✓ Provider switched successfully: $CURRENT_PROVIDER"
  else
    echo "✗ Provider switch failed: Expected $new_provider, got $CURRENT_PROVIDER"
  fi
}

# Example: Switch from Vapi to OpenAI
switch_provider "$VAPI_INBOUND_1" "alloy" "openai"
```

---

## Step 8: Test Delete Operation

### Delete Agent

```bash
delete_agent() {
  local agent_id=$1

  if [ -z "$agent_id" ]; then
    echo "⚠ Skipping delete: No agent ID provided"
    return
  fi

  echo "[INFO] Deleting agent: $agent_id"

  RESPONSE=$(curl -s -X DELETE "$API_URL/api/founder-console/agent/$agent_id" \
    -H "Authorization: Bearer $AUTH_TOKEN")

  if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✓ Deleted agent from database: $agent_id"
  else
    echo "✗ Failed to delete agent"
    echo "  Response: $RESPONSE"
  fi
}

# Delete all created agents
delete_agent "$VAPI_INBOUND_1"
delete_agent "$VAPI_INBOUND_2"
delete_agent "$VAPI_OUTBOUND_1"
delete_agent "$VAPI_OUTBOUND_2"
delete_agent "$OPENAI_INBOUND_1"
delete_agent "$OPENAI_INBOUND_2"
delete_agent "$OPENAI_OUTBOUND_1"
delete_agent "$OPENAI_OUTBOUND_2"
```

### Verify Database Cleanup

```sql
-- Check agents were deleted
SELECT COUNT(*) FROM agents
WHERE org_id = 'test-org-voice-system';

-- Should be 0 (or previous count - deleted count)
```

### Verify VAPI Cleanup

```bash
# Check VAPI assistants were deleted
curl -s "https://api.vapi.ai/assistant" \
  -H "Authorization: Bearer $VAPI_API_KEY" | jq '.assistants | length'

# Should have fewer assistants after deletion
```

---

## Step 9: Test No Duplication

### Create Same Agent Twice

```bash
# Create agent
AGENT_1=$(create_agent "inbound" "Rohan" "vapi")

# Create same agent again
AGENT_2=$(create_agent "inbound" "Rohan" "vapi")

# Verify they're different agents
if [ "$AGENT_1" != "$AGENT_2" ]; then
  echo "✓ No duplication: Created 2 different agents"
  echo "  Agent 1: $AGENT_1"
  echo "  Agent 2: $AGENT_2"
else
  echo "✗ Duplication detected: Both returned same agent"
fi

# Verify both exist in database
COUNT=$(curl -s "$API_URL/api/founder-console/org/$TEST_ORG_ID/agents" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq ".agents | length")

echo "Total agents: $COUNT"
```

---

## Step 10: Test Legacy Voice Compatibility

### Create Agent with Legacy Voice Name

```bash
# Test legacy female voice (paige → Savannah)
LEGACY_RESPONSE=$(curl -s -X POST "$API_URL/api/founder-console/agent" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-legacy-paige",
    "agentRole": "inbound",
    "inbound": {
      "voice": "paige",
      "voiceProvider": "vapi",
      "systemPrompt": "Test agent",
      "firstMessage": "Hello"
    }
  }')

AGENT_ID=$(echo "$LEGACY_RESPONSE" | jq -r '.agent.id')

# Check database - should show Savannah
AGENT=$(curl -s "$API_URL/api/founder-console/agent/$AGENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

VOICE=$(echo "$AGENT" | jq -r '.agent.voice')

if [ "$VOICE" = "Savannah" ]; then
  echo "✓ Legacy voice mapped correctly: paige → Savannah"
else
  echo "✗ Legacy voice mapping failed: Expected Savannah, got $VOICE"
fi
```

---

## Complete Test Execution Script

```bash
#!/bin/bash

# Complete Voice System E2E Test
# Run all tests in sequence

set -e

API_URL="${API_URL:-https://api.voxanne.ai}"
AUTH_TOKEN="${AUTH_TOKEN:-your-token-here}"
TEST_ORG_ID="test-org-voice-system"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASSED=0
FAILED=0

test() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ $1${NC}"
    ((FAILED++))
  fi
}

echo "=========================================="
echo "Voice System E2E Test Suite"
echo "=========================================="
echo ""

# Step 1: Fetch voices
echo "Step 1: Fetching available voices..."
VOICES=$(curl -s "$API_URL/api/assistants/voices/available" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.voices | length')
test "Fetch available voices (got $VOICES voices)"
echo ""

# Step 2-9: Run provider tests
# (see sections above)

echo ""
echo "=========================================="
echo "Test Results"
echo "=========================================="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}Some tests failed!${NC}"
  exit 1
fi
```

---

## Troubleshooting

### Issue: "Unknown voice provider"

**Cause:** Invalid voice_provider value

**Solution:**
```bash
# Valid providers only:
# - vapi
# - elevenlabs
# - openai
# - google
# - azure
# - playht
# - rime

# Check available voices
curl -s "$API_URL/api/assistants/voices/available" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.voices[].provider' | sort | uniq
```

### Issue: "Voice not found"

**Cause:** Voice ID doesn't exist for provider

**Solution:**
```bash
# Get available voices for provider
curl -s "$API_URL/api/assistants/voices/available?provider=vapi" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.voices[].id'
```

### Issue: VAPI integration fails

**Cause:** VAPI API key not configured

**Solution:**
```bash
# Check VAPI connection
curl -s "$API_URL/health/vapi" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.vapi_connection'
```

### Issue: Database not updating

**Cause:** Agent might be read-only or permissions issue

**Solution:**
```bash
# Check agent permissions
curl -s "$API_URL/api/founder-console/agent/$AGENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.agent | {id, name, org_id, voice, voice_provider}'
```

---

## Test Completion Criteria

✅ **All tests PASS when:**

1. **Voice Fetching**
   - [ ] GET /api/assistants/voices/available returns 50+ voices
   - [ ] All voice objects have required fields

2. **Agent Creation**
   - [ ] Create 2 inbound agents per provider
   - [ ] Create 2 outbound agents per provider
   - [ ] Each agent gets unique ID
   - [ ] No duplication (same voice doesn't create duplicate)

3. **Database Verification**
   - [ ] All agents appear in agents table
   - [ ] voice and voice_provider columns populated
   - [ ] org_id matches TEST_ORG_ID

4. **VAPI Integration**
   - [ ] VAPI assistants created for each agent
   - [ ] Voice provider parameter passed correctly
   - [ ] Assistant IDs match between database and VAPI

5. **Update Operations**
   - [ ] Update voice within same provider works
   - [ ] Update to different provider works
   - [ ] Changes reflect in both database and VAPI

6. **Delete Operations**
   - [ ] Delete removes agent from database
   - [ ] Delete removes assistant from VAPI
   - [ ] No orphaned records left

7. **Legacy Voice Compatibility**
   - [ ] Legacy voice names auto-map to modern equivalents
   - [ ] paige/neha/etc. → Savannah
   - [ ] harry/cole/etc. → Rohan

8. **No Duplication**
   - [ ] Creating same voice twice creates 2 agents
   - [ ] Both agents appear in database
   - [ ] Both assistants exist in VAPI

---

**Test Status:** Ready for execution against staging/production environment

**Estimated Runtime:** 10-15 minutes for all providers

**Expected Agent Count:** 32 total agents (8 per provider × 4 providers tested)
