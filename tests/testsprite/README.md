# TestSprite Corrected Tests - Setup & Execution Guide

## Overview

These are corrected TestSprite tests for Voxanne MVP. The original tests had **route mismatches** and **missing environment configuration**. These corrected tests use the actual API routes and proper payloads.

---

## What Was Fixed

| Issue | Original | Corrected |
|-------|----------|-----------|
| Webhook route | `/api/webhooks` | `/api/webhooks/vapi` |
| Outbound calls | `/api/calls/start` | `/api/founder-console/agent/test-call` |
| Call logs | `/api/calls/logs` | `/api/calls` |
| KB upload | `/api/knowledge-base/upload` | `/api/knowledge-base` (POST) |
| KB search | `/api/knowledge-base/query` | `/api/knowledge-base/search` (POST) |
| Vapi setup | `/api/vapi/setup` | `/api/vapi/setup/configure-webhook` |
| Inbound config | `/api/inbound/config` | `/api/inbound` (PUT) |

---

## Test Files

```
tests/testsprite/
├── TC001_webhook_handling.py          # Webhook event handling
├── TC002_outbound_calls.py            # Start outbound calls
├── TC003_call_logs.py                 # Get call logs
├── TC004_list_assistants.py           # List assistants
├── TC005_create_assistant.py          # Create assistant
├── TC006_upload_kb.py                 # Upload KB document
├── TC007_query_kb.py                  # Search KB
├── TC008_vapi_setup.py                # Configure Vapi webhook
├── TC009_inbound_config.py            # Update inbound config
├── TC010_founder_console_settings.py  # Get settings
├── run_all_tests.py                   # Master test runner
└── README.md                          # This file
```

---

## Setup Instructions

### Step 1: Set Environment Variables

```bash
# Required
export BASE_URL="http://localhost:3001"

# Optional but recommended for full testing
export VAPI_API_KEY="your-vapi-api-key"
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Step 2: Get JWT Token (for authenticated tests)

```bash
# Option A: Use test account
export TEST_JWT_TOKEN="your-jwt-token-from-supabase"

# Option B: Get token from Supabase
curl -X POST "https://your-supabase-url/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Step 3: Start Backend Server

```bash
cd /Users/mac/Desktop/VOXANNE\ WEBSITE/backend
npm run dev
```

---

## Running Tests

### Run All Tests

```bash
cd /Users/mac/Desktop/VOXANNE\ WEBSITE/tests/testsprite
python run_all_tests.py
```

### Run Individual Test

```bash
python TC001_webhook_handling.py
python TC002_outbound_calls.py
# ... etc
```

---

## Expected Results

### Without JWT Token
- TC001: ✅ PASSED (no auth required)
- TC002-TC010: ⚠️ SKIPPED (auth required)

### With JWT Token + Environment Variables
- All 10 tests: ✅ PASSED

### With Missing VAPI_API_KEY
- TC004: ⚠️ 503 Service Unavailable (expected)
- Others: ✅ PASSED

---

## Test Details

### TC001: Webhook Handling
- **Endpoint:** `POST /api/webhooks/vapi`
- **Auth:** Signature verification (optional)
- **Payload:** Vapi webhook event
- **Expected:** 200 or 401

### TC002: Outbound Calls
- **Endpoint:** `POST /api/founder-console/agent/test-call`
- **Auth:** JWT required
- **Payload:** Phone number, agent ID, voice
- **Expected:** 200 or 400

### TC003: Call Logs
- **Endpoint:** `GET /api/calls`
- **Auth:** JWT required
- **Expected:** 200 with call list

### TC004: List Assistants
- **Endpoint:** `GET /api/assistants`
- **Auth:** JWT required
- **Requires:** VAPI_API_KEY
- **Expected:** 200 or 503

### TC005: Create Assistant
- **Endpoint:** `POST /api/assistants`
- **Auth:** JWT required
- **Payload:** Name, system prompt, voice
- **Expected:** 200 or 400

### TC006: Upload KB
- **Endpoint:** `POST /api/knowledge-base`
- **Auth:** JWT required
- **Payload:** Name, content, category
- **Expected:** 200 or 400

### TC007: Query KB
- **Endpoint:** `POST /api/knowledge-base/search`
- **Auth:** JWT required
- **Payload:** Query string
- **Expected:** 200 or 400

### TC008: Vapi Setup
- **Endpoint:** `POST /api/vapi/setup/configure-webhook`
- **Auth:** JWT required
- **Payload:** Assistant ID
- **Expected:** 200 or 400

### TC009: Inbound Config
- **Endpoint:** `PUT /api/inbound`
- **Auth:** JWT required
- **Payload:** System prompt, first message, voice, language
- **Expected:** 200 or 400

### TC010: Founder Console Settings
- **Endpoint:** `GET /api/founder-console/settings`
- **Auth:** JWT required
- **Expected:** 200 with settings

---

## Troubleshooting

### 401 Unauthorized
- **Cause:** Missing or invalid JWT token
- **Fix:** Set `TEST_JWT_TOKEN` environment variable

### 404 Not Found
- **Cause:** Wrong API route
- **Fix:** Check route in test file matches server.ts

### 500 Internal Server Error
- **Cause:** Missing environment variables (e.g., VAPI_API_KEY)
- **Fix:** Set required environment variables

### Connection Refused
- **Cause:** Backend server not running
- **Fix:** Start backend with `npm run dev`

---

## Summary

**Before:** 0/10 tests passing (route mismatches, missing env)
**After:** All 10 tests should pass with proper setup

**Key Improvements:**
1. ✅ Fixed all route paths to match actual API
2. ✅ Corrected all payloads to match schema
3. ✅ Added environment variable setup
4. ✅ Added JWT authentication support
5. ✅ Created master test runner

**Next Steps:**
1. Set environment variables
2. Get JWT token
3. Run `python run_all_tests.py`
4. Verify 10/10 pass
