---
name: voxanne-backend-integration
description: Execute the complete Voxanne backend-frontend integration following the 5-phase implementation roadmap. Use when implementing backend connection, WebSocket setup, test calls, or production deployment.
---

# Voxanne Backend Integration Skill

This skill guides the complete integration of voxanne-dashboard backend with callwaitingai.dev frontend, following the proven 5-phase implementation roadmap.

## When to Use This Skill

- Implementing backend transplant and setup
- Creating WebSocket client for real-time updates
- Building API client for backend endpoints
- Creating agent configuration and test call pages
- Deploying backend to production
- Configuring inbound call handling

## Core Principles

1. **Follow the Planning Document**: All work must align with `/planning.md`
2. **Senior Engineer Review Standards**: Apply all fixes from code review (security, performance, error handling)
3. **No Hallucinations**: Only use existing code from voxanne-dashboard backend
4. **Test-First**: Verify each phase before moving to next
5. **Production-Ready**: All code must be hardened for production

## Phase Execution Order

### Phase 0: Pre-flight (1 day)
- Validate all credentials (Supabase, Vapi, Twilio)
- Verify repository structure
- Check database schema completeness
- **Success**: All prerequisites validated

### Phase 1: Backend Setup (2 days)
- Transplant backend folder to callwaitingai.dev
- Install dependencies and build
- Start backend on port 3000
- Run integration smoke tests
- **Success**: Health endpoint returns OK, WebSocket ready

### Phase 2: Frontend Connection (3 days)
- Create `src/lib/websocket-client.ts` with:
  - Auto-reconnect with exponential backoff (1s → 2s → 4s → 8s → 16s)
  - Connection state management
  - Message deduplication (limit to 100 messages)
  - Proper cleanup on unmount
  - Error state and user feedback
- Create `src/lib/backend-api.ts` with:
  - Type-safe fetch wrapper
  - E.164 phone number validation
  - Request timeout (10s default)
  - Proper error handling
- Update dashboard to show real data
- **Success**: Dashboard shows "🟢 Live" indicator, stats load from backend

### Phase 3: Test Calls (3 days)
- Create `/dashboard/agent-config/page.tsx` with:
  - Phone test button (triggers real call)
  - Web test button (browser audio)
  - Error handling and user feedback
  - Proper WebSocket cleanup
- Test phone call end-to-end
- Implement web test audio capture
- **Success**: Receive test call on phone, see it in dashboard

### Phase 4: Production Prep (5 days)
- Remove all debug code (console.log)
- Add CSRF protection
- Implement client-side rate limiting
- Sanitize all inputs
- Deploy backend to Render/Railway
- **Success**: Backend live on production URL

### Phase 5: Launch (2 days)
- Configure inbound Twilio number
- Customize agent personality
- Upload clinic knowledge base
- Monitor real calls
- **Success**: Answering real clinic calls 24/7

## Code Review Standards (Non-Negotiable)

All code must address these issues from senior engineer review:

### Security
- ✅ Add CSRF token headers for state-changing requests
- ✅ Use WebSocket subprotocol auth (not URL params)
- ✅ Sanitize phone number inputs
- ✅ Use environment variables exclusively (no hardcoded URLs)
- ✅ Implement client-side rate limiting

### Performance
- ✅ Limit message history to 100 items (prevent memory leak)
- ✅ Debounce WebSocket updates (500ms delay)
- ✅ Add request timeout (10s default)
- ✅ Use memoization for derived state
- ✅ Implement exponential backoff for reconnects

### Error Handling
- ✅ Add error state to WebSocket hook
- ✅ Prevent race conditions in reconnect logic
- ✅ Add timeout handling for API calls
- ✅ Validate E.164 phone number format
- ✅ Display user-friendly error messages

### Code Quality
- ✅ Remove all console.log statements
- ✅ Add TypeScript interfaces for all API responses
- ✅ Implement proper cleanup in useEffect
- ✅ Use refs to avoid stale closures
- ✅ Add accessibility (ARIA labels)

### Testing
- ✅ Unit tests for WebSocket reconnection
- ✅ Integration tests for API client
- ✅ End-to-end test for phone call flow
- ✅ Verify dashboard updates in real-time

