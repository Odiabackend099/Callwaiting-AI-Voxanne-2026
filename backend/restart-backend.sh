#!/bin/bash

echo "🔄 Restarting Voxanne Backend..."
echo "================================"

# Kill existing backend process
echo "1. Stopping existing backend..."
pkill -f "tsx.*server.ts"
sleep 2

# Verify port is free
if lsof -ti:3001 > /dev/null 2>&1; then
  echo "   ⚠️  Warning: Port 3001 still in use. Forcing kill..."
  lsof -ti:3001 | xargs kill -9
  sleep 1
fi

echo "   ✅ Backend stopped"

# Start backend
echo "2. Starting backend with new token refresh logic..."
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# Start in background with nohup
nohup npm run dev > logs/backend-restart.log 2>&1 &

# Wait for startup
sleep 5

# Check if it started
if lsof -ti:3001 > /dev/null 2>&1; then
  echo "   ✅ Backend started successfully on port 3001"
  echo ""
  echo "3. Testing health endpoint..."
  curl -s http://localhost:3001/health | json_pp 2>/dev/null || curl -s http://localhost:3001/health
  echo ""
  echo ""
  echo "✅ RESTART COMPLETE"
  echo ""
  echo "📋 Next Steps:"
  echo "   1. Run database test: node test-sms-calendar-e2e.js"
  echo "   2. Trigger test booking (via Vapi call or API)"
  echo "   3. Monitor logs: tail -f logs/backend-restart.log"
  echo ""
else
  echo "   ❌ Backend failed to start"
  echo "   Check logs: cat logs/backend-restart.log"
  exit 1
fi
