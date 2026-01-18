# Startup Guide: Complete Local Development Environment

This guide walks you through starting all servers and configuring the VAPI webhook for local development.

---

## 📋 Quick Start (2 Commands)

### Step 1: Set ngrok Auth Token

```bash
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"
```

### Step 2: Run Startup Orchestration

```bash
cd backend
npm run startup
```

That's it! The script will:
- ✅ Start ngrok tunnel (creates public URL)
- ✅ Start backend server (port 3001)
- ✅ Start frontend server (port 3000)
- ✅ Configure VAPI webhook
- ✅ Verify all systems operational

---

## 🔧 Detailed Setup

### Prerequisites

Verify you have all required tools:

```bash
# Check ngrok is installed
which ngrok
ngrok --version

# Check Node.js and npm
node --version
npm --version

# Check backend dependencies are installed
cd backend && npm install
cd ../

# Check frontend dependencies are installed
npm install
```

### Environment Variables

Ensure your backend `.env` file has all required variables:

```bash
cd backend
cp .env.example .env

# Edit .env and verify these are set:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - VAPI_API_KEY
# - OPENAI_API_KEY (optional but recommended)
# - ENCRYPTION_KEY (generate with: openssl rand -hex 32)
```

### ngrok Authentication

The startup script requires your ngrok auth token:

```bash
# Option 1: Set environment variable (temporary)
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"

# Option 2: Configure ngrok permanently
ngrok config add-authtoken 35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU
```

---

## 🚀 Running the Startup Script

### From Backend Directory

```bash
cd backend

# Using npm script
npm run startup

# OR using ts-node directly
ts-node scripts/startup-orchestration.ts
```

### What the Script Does

1. **Starts ngrok tunnel** (port 3001)
   - Creates a public URL: `https://xxx-xxx-xxx.ngrok.io`
   - All backend traffic tunneled through this URL

2. **Starts backend server**
   - Listens on `http://localhost:3001`
   - Automatically sets `BACKEND_URL` to ngrok public URL
   - Initializes database connections
   - Loads all microservices

3. **Starts frontend server**
   - Next.js development server on `http://localhost:3000`
   - Hot reload enabled

4. **Configures VAPI webhook**
   - Webhook URL: `{ngrokUrl}/api/webhooks/vapi`
   - RAG context injection enabled
   - Event listeners configured

5. **Verifies systems**
   - Checks all ports accessible
   - Confirms webhook configuration
   - Reports status to console

---

## 📊 Expected Output

When running successfully, you should see:

```
📋 [2026-01-17T...] ================================
📋 [2026-01-17T...] STARTUP ORCHESTRATION STARTING
📋 [2026-01-17T...] ================================

📋 [2026-01-17T...] STEP 1/5: Starting ngrok tunnel
✅ [2026-01-17T...] ngrok tunnel ready at: https://xxxx-xxxx-xxxx.ngrok.io

📋 [2026-01-17T...] STEP 2/5: Starting backend server
✅ [2026-01-17T...] Backend server ready on port 3001

📋 [2026-01-17T...] STEP 3/5: Starting frontend server
✅ [2026-01-17T...] Frontend server ready on port 3000

📋 [2026-01-17T...] STEP 4/5: Configuring VAPI webhook
✅ [2026-01-17T...] VAPI webhook configuration will be applied

📋 [2026-01-17T...] STEP 5/5: Verifying all systems
✅ [2026-01-17T...] ngrok tunnel: https://xxxx-xxxx-xxxx.ngrok.io
✅ [2026-01-17T...] Backend: http://localhost:3001
✅ [2026-01-17T...] Frontend: http://localhost:3000

✅ [2026-01-17T...] ALL SYSTEMS READY FOR DEVELOPMENT
📋 [2026-01-17T...] Backend URL: https://xxxx-xxxx-xxxx.ngrok.io
📋 [2026-01-17T...] Frontend URL: http://localhost:3000
📋 [2026-01-17T...] Webhook URL: https://xxxx-xxxx-xxxx.ngrok.io/api/webhooks/vapi
```

---

## 🌐 Accessing Your Application

Once startup completes:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | `http://localhost:3000` | Web dashboard |
| **Backend (Local)** | `http://localhost:3001` | Local API access |
| **Backend (Public)** | `https://xxxx-xxxx.ngrok.io` | Public webhook URL |
| **WebSocket** | `wss://xxxx-xxxx.ngrok.io` | Real-time updates |

---

## 🔗 Testing the Webhook

### Health Check

```bash
# Test webhook is accessible
curl https://xxxx-xxxx-xxxx.ngrok.io/api/vapi/webhook/health

# Expected response
{"status": "ok", "timestamp": "2026-01-17T..."}
```

### Webhook Events

The webhook is now configured to receive:
- `call.started` - When a call begins
- `call.ended` - When a call ends
- `call.transcribed` - When speech is transcribed
- `end-of-call-report` - Final call metrics
- `function-call` - Assistant function invocations

---

