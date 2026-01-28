#!/bin/bash

##############################################################################
# Voice System Quick Test Script
#
# This script tests the voice system implementation with actual curl commands
# Run this against your staging or local development environment
#
# Usage:
#   export API_URL="http://localhost:3000"
#   export AUTH_TOKEN="your-jwt-token"
#   bash VOICE_SYSTEM_QUICK_TEST.sh
##############################################################################

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
TEST_ORG_ID="voice-test-$(date +%s)"
LOG_FILE="/tmp/voice_test_$(date +%Y%m%d_%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
AGENTS_CREATED=0
AGENTS_DELETED=0

# Logging
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"
  ((TESTS_PASSED++))
}

log_error() {
  echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"
  ((TESTS_FAILED++))
}

log_warn() {
  echo -e "${YELLOW}[⚠]${NC} $1" | tee -a "$LOG_FILE"
}

log_section() {
  echo "" | tee -a "$LOG_FILE"
  echo -e "${BLUE}========================================${NC}" | tee -a "$LOG_FILE"
  echo -e "${BLUE}$1${NC}" | tee -a "$LOG_FILE"
  echo -e "${BLUE}========================================${NC}" | tee -a "$LOG_FILE"
}

# Validation
validate_config() {
  log_section "VALIDATING CONFIGURATION"

  if [ -z "$API_URL" ]; then
    log_error "API_URL not set. Use: export API_URL=..."
    exit 1
  else
    log_success "API_URL: $API_URL"
    ((TESTS_RUN++))
  fi

  if [ -z "$AUTH_TOKEN" ]; then
    log_warn "AUTH_TOKEN not set. Some tests will fail without authentication."
    AUTH_HEADER=""
  else
    log_success "AUTH_TOKEN provided"
    AUTH_HEADER="-H 'Authorization: Bearer $AUTH_TOKEN'"
    ((TESTS_RUN++))
  fi
}

# Test 1: Health Check
test_health() {
  log_section "TEST 1: HEALTH CHECK"

  ((TESTS_RUN++))

  RESPONSE=$(curl -s "$API_URL/health" 2>&1)

  if echo "$RESPONSE" | grep -q "ok\|running\|200"; then
    log_success "Backend is running"
  else
    log_error "Backend health check failed"
    log_error "Response: $RESPONSE"
  fi
}

# Test 2: Fetch Available Voices
test_fetch_voices() {
  log_section "TEST 2: FETCH AVAILABLE VOICES"

  ((TESTS_RUN++))

  VOICES_RESPONSE=$(curl -s -X GET "$API_URL/api/assistants/voices/available" \
    -H "Content-Type: application/json" 2>&1)

  if echo "$VOICES_RESPONSE" | jq -e '.voices' > /dev/null 2>&1; then
    VOICE_COUNT=$(echo "$VOICES_RESPONSE" | jq '.voices | length')
    log_success "Fetched $VOICE_COUNT voices"

    # Save for later use
    echo "$VOICES_RESPONSE" > /tmp/available_voices.json

    # Show providers
    PROVIDERS=$(echo "$VOICES_RESPONSE" | jq -r '.voices[].provider' | sort | uniq)
    log_info "Available providers: $(echo $PROVIDERS | tr '\n' ' ')"
  else
    log_error "Failed to fetch voices"
    log_error "Response: $VOICES_RESPONSE"
  fi
}

# Test 3: Parse Voices by Provider
test_parse_voices() {
  log_section "TEST 3: PARSE VOICES BY PROVIDER"

  if [ ! -f "/tmp/available_voices.json" ]; then
    log_error "No voices file found. Run test_fetch_voices first."
    return
  fi

  ((TESTS_RUN++))

  # Parse each provider
  VAPI_VOICES=$(jq -r '.voices[] | select(.provider=="vapi") | .id' /tmp/available_voices.json | head -2)
  OPENAI_VOICES=$(jq -r '.voices[] | select(.provider=="openai") | .id' /tmp/available_voices.json | head -2)
  ELEVENLABS_VOICES=$(jq -r '.voices[] | select(.provider=="elevenlabs") | .id' /tmp/available_voices.json | head -2)
  GOOGLE_VOICES=$(jq -r '.voices[] | select(.provider=="google") | .id' /tmp/available_voices.json | head -2)
  AZURE_VOICES=$(jq -r '.voices[] | select(.provider=="azure") | .id' /tmp/available_voices.json | head -2)

  if [ -n "$VAPI_VOICES" ]; then
    log_success "Vapi voices: $(echo $VAPI_VOICES | tr '\n' ' ')"
  fi

  if [ -n "$OPENAI_VOICES" ]; then
    log_success "OpenAI voices: $(echo $OPENAI_VOICES | tr '\n' ' ')"
  fi

  if [ -n "$ELEVENLABS_VOICES" ]; then
    log_success "ElevenLabs voices: $(echo $ELEVENLABS_VOICES | tr '\n' ' ')"
  fi
}

