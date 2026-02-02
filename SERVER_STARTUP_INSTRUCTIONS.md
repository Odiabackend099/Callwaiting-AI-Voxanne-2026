# Backend Server Startup Instructions

**Status:** ✅ Redis URL configured, ready to start  
**Redis:** `rediss://default:AfHFAAIncDE3ZDNkMzBhOTk1MDA0ZDJhYTk4MWRjNmU5Mzc5MTVmNHAxNjE4OTM@cuddly-akita-61893.upstash.io:6379`

---

## Quick Start (Copy & Paste)

Open a terminal and run:

```bash
# Navigate to backend
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# Set ngrok auth token
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"

# Start the server (this starts ngrok + backend + frontend)
npm run startup
```

**Expected Output:**
```
✅ ngrok tunnel ready at: https://xxxx-xxxx-xxxx.ngrok-free.dev
✅ Backend server ready on port 3001
✅ Frontend server ready on port 3000
✅ ALL SYSTEMS READY FOR DEVELOPMENT
```

---

## What's Running

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend | 3001 | http://localhost:3001 |
| ngrok Dashboard | 4040 | http://localhost:4040 |
| Redis | 6379 | rediss://cuddly-akita-61893.upstash.io:6379 |

---

## Verify Server is Running

In a separate terminal:

```bash
# Check ports
lsof -i -P -n | grep -E ":300[01]|:404[01]"

# Test backend health
curl http://localhost:3001/api/vapi/webhook/health

# Expected response:
# {"status":"healthy","service":"vapi-webhook"}
```

---

## Environment Configuration

✅ **Redis URL:** Updated in `backend/.env`
```
REDIS_URL=rediss://default:AfHFAAIncDE3ZDNkMzBhOTk1MDA0ZDJhYTk4MWRjNmU5Mzc5MTVmNHAxNjE4OTM@cuddly-akita-61893.upstash.io:6379
```

✅ **ngrok Token:** Set in environment
```
NGROK_AUTH_TOKEN=35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU
```

---

## Troubleshooting

### Port Already in Use
```bash
# Kill existing processes
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
pkill -9 -f ngrok
```

### npm Not Found
```bash
# Use full path to Node.js
/usr/local/Cellar/node@22/22.22.0/bin/npm run startup
```

### Redis Connection Issues
```bash
# Verify Redis URL in .env
grep REDIS_URL backend/.env

# Test Redis connection
redis-cli -u rediss://default:AfHFAAIncDE3ZDNkMzBhOTk1MDA0ZDJhYTk4MWRjNmU5Mzc5MTVmNHAxNjE4OTM@cuddly-akita-61893.upstash.io:6379 ping
```

---

## Stop Servers

Press `Ctrl+C` in the startup terminal, or:

```bash
pkill -9 -f ngrok
pkill -9 -f "npm run dev"
pkill -9 -f tsx
```

---

## Next Steps After Startup

1. ✅ Frontend available at http://localhost:3000
2. ✅ Backend API at http://localhost:3001
3. ✅ ngrok public URL for VAPI webhooks
4. ✅ Redis connected for caching/sessions
5. ✅ All 3 critical gaps fixed and ready for demo

---

**Ready to start? Run the Quick Start commands above!**