## 🔐 VAPI Webhook Security

The webhook uses HMAC-SHA256 signature verification:

```typescript
// Signature is verified automatically
// Uses VAPI_WEBHOOK_SECRET from environment

// Org-specific validation prevents cross-tenant access
// Each clinic has isolated webhook processing
```

---

## 📊 RAG Integration Status

The webhook integrates with your knowledge base:

- **RAG Context Injection**: Knowledge base chunks prepended to system prompt
- **Similarity Threshold**: 0.65 (configurable)
- **Max Chunks**: 5 per query
- **Timeout**: 5 seconds (graceful degradation if slow)

---

## 🔍 Debugging

### Backend Logs

Backend logs are printed to console during startup. Look for:

- ✅ `Configuration validation passed` - All environment variables OK
- ✅ `Listening on port 3001` - Server started
- ❌ `Missing critical environment variables` - Missing `.env` variable
- ❌ `Connection timeout to Supabase` - Database unreachable

### ngrok Logs

ngrok logs show all tunneled traffic:

```bash
# View ngrok web dashboard
open http://localhost:4040
```

The dashboard shows:
- All HTTP requests/responses
- Request headers and bodies
- Response status codes
- Bandwidth usage

### Frontend Logs

Next.js development server logs:
- ✅ `ready - started server on 0.0.0.0:3000` - Server ready
- ⚠️ `warn - <filename>` - Build warnings
- ❌ `error - <message>` - Build errors

---

## 🛑 Stopping Services

### Graceful Shutdown

```bash
# Press Ctrl+C in the startup script terminal
# Script will shut down all services cleanly
```

### Manual Cleanup (if needed)

```bash
# Kill ngrok
pkill -f "ngrok http"

# Kill backend
pkill -f "src/server.ts"

# Kill frontend
pkill -f "next dev"
```

---

## ⚠️ Troubleshooting

### Port Already in Use

```bash
# Find what's using port 3000/3001
lsof -i :3000
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### ngrok Connection Fails

```bash
# Verify auth token
ngrok config check

# Re-authenticate
ngrok config add-authtoken 35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU

# Restart startup script
npm run startup
```

### Backend Fails to Start

```bash
# Check .env file has all required variables
cat backend/.env | grep -E "^[A-Z_]="

# Verify critical variables
echo "SUPABASE_URL: $SUPABASE_URL"
echo "VAPI_API_KEY: ${VAPI_API_KEY:0:10}..." # Don't expose full key

# Test configuration
cd backend
npm run build
```

### Webhook Not Receiving Events

1. Verify ngrok tunnel is active
   ```bash
   curl https://xxxx-xxxx-xxxx.ngrok.io/api/vapi/webhook/health
   ```

2. Check VAPI_WEBHOOK_SECRET is set
   ```bash
   cat backend/.env | grep VAPI_WEBHOOK_SECRET
   ```

3. Verify webhook URL in VAPI dashboard
   ```bash
   # Should match:
   https://xxxx-xxxx-xxxx.ngrok.io/api/webhooks/vapi
   ```

4. Test webhook manually
   ```bash
   curl -X POST https://xxxx-xxxx-xxxx.ngrok.io/api/webhooks/vapi \
     -H "Content-Type: application/json" \
     -d '{"type":"test","timestamp":"2026-01-17T..."}'
   ```

---

## 🔄 VAPI Webhook Configuration

The startup script automatically configures:

1. **Webhook URL**: Set to ngrok public URL + `/api/webhooks/vapi`
2. **Event Types**: All major events enabled
3. **RAG Integration**: Enabled with knowledge base context
4. **Signature Verification**: Using org-specific secrets
5. **Idempotency**: Duplicate events prevented

### Manual Configuration

If you need to reconfigure manually:

```typescript
// In backend/src/services/vapi-webhook-configurator.ts
import { configureVapiWebhook } from './vapi-webhook-configurator';

await configureVapiWebhook(
  process.env.VAPI_API_KEY,
  process.env.VAPI_ASSISTANT_ID
);
```

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review backend logs for specific errors
3. Check ngrok dashboard at `http://localhost:4040`
4. Verify all environment variables in `.env`
5. Ensure ngrok auth token is valid

---

## 🎯 Next Steps

After startup:

1. **Access Frontend**: http://localhost:3000
2. **Make Test Call**: Via VAPI phone number
3. **Check Webhook Events**: http://localhost:4040 (ngrok dashboard)
4. **View Backend Logs**: Terminal running startup script
5. **Test RAG Integration**: Query knowledge base through voice call

---

## 📝 Environment Variables Reference

For complete details on environment variables, see:
- `ENVIRONMENT_README.md` - Configuration overview
- `ENVIRONMENT_QUICK_START.md` - 5-minute setup
- `ENV_VARIABLES_ARCHITECTURE.md` - Complete architecture
- `CREDENTIALS_CHECKLIST.md` - How to gather credentials

---

**You're all set! Your development environment is now fully orchestrated and ready for testing.**