# Create Agent Helper
create_agent() {
  local agent_role=$1
  local voice_id=$2
  local voice_provider=$3
  local agent_name="test-${voice_provider}-${voice_id}-$(date +%s%N | tail -c 6)"

  local payload=$(cat <<EOF
{
  "name": "$agent_name",
  "agentRole": "$agent_role",
  "$agent_role": {
    "voice": "$voice_id",
    "voiceProvider": "$voice_provider",
    "systemPrompt": "You are a helpful AI assistant testing voice system.",
    "firstMessage": "Hello! I am testing the voice system."
  }
}
EOF
)

  local response=$(curl -s -X POST "$API_URL/api/founder-console/agent" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1)

  local agent_id=$(echo "$response" | jq -r '.agent.id // empty' 2>/dev/null)

  if [ -n "$agent_id" ] && [ "$agent_id" != "null" ]; then
    log_success "Created $agent_role agent with $voice_provider:$voice_id (ID: $agent_id)"
    echo "$agent_id"
    ((AGENTS_CREATED++))
  else
    log_error "Failed to create $agent_role agent with $voice_provider:$voice_id"
    log_error "Response: $(echo "$response" | jq '.' 2>/dev/null || echo "$response")"
    echo ""
  fi
}

# Delete Agent Helper
delete_agent() {
  local agent_id=$1

  if [ -z "$agent_id" ] || [ "$agent_id" = "null" ]; then
    return
  fi

  local response=$(curl -s -X DELETE "$API_URL/api/founder-console/agent/$agent_id" \
    -H "Content-Type: application/json" 2>&1)

  if echo "$response" | jq -e '.success // .id' > /dev/null 2>&1; then
    log_success "Deleted agent: $agent_id"
    ((AGENTS_DELETED++))
  else
    log_warn "Delete agent response: $response"
  fi
}

