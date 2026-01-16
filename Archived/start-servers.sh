#!/bin/bash

# Kill any existing processes
pkill -f "npm run dev" 2>/dev/null
pkill -f "tsx" 2>/dev/null
pkill -f "ngrok" 2>/dev/null
sleep 2

# Start backend
echo "🚀 Starting Backend..."
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 3

# Start frontend
echo "🚀 Starting Frontend..."
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

sleep 3

# Start ngrok
echo "🚀 Starting Ngrok Tunnel..."
ngrok http 3001 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
echo "Ngrok PID: $NGROK_PID"

sleep 3

echo ""
echo "✅ All servers started!"
echo "📱 Frontend: http://localhost:3000"
echo "⚙️  Backend: http://localhost:3001"
echo "🔗 Ngrok Tunnel: (getting URL...)"
sleep 2
grep "url=" /tmp/ngrok.log 2>/dev/null | tail -1 || echo "Check: ngrok http://localhost:4040"
