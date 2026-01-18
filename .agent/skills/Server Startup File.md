# Server Startup File

**Purpose**: Reference guide for AI to automatically start all servers (frontend, backend, ngrok tunnel, and VAPI webhook configuration)

**Location**: `.agent/skills/Server Startup File.md`

**Version**: 1.0
**Last Updated**: January 17, 2026

---

## 🎯 AI INSTRUCTION: How to Use This File

When the user asks you to start servers, follow this exact procedure:

1. Read this entire file to understand the startup sequence
2. Execute each step in the order specified below
3. Verify each service starts successfully before proceeding to next step
4. Report status after each major component starts
5. Provide user with final summary showing all access points

---

## ⚡ QUICK START (For AI - Execute This)

```bash
# Step 1: Set ngrok auth token
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"

# Step 2: Start the orchestration script (this starts everything)
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run startup
```

**That's it!** The startup script will handle:
- ✅ Starting ngrok tunnel
- ✅ Starting backend server
- ✅ Starting frontend server
- ✅ Configuring VAPI webhook
- ✅ Verifying all systems

---

## 📋 DETAILED STARTUP SEQUENCE

### Prerequisites Check (Before Starting)

AI should verify:
- [ ] ngrok is installed: `which ngrok`
- [ ] Node.js available: `node --version`
- [ ] npm available: `npm --version`
- [ ] Project directory exists: `/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026`
- [ ] Backend `.env` file exists: `/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/.env`
- [ ] All required env vars in `.env` (SUPABASE_URL, VAPI_API_KEY, ENCRYPTION_KEY, OPENAI_API_KEY)

### Step 1: Kill Any Existing Processes

```bash
pkill -9 -f ngrok 2>/dev/null || echo "No ngrok process found"
pkill -9 -f "npm run dev" 2>/dev/null || echo "No npm dev found"
pkill -9 -f tsx 2>/dev/null || echo "No tsx process found"
sleep 2
```

**Expected**: All previous server processes terminated

### Step 2: Set ngrok Auth Token

```bash
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"
```

**Expected**: Environment variable set (no output)

### Step 3: Execute Startup Script

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run startup
```

**What This Does**:
1. Starts ngrok tunnel (creates public URL)
2. Extracts public URL from ngrok API
3. Sets BACKEND_URL and WEBHOOK_URL to ngrok public URL
4. Starts backend server on port 3001
5. Starts frontend server on port 3000
6. Configures VAPI webhook automatically
7. Verifies all systems operational

**Expected Output** (Watch for this):
```
✅ ngrok tunnel ready at: https://xxxx-xxxx-xxxx.ngrok-free.dev
✅ Backend server ready on port 3001
✅ Frontend server ready on port 3000
✅ VAPI webhook configuration will be applied
✅ ALL SYSTEMS READY FOR DEVELOPMENT
```

### Step 4: Verify All Systems Are Running (While Script Running)

In a separate terminal, run verification:

```bash
# Check listening ports
lsof -i -P -n 2>/dev/null | grep LISTEN | grep -E ":300[01]|:404[01]"

# Expected output:
# node  ... TCP *:3000 (LISTEN)     # Frontend
# node  ... TCP *:3001 (LISTEN)     # Backend
# ngrok ... TCP 127.0.0.1:4040 (LISTEN)  # ngrok dashboard
```

### Step 5: Verify Webhook Health

```bash
# Wait for backend to be fully ready, then test:
curl -s https://xxxx-xxxx-xxxx.ngrok-free.dev/api/vapi/webhook/health

# Expected response:
# {"status":"healthy","service":"vapi-webhook"}
```

---

## 🌐 ACCESS POINTS (Provide to User After Startup)

### Development URLs
```
Frontend:        http://localhost:3000
Backend (local): http://localhost:3001
ngrok Dashboard: http://localhost:4040
```

### Public Webhook URLs (for VAPI Configuration)
```
Main Webhook:    https://[ngrok-url]/api/webhooks/vapi
RAG Webhook:     https://[ngrok-url]/api/vapi/webhook
Health Check:    https://[ngrok-url]/api/vapi/webhook/health
```

### Replace [ngrok-url] with actual public URL
Example: `https://sobriquetical-zofia-abysmally.ngrok-free.dev`

---

## 📊 ENVIRONMENT VARIABLES REQUIRED

Before starting, verify backend/.env has these (AI should check):

```bash
# Critical Variables
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...  (long JWT token)
VAPI_API_KEY=c08c442b-cc56-4a05-8bfa-34d46a5efccd
ENCRYPTION_KEY=your-256-bit-hex-key-here
OPENAI_API_KEY=sk-proj-...

# Backend Ports
NODE_ENV=development
PORT=3001

# URLs (will be overridden by startup script)
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
```

**Verification Command**:
```bash
grep -E "^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|VAPI_API_KEY|ENCRYPTION_KEY)" \
  /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/.env
```

---

## 🛑 TROUBLESHOOTING (AI Reference)

### Issue: ngrok says endpoint already online
**Solution**: Kill existing ngrok and try again
```bash
pkill -9 -f ngrok
sleep 2
# Retry startup
```

### Issue: Port 3000 or 3001 already in use
**Solution**: Kill the process using the port
```bash
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
# Retry startup
```