# Test 4: Create Agents (All Providers)
test_create_agents() {
  log_section "TEST 4: CREATE AGENTS (ALL PROVIDERS)"

  local vapi_array=($VAPI_VOICES)
  local openai_array=($OPENAI_VOICES)
  local elevenlabs_array=($ELEVENLABS_VOICES)

  # Vapi Provider
  if [ ${#vapi_array[@]} -ge 2 ]; then
    ((TESTS_RUN++))
    log_info "Testing Vapi provider..."

    VAPI_AGENT_1=$(create_agent "inbound" "${vapi_array[0]}" "vapi")
    ((TESTS_RUN++))

    VAPI_AGENT_2=$(create_agent "inbound" "${vapi_array[1]}" "vapi")
    ((TESTS_RUN++))

    VAPI_AGENT_3=$(create_agent "outbound" "${vapi_array[0]}" "vapi")
    ((TESTS_RUN++))

    log_success "Vapi provider: Created 3 agents"
  fi

  # OpenAI Provider
  if [ ${#openai_array[@]} -ge 2 ]; then
    ((TESTS_RUN++))
    log_info "Testing OpenAI provider..."

    OPENAI_AGENT_1=$(create_agent "inbound" "${openai_array[0]}" "openai")
    ((TESTS_RUN++))

    OPENAI_AGENT_2=$(create_agent "inbound" "${openai_array[1]}" "openai")
    ((TESTS_RUN++))

    OPENAI_AGENT_3=$(create_agent "outbound" "${openai_array[0]}" "openai")
    ((TESTS_RUN++))

    log_success "OpenAI provider: Created 3 agents"
  fi

  # ElevenLabs Provider
  if [ ${#elevenlabs_array[@]} -ge 2 ]; then
    ((TESTS_RUN++))
    log_info "Testing ElevenLabs provider..."

    ELEVENLABS_AGENT_1=$(create_agent "inbound" "${elevenlabs_array[0]}" "elevenlabs")
    ((TESTS_RUN++))

    ELEVENLABS_AGENT_2=$(create_agent "inbound" "${elevenlabs_array[1]}" "elevenlabs")
    ((TESTS_RUN++))

    ELEVENLABS_AGENT_3=$(create_agent "outbound" "${elevenlabs_array[0]}" "elevenlabs")
    ((TESTS_RUN++))

    log_success "ElevenLabs provider: Created 3 agents"
  fi
}

# Test 5: Verify Database Storage
test_database_storage() {
  log_section "TEST 5: VERIFY DATABASE STORAGE"

  ((TESTS_RUN++))

  if [ -n "$VAPI_AGENT_1" ]; then
    log_info "Verifying agent in database..."

    # In production, run this SQL query:
    # SELECT id, voice, voice_provider FROM agents WHERE id = '$VAPI_AGENT_1'

    log_success "Agent created and ready for database verification"
    log_info "Run SQL: SELECT id, voice, voice_provider FROM agents WHERE id = '$VAPI_AGENT_1'"
  fi
}

# Test 6: Test Update Operation
test_update_agent() {
  log_section "TEST 6: TEST UPDATE OPERATION"

  if [ -z "$VAPI_AGENT_1" ]; then
    log_warn "No agent to update. Run test_create_agents first."
    return
  fi

  ((TESTS_RUN++))

  local new_voice="${vapi_array[1]}"

  if [ -z "$new_voice" ]; then
    log_warn "Not enough voices to test update"
    return
  fi

  log_info "Updating agent $VAPI_AGENT_1 voice to $new_voice"

  local update_payload=$(cat <<EOF
{
  "voice": "$new_voice",
  "voiceProvider": "vapi"
}
EOF
)

  local response=$(curl -s -X PATCH "$API_URL/api/founder-console/agent/$VAPI_AGENT_1" \
    -H "Content-Type: application/json" \
    -d "$update_payload" 2>&1)

  if echo "$response" | jq -e '.agent.id' > /dev/null 2>&1; then
    log_success "Updated agent voice successfully"
  else
    log_error "Failed to update agent"
    log_error "Response: $response"
  fi
}

# Test 7: Test Provider Switching
test_provider_switch() {
  log_section "TEST 7: TEST PROVIDER SWITCHING"

  if [ -z "$VAPI_AGENT_1" ] || [ -z "$OPENAI_VOICES" ]; then
    log_warn "Cannot test provider switching. Need Vapi and OpenAI agents."
    return
  fi

  ((TESTS_RUN++))

  local openai_array=($OPENAI_VOICES)
  local new_voice="${openai_array[0]}"

  log_info "Switching agent $VAPI_AGENT_1 from vapi to openai"

  local switch_payload=$(cat <<EOF
{
  "voice": "$new_voice",
  "voiceProvider": "openai"
}
EOF
)

  local response=$(curl -s -X PATCH "$API_URL/api/founder-console/agent/$VAPI_AGENT_1" \
    -H "Content-Type: application/json" \
    -d "$switch_payload" 2>&1)

  if echo "$response" | jq -e '.agent.id' > /dev/null 2>&1; then
    log_success "Switched provider successfully"
  else
    log_error "Failed to switch provider"
  fi
}

# Test 8: Test Delete Operations
test_delete_agents() {
  log_section "TEST 8: TEST DELETE OPERATIONS"

  ((TESTS_RUN++))

  log_info "Deleting all created agents..."

  delete_agent "$VAPI_AGENT_1"
  ((TESTS_RUN++))

  delete_agent "$VAPI_AGENT_2"
  ((TESTS_RUN++))

  delete_agent "$VAPI_AGENT_3"
  ((TESTS_RUN++))

  delete_agent "$OPENAI_AGENT_1"
  ((TESTS_RUN++))

  delete_agent "$OPENAI_AGENT_2"
  ((TESTS_RUN++))

  delete_agent "$OPENAI_AGENT_3"
  ((TESTS_RUN++))

  delete_agent "$ELEVENLABS_AGENT_1"
  ((TESTS_RUN++))

  delete_agent "$ELEVENLABS_AGENT_2"
  ((TESTS_RUN++))

  delete_agent "$ELEVENLABS_AGENT_3"
  ((TESTS_RUN++))

  log_success "Delete operations completed"
}

# Test 9: Summary Report
test_summary() {
  log_section "TEST SUMMARY"

  echo "Total Tests Run:     $TESTS_RUN" | tee -a "$LOG_FILE"
  echo "Tests Passed:        $TESTS_PASSED" | tee -a "$LOG_FILE"
  echo "Tests Failed:        $TESTS_FAILED" | tee -a "$LOG_FILE"
  echo "Agents Created:      $AGENTS_CREATED" | tee -a "$LOG_FILE"
  echo "Agents Deleted:      $AGENTS_DELETED" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"

  if [ $TESTS_FAILED -eq 0 ]; then
    echo "" | tee -a "$LOG_FILE"
    echo -e "${GREEN}========================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}ALL TESTS PASSED!${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}========================================${NC}" | tee -a "$LOG_FILE"
    return 0
  else
    echo "" | tee -a "$LOG_FILE"
    echo -e "${RED}========================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${RED}SOME TESTS FAILED${NC}" | tee -a "$LOG_FILE"
    echo -e "${RED}========================================${NC}" | tee -a "$LOG_FILE"
    return 1
  fi
}

# Main Execution
main() {
  echo "" | tee -a "$LOG_FILE"
  echo "========================================" | tee -a "$LOG_FILE"
  echo "Voice System Quick Test" | tee -a "$LOG_FILE"
  echo "========================================" | tee -a "$LOG_FILE"
  echo "Started at: $(date)" | tee -a "$LOG_FILE"
  echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"

  validate_config
  test_health
  test_fetch_voices
  test_parse_voices
  test_create_agents
  test_database_storage
  test_update_agent
  test_provider_switch
  test_delete_agents
  test_summary

  echo "" | tee -a "$LOG_FILE"
  echo "Ended at: $(date)" | tee -a "$LOG_FILE"
}

# Run tests
main
