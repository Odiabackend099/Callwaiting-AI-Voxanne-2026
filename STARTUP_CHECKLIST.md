# 🚀 Server Startup Checklist (2026-02-05)

## Pre-Startup

- [ ] Close all existing terminal windows running `npm run dev`
- [ ] Have iTerm/Terminal.app ready
- [ ] Verify ngrok auth token is: `35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU`

---

## Step 1: Kill Old Processes (3 seconds)

Copy & paste into Terminal:

```bash
pkill -9 -f ngrok 2>/dev/null || true
pkill -9 -f "npm run dev" 2>/dev/null || true
pkill -9 -f tsx 2>/dev/null || true
sleep 2
```

**Expected output:** No errors (clean slate)

---

## Step 2: Set ngrok Auth Token (1 second)

Copy & paste into **SAME** Terminal:

```bash
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"
```

**Expected output:** No output (silent success)

---

## Step 3: Start Servers (45-80 seconds)

Copy & paste into **SAME** Terminal:

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run startup
```

**Watch for these messages in order:**

```
[1] Starting ngrok tunnel...
[2] Opening ngrok tunnel to port 3001
[3] ngrok URL: https://XXXX-XX-XX-XXXX-XX.ngrok-free.app ← SAVE THIS
[4] Starting backend on port 3001
[5] Starting frontend on port 3000
[6] VAPI webhook URL configured
[7] ✅ ALL SYSTEMS READY
```

---

## Timeline

| Step | Action | Duration | Cumulative |
|------|--------|----------|-----------|
| 1 | Kill processes | 3 sec | 3 sec |
| 2 | Set env var | 1 sec | 4 sec |
| 3 | npm startup | 60 sec | ~64 sec |
| **TOTAL** | | | **~1-2 minutes** |

---

## After "✅ ALL SYSTEMS READY"

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Dashboard UI |
| Backend API | http://localhost:3001 | API calls |
| ngrok Dashboard | http://localhost:4040 | Tunnel status |
| Webhook (public) | https://[ngrok-url]/api/webhooks/vapi | Vapi → Backend |

### Verify Servers Are Running

Open **NEW terminal tab** and run:

```bash
# Test frontend
curl http://localhost:3000 | head -20

# Test backend health
curl http://localhost:3001/health

# Check ngrok tunnel
curl http://localhost:4040/api/tunnels | grep public_url
```

**Expected:**
```
✅ Frontend returns HTML
✅ Backend returns: {"status":"ok"}
✅ ngrok returns public HTTPS URL
```

---

## Ready to Test Ghost Agent Fix

Once all systems are ready:

1. ✅ Navigate to http://localhost:3000/dashboard
2. ✅ Log in with voxanne@demo.com
3. ✅ Go to `/dashboard/test` for test call
4. ✅ Make a test call → Verify correct agent responds
5. ✅ Check backend logs for org_id verification
6. ✅ Confirm call data in database

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | Kill existing node: `pkill -9 node` |
| Port 3001 already in use | Kill existing node: `pkill -9 node` |
| ngrok token invalid | Use provided token: `35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU` |
| npm startup command not found | Ensure you're in `/backend` directory |
| Servers start but don't stay running | Check .env file has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY |

---

## Git Status

Current branch: `main`  
Latest commit: `1c6b106` - chore: verified ghost agent fix with diagnostic  
Deployment: Ready for production ✅

---

**Status:** Ready to execute  
**Date:** 2026-02-05  
**Infrastructure:** Ghost agent fix verified and deployed ✅
