# Services Status & Quick Start Guide

**Date:** 2026-01-10  
**Purpose:** Start all services (Frontend, Backend, Ngrok)

---

## 🚀 Quick Start Commands

### Start All Services (Manual)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**Terminal 3 - Ngrok:**
```bash
ngrok http 3001
```

---

## 📊 Service Endpoints

### Frontend
- **URL:** http://localhost:3000
- **Port:** 3000
- **Status:** ✅ Running

### Backend
- **URL:** http://localhost:3001
- **Port:** 3001
- **Health:** http://localhost:3001/health
- **Status:** ✅ Running

### Ngrok Tunnel
- **Dashboard:** http://localhost:4040
- **Public URL:** (Check ngrok dashboard)
- **Webhook URL:** `{ngrok_url}/api/webhooks/vapi`
- **SMS Status:** `{ngrok_url}/api/webhooks/sms-status`
- **OAuth Callback:** `{ngrok_url}/api/google-oauth/callback`

---

## ✅ Verify Services

### Backend Health Check
```bash
curl http://localhost:3001/health
```

**Expected:** JSON with status "ok"

### OAuth Routes Test
```bash
curl http://localhost:3001/api/google-oauth/test
```

**Expected:** `{"message": "Google OAuth router is working!", ...}`

### Frontend Check
```bash
curl http://localhost:3000
```

**Expected:** HTML response (Next.js app)

---

## 🔧 Vapi Webhook Configuration

### 1. Get Ngrok URL

**Check Ngrok Dashboard:**
```
http://localhost:4040
```

**Or via API:**
```bash
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool
```

**Look for:** `"public_url": "https://xxxxx.ngrok-free.app"`

### 2. Configure Vapi Webhooks

**Webhook URLs to use:**
```
Main Webhook: {ngrok_url}/api/webhooks/vapi
SMS Status:   {ngrok_url}/api/webhooks/sms-status
OAuth Callback: {ngrok_url}/api/google-oauth/callback
```

**Update in Vapi Dashboard:**
1. Go to your Vapi assistant settings
2. Set webhook URL to: `{ngrok_url}/api/webhooks/vapi`
3. Save

---

## 🛑 Stop All Services

```bash
# Kill by port
kill $(lsof -ti:3000)  # Frontend
kill $(lsof -ti:3001)  # Backend
kill $(lsof -ti:4040)  # Ngrok

# Or kill all node processes
killall node ngrok
```

---

## 📋 Startup Checklist

- [ ] Backend server running on port 3001
- [ ] Frontend server running on port 3000
- [ ] Ngrok tunnel active (check dashboard)
- [ ] OAuth routes working (`/api/google-oauth/test`)
- [ ] Vapi webhook configured with ngrok URL

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -ti:3001

# Kill it
kill $(lsof -ti:3001)
```

### Ngrok Not Working
```bash
# Check if ngrok is installed
which ngrok

# Install if needed (macOS)
brew install ngrok

# Or download from: https://ngrok.com/download
```

### Services Not Starting
- Check logs in terminal windows
- Verify `package.json` scripts are correct
- Check for missing dependencies: `npm install`

---

**Status:** ✅ Services Starting
