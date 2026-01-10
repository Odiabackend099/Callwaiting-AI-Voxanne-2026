# 🚀 Server Status & Vapi Webhook Configuration

## Current Status

### ✅ Ngrok Tunnel (ACTIVE)
- **Public URL**: `https://sobriquetical-zofia-abysmally.ngrok-free.dev`
- **Tunneling to**: `http://localhost:3001` (Backend)
- **Status**: Running
- **Dashboard**: http://127.0.0.1:4040

### ⚠️ Backend Server (Port 3001)
- **Status**: Needs TypeScript configuration fix
- **Issue**: ts-node compilation error with moduleResolution
- **Action Required**: Fix tsconfig.json or use alternative runner

### ⚠️ Frontend Server (Port 3000)
- **Status**: Needs environment variables
- **Issue**: Missing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Action Required**: Create `.env.local` file with Supabase credentials

---

## Vapi Webhook URLs

Use these URLs to configure your Vapi assistant:

### Main Webhook (Call Events)
```
https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi
```

### RAG Webhook (Knowledge Base Injection)
```
https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/webhook
```

---

## Configuration Steps

### 1. Fix Backend Server

**Option A: Use tsx instead of ts-node (RECOMMENDED)**
```bash
cd backend
npm install --save-dev tsx
# Update package.json dev script to: "dev": "tsx src/server.ts"
```

**Option B: Fix tsconfig.json**
The current tsconfig.json needs `moduleResolution` set correctly. Try removing the ts-node section or using:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    ...
  }
}
```

### 2. Create Frontend Environment File

Create `.env.local` in the project root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Create Backend Environment File

Create `backend/.env`:
```env
PORT=3001
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
VAPI_API_KEY=your_vapi_api_key_here
VAPI_ASSISTANT_ID=your_assistant_id_here
WEBHOOK_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi
TWILIO_ACCOUNT_SID=your_twilio_sid_here
TWILIO_AUTH_TOKEN=your_twilio_token_here
```

---

## Quick Start Commands

### Start All Servers (once configured)
```bash
./start-all-servers.sh
```

### Stop All Servers
```bash
./stop-all-servers.sh
```

### Individual Server Commands

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
npm run dev
```

**Ngrok (already running):**
```bash
ngrok http 3001
```

---

## Vapi Webhook Configuration

### Via Dashboard
1. Go to https://dashboard.vapi.ai
2. Select your assistant
3. Set **Server URL** to: `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhooks/vapi`

### Via API
```bash
curl -X POST http://localhost:3001/api/vapi/setup/configure-webhook \
  -H "Content-Type: application/json"
```

---

## Troubleshooting

### Backend won't start
- Check `logs/backend.log` for errors
- Verify TypeScript version: `npx tsc --version`
- Try: `cd backend && npm install` to ensure dependencies are installed

### Frontend shows 500 error
- Check `logs/frontend.log`
- Verify `.env.local` exists with correct Supabase credentials
- Restart frontend: `pkill -f "next dev" && npm run dev`

### Ngrok URL changed
- Check ngrok dashboard: http://127.0.0.1:4040
- Update Vapi webhook URL with new ngrok URL
- Update `WEBHOOK_URL` in `backend/.env` if needed

---

## Next Steps

1. ✅ Ngrok is running - webhook URL is ready
2. ⏳ Fix backend TypeScript configuration
3. ⏳ Create frontend `.env.local` with Supabase credentials
4. ⏳ Create backend `.env` with API keys
5. ⏳ Restart servers and verify health endpoints
6. ⏳ Configure Vapi assistant with webhook URL

---

**Last Updated**: $(date)
**Ngrok URL**: https://sobriquetical-zofia-abysmally.ngrok-free.dev
