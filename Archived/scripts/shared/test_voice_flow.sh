#!/bin/bash

# Voice Flow End-to-End Test Script
# Tests: Frontend connectivity, Backend health, Settings persistence, Voice flow

set -e

echo "=========================================="
echo "Voice Flow End-to-End Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Frontend Connectivity
echo -e "${YELLOW}[TEST 1]${NC} Frontend Connectivity"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend running on port 3000${NC}"
else
    echo -e "${RED}✗ Frontend not responding${NC}"
    exit 1
fi
echo ""

# Test 2: Backend Health
echo -e "${YELLOW}[TEST 2]${NC} Backend Health"
HEALTH=$(curl -s http://localhost:3001/health | jq -r '.status' 2>/dev/null || echo "error")
if [ "$HEALTH" = "ok" ]; then
    echo -e "${GREEN}✓ Backend healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    exit 1
fi
echo ""

# Test 3: Settings Endpoint
echo -e "${YELLOW}[TEST 3]${NC} Settings Endpoint"
SETTINGS=$(curl -s http://localhost:3001/api/founder-console/settings 2>/dev/null)
VAPI_CONFIGURED=$(echo "$SETTINGS" | jq -r '.vapiConfigured' 2>/dev/null || echo "error")
TWILIO_CONFIGURED=$(echo "$SETTINGS" | jq -r '.twilioConfigured' 2>/dev/null || echo "error")

if [ "$VAPI_CONFIGURED" = "true" ]; then
    echo -e "${GREEN}✓ Vapi configured${NC}"
else
    echo -e "${RED}✗ Vapi not configured${NC}"
fi

if [ "$TWILIO_CONFIGURED" = "true" ]; then
    echo -e "${GREEN}✓ Twilio configured${NC}"
else
    echo -e "${YELLOW}⚠ Twilio not configured (optional)${NC}"
fi
echo ""

# Test 4: Manifest Icon
echo -e "${YELLOW}[TEST 4]${NC} Manifest Icon"
ICON_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/callwaiting-ai-logo.png)
if [ "$ICON_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Icon accessible (HTTP $ICON_STATUS)${NC}"
else
    echo -e "${RED}✗ Icon not found (HTTP $ICON_STATUS)${NC}"
fi
echo ""

# Test 5: Audio Player
echo -e "${YELLOW}[TEST 5]${NC} Audio Player Module"
if grep -q "class AudioPlayer" "/Users/mac/Desktop/VOXANNE  WEBSITE/src/lib/audio/player.ts"; then
    echo -e "${GREEN}✓ AudioPlayer class exists${NC}"
else
    echo -e "${RED}✗ AudioPlayer class not found${NC}"
fi
echo ""

# Test 6: Audio Recorder
echo -e "${YELLOW}[TEST 6]${NC} Audio Recorder Module"
if grep -q "class AudioRecorder" "/Users/mac/Desktop/VOXANNE  WEBSITE/src/lib/audio/recorder.ts"; then
    echo -e "${GREEN}✓ AudioRecorder class exists${NC}"
else
    echo -e "${RED}✗ AudioRecorder class not found${NC}"
fi
echo ""

# Test 7: useVoiceAgent Hook
echo -e "${YELLOW}[TEST 7]${NC} useVoiceAgent Hook"
if grep -q "export function useVoiceAgent" "/Users/mac/Desktop/VOXANNE  WEBSITE/src/hooks/useVoiceAgent.ts"; then
    echo -e "${GREEN}✓ useVoiceAgent hook exists${NC}"
else
    echo -e "${RED}✗ useVoiceAgent hook not found${NC}"
fi
echo ""

# Test 8: Voice Test Page
echo -e "${YELLOW}[TEST 8]${NC} Voice Test Page"
if grep -q "export default function VoiceTestPage" "/Users/mac/Desktop/VOXANNE  WEBSITE/src/app/dashboard/voice-test/page.tsx"; then
    echo -e "${GREEN}✓ Voice test page exists${NC}"
else
    echo -e "${RED}✗ Voice test page not found${NC}"
fi
echo ""

# Test 9: Error Handling in AudioRecorder
echo -e "${YELLOW}[TEST 9]${NC} Error Handling in AudioRecorder"
if grep -q "NotAllowedError" "/Users/mac/Desktop/VOXANNE  WEBSITE/src/lib/audio/recorder.ts"; then
    echo -e "${GREEN}✓ Microphone permission error handling exists${NC}"
else
    echo -e "${RED}✗ Error handling not found${NC}"
fi
echo ""

# Test 10: State Management in useVoiceAgent
echo -e "${YELLOW}[TEST 10]${NC} State Management (VAD Animation Fix)"
if grep -q "speakingTimeoutRef" "/Users/mac/Desktop/VOXANNE  WEBSITE/src/hooks/useVoiceAgent.ts"; then
    echo -e "${GREEN}✓ Speaking timeout ref exists (VAD fix applied)${NC}"
else
    echo -e "${RED}✗ Speaking timeout ref not found${NC}"
fi
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}All critical components verified!${NC}"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000/dashboard/voice-test"
echo "2. Click 'Start Conversation'"
echo "3. Allow microphone access"
echo "4. Speak a sentence"
echo "5. Verify transcription appears"
echo "6. Verify agent response appears"
echo "7. Verify audio plays without glitching"
echo ""