### Issue: Missing SUPABASE_URL error
**Solution**: Add it to `.env` file
```bash
# Check if missing
grep "^SUPABASE_URL" /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/.env

# If missing, add line to .env:
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
```

### Issue: Backend won't start - missing environment variable
**Solution**: Check all required vars
```bash
# Run this to see what's missing
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run dev 2>&1 | grep "Missing required"
```

### Issue: Webhook not responding
**Solution**: Verify ngrok tunnel is active and public URL is correct
```bash
# Check ngrok API for current URL
curl -s http://localhost:4041/api/tunnels | python3 -m json.tool | grep public_url

# Test webhook health
curl -s https://[ngrok-url]/api/vapi/webhook/health
```

---

## ⏰ EXPECTED TIMING

- Kill processes: 3 seconds
- Start ngrok: 5-10 seconds
- Start backend: 10-20 seconds
- Start frontend: 10-20 seconds
- Verify systems: 5-10 seconds
- **Total**: ~45-80 seconds

---

## ✅ SUCCESS INDICATORS (AI: Watch For These)

### Startup Script Shows:
```
✅ ngrok tunnel ready at: https://...
✅ Backend server ready on port 3001
✅ Frontend server ready on port 3000
✅ ALL SYSTEMS READY FOR DEVELOPMENT
```

### Port Check Shows:
```
Node on :3000 (LISTEN)  ← Frontend
Node on :3001 (LISTEN)  ← Backend
ngrok on :4040 (LISTEN) ← Dashboard
```

### Webhook Test Shows:
```
{"status":"healthy","service":"vapi-webhook"}
```

---

## 🔄 AUTOMATED STARTUP SCRIPT DETAILS

**File**: `backend/scripts/startup-orchestration.ts`

**What It Does**:
1. Verifies ngrok auth token is set
2. Spawns ngrok process with `--log=stdout --region=us`
3. Queries ngrok API on http://localhost:4040/api/tunnels
4. Extracts public URL from first HTTP tunnel
5. Sets environment variables:
   - BACKEND_URL = [ngrok-public-url]
   - WEBHOOK_URL = [ngrok-public-url]/api/webhooks/vapi
6. Spawns backend: `npm run dev`
7. Spawns frontend: `npm run dev` (from root directory)
8. Waits for backend port 3001 to be accessible
9. Waits for frontend port 3000 to be accessible
10. Reports completion status
11. Stays running (logs all output to console)
12. Gracefully shuts down all processes on Ctrl+C

**npm Script**:
```json
"startup": "ts-node scripts/startup-orchestration.ts"
```

---

## 📖 RELATED DOCUMENTATION

For more detailed information, user can reference:

- **STARTUP_GUIDE.md** - Complete setup and troubleshooting
- **STARTUP_QUICK_REFERENCE.md** - Quick commands
- **WEBHOOK_CONFIGURATION_GUIDE.md** - Webhook details
- **LIVE_SESSION_STATUS.md** - Current system status
- **STARTUP_INDEX.md** - Navigation hub

---

## 🎯 SUMMARY FOR AI WHEN STARTING SERVERS

**Use this exact procedure**:

```bash
# 1. Kill old processes
pkill -9 -f ngrok 2>/dev/null || true
pkill -9 -f "npm run dev" 2>/dev/null || true
pkill -9 -f tsx 2>/dev/null || true
sleep 2

# 2. Set auth token
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"

# 3. Start everything (this is the main command)
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run startup

# 4. Wait for completion (~60 seconds)
# Watch for: "✅ ALL SYSTEMS READY FOR DEVELOPMENT"

# 5. Report to user with these access points:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# ngrok Dashboard: http://localhost:4040
# Public Webhook: https://[ngrok-url]/api/webhooks/vapi
```

---

## 🔐 IMPORTANT SECURITY NOTES

- ✅ ngrok auth token is the one provided by user
- ✅ All credentials come from backend/.env file
- ✅ Never hardcode credentials in scripts
- ✅ VAPI_API_KEY is sensitive - keep secure
- ✅ ngrok URL changes each restart (free tier limitation)
- ✅ All webhook communication is HTTPS (encrypted)
- ✅ Multi-tenant data isolation maintained
- ✅ No credentials exposed in logs

---

## 📞 WHEN TO RESTART SERVERS

AI should restart servers when:
- User explicitly asks to start servers
- User says "startup"
- User says "start the servers"
- User says "run npm run startup"
- User says "begin development"
- User wants to test webhook changes
- After code changes that need restart

---

## 🛑 HOW TO STOP SERVERS

When user asks to stop or when done:

```bash
# Press Ctrl+C in the startup terminal (graceful shutdown)
# OR in another terminal:
pkill -9 -f ngrok
pkill -9 -f "npm run dev"
pkill -9 -f tsx
```

---

## ✨ NEXT STEPS AFTER STARTUP

After servers are running, user can:
1. Access frontend at http://localhost:3000
2. Make VAPI calls to public webhook URL
3. Monitor webhook traffic at http://localhost:4040
4. Run webhook verification: `npm run verify:webhook`
5. Check backend logs in startup terminal
6. Test RAG knowledge base queries
7. Verify multi-tenant SMS delivery

---

**This file is the reference guide for AI-assisted server startup.**
**All commands, URLs, and procedures are documented here.**
**Keep this file updated as the system evolves.**

**Version: 1.0**
**Last Updated: January 17, 2026**
**Status: Production Ready**
