#!/bin/bash

# full-startup.sh
# Automates the entire startup sequence: Install -> Backend -> Frontend -> Ngrok -> Vapi

cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $NGROK_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 Initializing CallWaiting AI Clinical Suite..."

# 1. Install Dependencies
echo "📦 Installing Frontend Dependencies..."
npm install --silent > /dev/null 2>&1
echo "✅ Frontend dependencies installed."

echo "📦 Installing Backend Dependencies..."
cd backend
npm install --silent > /dev/null 2>&1
echo "✅ Backend dependencies installed."
cd ..

# 2. Start Ngrok
echo "🔗 Starting Ngrok Tunnel (Port 3001)..."
ngrok http 3001 > /dev/null &
NGROK_PID=$!
sleep 5

NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok[^"]*' | head -n 1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get Ngrok URL. Is Ngrok installed and running?"
    cleanup
fi

echo "✅ Ngrok Active: $NGROK_URL"
export WEBHOOK_URL="$NGROK_URL/api/vapi/webhook"

# 3. Start Backend
echo "⚙️ Starting Backend Server..."
cd backend
# Using nohup to ensure it persists and capturing output
npm run dev > ../backend-service.log 2>&1 &
BACKEND_PID=$!
cd ..

# 4. Start Frontend
echo "🎨 Starting Frontend Dashboard..."
# Using nohup and different log file
npm run dev > frontend-service.log 2>&1 &
FRONTEND_PID=$!

# 5. Wait & Configure Vapi
echo "⏳ Waiting for services to initialize (15s)..."
sleep 15

echo "🔌 Configuring Vapi Webhook..."
# We try to hit the backend to register the webhook
RESPONSE=$(curl -s -X POST http://localhost:3001/api/vapi/setup/configure-webhook \
  -H "Content-Type: application/json")

if echo "$RESPONSE" | grep -q "Vapi assistant configured"; then
    echo "✅ Vapi Webhook Registered & Synced!"
else
    echo "⚠️ Vapi Configuration Note: Check backend-service.log for details."
fi

echo ""
echo "🎉 SYSTEM ONLINE - HEALTHY"
echo "---------------------------------------------------"
echo "👉 Dashboard:  http://localhost:3000/dashboard"
echo "👉 Backend:    http://localhost:3001"
echo "👉 Webhook:    $WEBHOOK_URL"
echo "👉 Logs:       tail -f backend-service.log frontend-service.log"
echo "---------------------------------------------------"
echo "Press Ctrl+C to stop all services."

# Keep script running
wait $BACKEND_PID $FRONTEND_PID
