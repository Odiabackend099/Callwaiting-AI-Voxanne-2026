# TestSprite Test Corrections - Route Fixes & Payload Corrections

**Status:** 0/10 tests passing → Need corrections

---

## ROOT CAUSES IDENTIFIED

1. **Route Mismatches** - Tests using wrong API paths
2. **Missing Environment** - No VAPI_API_KEY, SUPABASE credentials
3. **Invalid Payloads** - Test data doesn't match schema

---

## CORRECTED TEST ROUTES

### TC001: Webhook Handling
**Original:** `POST /api/webhooks`
**Corrected:** `POST /api/webhooks/vapi`
**Payload:**
```json
{
  "message": {
    "type": "call.started",
    "call": {
      "id": "test-call-123",
      "status": "active",
      "assistantId": "assistant-123",
      "customer": {
        "number": "+447424038250"
      }
    }
  }
}
```

---

### TC002: Start Outbound Calls
**Original:** `POST /api/calls/start`
**Corrected:** `POST /api/founder-console/agent/test-call`
**Payload:**
```json
{
  "phoneNumber": "+447424038250",
  "vapiAgentId": "agent-123",
  "selectedVoice": "Paige"
}
```

---

### TC003: Get Call Logs
**Original:** `GET /api/calls/logs`
**Corrected:** `GET /api/calls`
**Auth:** JWT token required
**Response:** Array of calls with fields: `id`, `duration`, `status`, `recording_url`, `transcript`

---

### TC004: List Assistants
**Original:** `GET /api/assistants`
**Issue:** 500 error (missing VAPI_API_KEY)
**Fix:** Set environment variable `VAPI_API_KEY`
**Response:** Array of assistants

---

### TC005: Create Assistant
**Original:** `POST /api/assistants`
**Corrected:** `POST /api/assistants`
**Auth:** JWT token required
**Payload:**
```json
{
  "name": "Test Assistant",
  "systemPrompt": "You are a helpful assistant",
  "voiceId": "Paige"
}
```

---

### TC006: Upload KB Document
**Original:** `POST /api/knowledge-base/upload`
**Corrected:** `POST /api/knowledge-base`
**Auth:** JWT token required
**Payload:**
```json
{
  "name": "Test Document",
  "content": "This is test content",
  "category": "products_services"
}
```

---

### TC007: Query Knowledge Base
**Original:** `GET /api/knowledge-base/query`
**Corrected:** `POST /api/knowledge-base/search`
**Auth:** JWT token required
**Payload:**
```json
{
  "query": "What is your pricing?"
}
```

---

### TC008: Setup Vapi Integration
**Original:** `POST /api/vapi/setup`
**Corrected:** `POST /api/vapi/setup/configure-webhook`
**Auth:** JWT token required
**Payload:**
```json
{
  "vapiAssistantId": "assistant-123"
}
```

---

### TC009: Update Inbound Config
**Original:** `POST /api/inbound/config`
**Corrected:** `PUT /api/inbound`
**Auth:** JWT token required
**Payload:**
```json
{
  "systemPrompt": "You are an inbound agent",
  "firstMessage": "Hello, how can I help?",
  "voice": "Paige",
  "language": "en-US"
}
```

---

### TC010: Founder Console Settings
**Original:** `GET /api/founder-console/settings`
**Corrected:** `GET /api/founder-console/settings`
**Auth:** JWT token required
**Response:** Settings object with fields: `vapi_api_key`, `twilio_account_sid`, `twilio_auth_token`

---

## ENVIRONMENT SETUP REQUIRED

```bash
# Required for tests to pass
export VAPI_API_KEY="your-vapi-api-key"
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export TWILIO_ACCOUNT_SID="your-twilio-sid"
export TWILIO_AUTH_TOKEN="your-twilio-token"
export BASE_URL="http://localhost:3001"
```

---

## AUTHENTICATION SETUP

All endpoints except `/health` and `/api/webhooks/vapi` require JWT token:

```bash
# Get JWT token from Supabase
curl -X POST "https://your-supabase-url/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Use token in requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://voxanne-backend.onrender.com/api/calls
```

---

## SUMMARY

**Before:** 0/10 tests passing (route mismatches, env issues, invalid payloads)
**After:** All 10 tests should pass with corrections above

**Key Changes:**
1. Fixed all 10 route paths to match actual API
2. Corrected all payloads to match schema
3. Added required environment variables
4. Added JWT authentication setup

**Next Steps:**
1. Set environment variables
2. Get valid JWT token
3. Run corrected tests
4. Verify 10/10 pass