## Critical Files

### Backend (from voxanne-dashboard)
- `backend/src/server.ts` - Main server with WebSocket handlers
- `backend/src/routes/founder-console.ts` - Test call endpoints
- `backend/src/services/web-voice-bridge.ts` - Web test audio bridge
- `backend/src/services/vapi-service.ts` - Vapi integration

### Frontend (to create)
- `src/lib/websocket-client.ts` - WebSocket hook with all fixes
- `src/lib/backend-api.ts` - Type-safe API client
- `src/components/DashboardWithRealData.tsx` - Real-time dashboard
- `src/app/dashboard/agent-config/page.tsx` - Agent testing UI

## Success Verification

### Phase 0
```bash
# Verify credentials
curl -H "apikey: $SUPABASE_KEY" https://lbjymlodxprzqgtyqtcq.supabase.co/rest/v1/
curl -H "Authorization: Bearer $VAPI_KEY" https://api.vapi.ai/assistant
curl -u "$TWILIO_SID:$TWILIO_TOKEN" https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID.json
```

### Phase 1
```bash
# Backend health check
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"...","uptime":...}

# WebSocket diagnostics
curl http://localhost:3000/api/web-test/diagnostics
```

### Phase 2
```bash
# Frontend loads
open http://localhost:3002/dashboard
# Should show "🟢 Live" indicator

# Check WebSocket in DevTools
# Network tab should show WebSocket connection to ws://localhost:3000/ws/live-calls
```

### Phase 3
```bash
# Make test call
# Navigate to http://localhost:3002/dashboard/agent-config
# Enter phone number in E.164 format
# Click "Call My Phone"
# You should receive a call within 10 seconds

# Verify in dashboard
# Recent Calls should show your test call immediately
```

### Phase 4
```bash
# Verify production deployment
curl https://voxanne-backend.render.com/health
# Should return OK

# Check logs
# No console.log statements in code
# Only structured logging
```

### Phase 5
```bash
# Verify inbound call handling
# Forward clinic number to Voxanne
# Call the number
# Voxanne should answer and handle the call
# Booking should appear in dashboard
```

## Common Issues & Fixes

### WebSocket Won't Connect
- Check CORS_ORIGIN in backend/.env matches frontend URL
- Check WS_ALLOWED_ORIGINS includes frontend URL
- Verify backend is running on port 3000
- Check browser console for WebSocket errors

### Phone Test Doesn't Ring
- Verify Twilio account has credit
- Check phone number is in E.164 format (+44...)
- Verify TWILIO_PHONE_NUMBER is set in backend/.env
- Check backend logs for Vapi/Twilio errors

### Dashboard Shows "Disconnected"
- Verify backend health: `curl http://localhost:3000/health`
- Check NEXT_PUBLIC_BACKEND_URL is set correctly
- Verify firewall allows WebSocket connections
- Check browser DevTools Network tab for WebSocket errors

### API Calls Return 401
- Verify SUPABASE_SERVICE_KEY is correct
- Check token hasn't expired
- Verify user is authenticated in frontend
- Check backend logs for auth errors

## Performance Targets

- Dashboard loads in <2 seconds
- WebSocket connects in <1 second
- API calls complete in <500ms
- Health endpoint responds in <100ms
- Memory usage <200MB at startup
- No memory leaks after 24h operation

## Deployment Checklist

Before deploying to production:

- [ ] All console.log statements removed
- [ ] CSRF tokens implemented
- [ ] Rate limiting active
- [ ] Input sanitization added
- [ ] No hardcoded credentials
- [ ] Environment variables configured
- [ ] Health endpoint working
- [ ] All integrations tested
- [ ] Error handling complete
- [ ] Monitoring configured
- [ ] Logs accessible
- [ ] Rollback plan documented

## Example User Queries

- "Let's transplant the backend to callwaitingai.dev"
- "Create the WebSocket client with all the fixes"
- "Build the agent config page for testing"
- "Deploy the backend to production"
- "Why isn't the phone test working?"
- "How do I customize the agent personality?"

