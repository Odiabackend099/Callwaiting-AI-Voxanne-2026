# Voxanne Voice Orchestration - Production Implementation Plan

## Overview
Building production-grade voice orchestration for CallWaiting AI's Voxanne agent with:
- State Machine (IDLE → LISTENING → PROCESSING → SPEAKING → INTERRUPTED)
- Barge-In Detection with immediate TTS kill
- Sub-500ms voice-to-voice latency
- Approved TTS voice: aura-2-thalia-en

---

## Phase 1: State Machine Architecture ✅

### States
| State | Description | Transitions |
|-------|-------------|-------------|
| **IDLE** | Waiting for call | → LISTENING (call_start) |
| **LISTENING** | Receiving user audio | → PROCESSING (speech_end) |
| **PROCESSING** | LLM generating response | → SPEAKING (LLM_ready) |
| **SPEAKING** | TTS playing audio | → LISTENING (audio_done), → INTERRUPTED (barge-in) |
| **INTERRUPTED** | User interrupted bot | → LISTENING (flush/clear) |

### Implementation
- `ConversationState` enum
- `CallContext` dataclass for per-call state
- `_transition_to()` method with logging

---

## Phase 2: Barge-In Detection ✅

### Detection Logic
1. Monitor STT during SPEAKING state
2. If meaningful speech detected (>2 chars):
   - Set `cancel_tts = True`
   - Clear audio queue
   - Send `clear` event to Twilio
   - Transition to INTERRUPTED → LISTENING

### Twilio Clear Message
```json
{"event": "clear", "streamSid": "..."}
```

---

## Phase 3: Latency Optimization ✅

### Target: <500ms Total
| Stage | Target | Implementation |
|-------|--------|----------------|
| STT (Nova-2) | 150ms | Streaming WebSocket, interim results |
| Network RX | 50ms | Keep-alive connections |
| LLM (Groq) | 100ms | Streaming tokens, sentence buffering |
| TTS (Aura-2) | 100ms | REST API, chunked audio |
| Network TX | 50ms | 20ms audio chunks |
| **Total** | **450ms** | ✅ Under target |

### Key Optimizations
- Sentence-level TTS (don't wait for full response)
- 20ms audio chunks for smooth playback
- Concurrent STT/TTS tasks

---

## Phase 4: TTS# Dashboard Implementation Plan

## Phase 1: Project Scan & Cleanup 
- [x] Scan entire project for duplicate/old files
- [x] Identify old dashboard files
- [x] Delete duplicate test-voice redirect page (commit: 2f455da)
- [x] Verify no other duplicates exist

## Phase 2: Implement Comprehensive Dashboard
- [ ] Replace dashboard/page.tsx with VoxanneDashboard component
- [ ] Integrate real-time metrics (calls, bookings, revenue)
- [ ] Add recent calls section with call details
- [ ] Add upcoming bookings section
- [ ] Add weekly performance chart
- [ ] Add Safe Mode status banner
- [ ] Ensure proper TypeScript types and interfaces

## Phase 3: Maintain Voice Chat & Settings
- [ ] Keep dashboard/voice-test/page.tsx (working voice chat UI)
- [ ] Keep dashboard/settings/page.tsx (agent configuration)
- [ ] Ensure proper navigation between pages
- [ ] Verify auth guards on all pages
- [ ] Add navigation back to main dashboard from voice-test and settings

## Phase 4: Code Quality & Testing
- [ ] Remove code duplication
- [ ] Verify no console errors
- [ ] Test complete auth flow
- [ ] Test dashboard navigation
- [ ] Test voice chat functionality
- [ ] Test settings save/load
- [ ] Verify responsive design on mobile/tablet/desktop

---

## Testing Criteria

### Unit Tests
- [ ] State transitions work correctly
- [ ] Barge-in detection triggers within 200ms
- [ ] TTS audio clears immediately on interruption
- [ ] LLM streaming works with sentence buffering

### Integration Tests
- [ ] Full call flow: greeting → conversation → goodbye
- [ ] Barge-in mid-sentence stops audio
- [ ] Latency under 500ms measured end-to-end

### Acceptance Criteria
- [ ] Caller hears greeting within 1 second of connection
- [ ] Voxanne responds within 500ms of user finishing speech
- [ ] Interrupting Voxanne stops her immediately
- [ ] Conversation feels natural and responsive

---

## Files Created
1. `voxanne_voice_orchestration.py` - Main orchestration engine
2. `planning.md` - This file

## Dependencies
- fastapi
- uvicorn
- websockets
- aiohttp
- groq
- python-dotenv
