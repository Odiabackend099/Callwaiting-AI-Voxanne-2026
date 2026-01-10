# Servers Status

## Development Servers

### Frontend (Next.js)
- **Status**: Running
- **Port**: 3000
- **URL**: http://localhost:3000
- **Log**: `logs/frontend.log`
- **Command**: `npm run dev`

### Backend (Node.js/Express)
- **Status**: Running
- **Port**: 3001
- **URL**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Log**: `logs/backend.log`
- **Command**: `cd backend && npm run dev`

### Ngrok (Webhook Tunnel)
- **Status**: Running
- **Tunnel**: Backend (port 3001)
- **Webhook URL**: Check ngrok dashboard at http://127.0.0.1:4040
- **Log**: `logs/ngrok.log`
- **Command**: `ngrok http 3001`

## Vapi Webhook Configuration

### Get Ngrok Public URL
```bash
curl http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url'
```

### Vapi Webhook Endpoints
Configure the following webhook URLs in Vapi Dashboard:

**Base URL**: `https://[your-ngrok-url]`

**Endpoints**:
- `/api/vapi/webhook` - Main webhook handler
- `/api/webhooks/vapi` - Alternative webhook handler

**Full URL Example**:
```
https://abc123.ngrok-free.app/api/vapi/webhook
```

### Webhook Configuration Steps

1. **Get your ngrok URL**:
   ```bash
   curl http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[] | select(.proto=="https") | .public_url'
   ```

2. **Copy the HTTPS URL** (starts with `https://`)

3. **Configure in Vapi Dashboard**:
   - Go to Settings → Webhooks
   - Set Webhook URL: `https://[your-ngrok-url]/api/vapi/webhook`
   - Enable all event types (call_started, call_ended, etc.)

4. **Verify webhook**:
   - Make a test call through Vapi
   - Check backend logs: `tail -f logs/backend.log`
   - Look for webhook POST requests

## Quick Start Commands

### Start All Servers
```bash
# Backend
cd backend && npm run dev > ../logs/backend.log 2>&1 &

# Frontend
npm run dev > logs/frontend.log 2>&1 &

# Ngrok
ngrok http 3001 --log=stdout > logs/ngrok.log 2>&1 &
```

### Stop All Servers
```bash
pkill -f "next dev"
pkill -f "tsx.*server"
pkill -f "ngrok"
```

### Check Server Status
```bash
# Check if processes are running
ps aux | grep -E "(next dev|tsx.*server|ngrok)" | grep -v grep

# Check backend health
curl http://localhost:3001/health

# Check frontend
curl http://localhost:3000

# Get ngrok URL
curl http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url'
```

## Troubleshooting

### Backend not starting
- Check `logs/backend.log` for errors
- Verify `.env` file exists in `backend/` directory
- Ensure port 3001 is not in use: `lsof -i :3001`

### Frontend not starting
- Check `logs/frontend.log` for errors
- Verify `.env.local` exists in project root
- Ensure port 3000 is not in use: `lsof -i :3000`

### Ngrok not working
- Check `logs/ngrok.log` for errors
- Verify ngrok is installed: `which ngrok`
- Ensure ngrok dashboard is accessible: http://127.0.0.1:4040

### Webhooks not received
- Verify ngrok URL is correct in Vapi dashboard
- Check backend logs for incoming requests
- Ensure webhook URL uses HTTPS (not HTTP)
- Verify Vapi webhook secret matches if configured
