#!/bin/bash

# dev-start.sh
# Orchestrates local development with Ngrok and Vapi Webhook functionality

# Function to cleanup background processes on exit
cleanup() {
    echo "Stopping background processes..."
    kill $NGROK_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 Starting Voxanne Dev Environment..."

# 1. Start Ngrok
echo "Canalizing Ngrok Tunnel..."
ngrok http 3001 > /dev/null &
NGROK_PID=$!
sleep 5

# 2. Get Public URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*ngrok[^"]*' | head -n 1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get Ngrok URL. Is Ngrok installed and authenticated?"
    cleanup
fi

echo "✅ Ngrok Active: $NGROK_URL"
export WEBHOOK_URL="$NGROK_URL/api/vapi/webhook"

# 3. Start Backend
echo "Starting Backend Server on Port 3001..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# 4. Wait for Server & Configure Vapi
echo "Waiting for backend to initialize..."
sleep 15 # Give the backend time to compile/start

echo "🔌 Configuring Vapi Webhook..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/vapi/setup/configure-webhook \
  -H "Content-Type: application/json")

if echo "$RESPONSE" | grep -q "Vapi assistant configured"; then
    echo "✅ Vapi Webhook Registered Successfully!"
    echo "   URL: $WEBHOOK_URL"
else
    echo "⚠️  Vapi Configuration Warning (check logs):"
    echo "$RESPONSE"
fi

echo "🎉 Dev Environment Ready!"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000 (run 'npm run dev' in separate terminal)"
echo "Press Ctrl+C to stop."

# Keep script running to maintain background processes
wait $BACKEND_PID
