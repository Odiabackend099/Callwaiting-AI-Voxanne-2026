#!/bin/bash

# Start All Services Script
# Starts frontend, backend, and ngrok tunnel for Voxanne

set -e

echo "🚀 Starting Voxanne Services..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    if lsof -ti:$1 > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $1 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is free${NC}"
        return 0
    fi
}

# Check ports
echo "📋 Checking ports..."
check_port 3000
check_port 3001
check_port 4040
echo ""

# Start Backend Server (Port 3001)
echo "🔧 Starting Backend Server (port 3001)..."
cd "$(dirname "$0")/backend" || exit 1
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: logs/backend.log"
sleep 3

# Verify backend is running
if lsof -ti:3001 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server started${NC}"
else
    echo -e "${YELLOW}⚠️  Backend server may not have started - check logs/backend.log${NC}"
fi

# Start Frontend Server (Port 3000)
echo ""
echo "🎨 Starting Frontend Server (port 3000)..."
cd "$(dirname "$0")" || exit 1
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Logs: logs/frontend.log"
sleep 3

# Verify frontend is running
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend server started${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend server may not have started - check logs/frontend.log${NC}"
fi

# Start Ngrok Tunnel
echo ""
echo "🌐 Starting Ngrok Tunnel..."
if command -v ngrok &> /dev/null; then
    ngrok http 3001 > logs/ngrok.log 2>&1 &
    NGROK_PID=$!
    echo "   Ngrok PID: $NGROK_PID"
    echo "   Logs: logs/ngrok.log"
    sleep 5
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)
    if [ -n "$NGROK_URL" ]; then
        echo -e "${GREEN}✅ Ngrok tunnel: $NGROK_URL${NC}"
        echo ""
        echo "📋 Vapi Webhook URL:"
        echo "   $NGROK_URL/api/webhooks/vapi"
        echo "   $NGROK_URL/api/webhooks/sms-status"
        echo "   $NGROK_URL/api/google-oauth/callback"
    else
        echo -e "${YELLOW}⚠️  Ngrok started but URL not available yet${NC}"
        echo "   Check: http://localhost:4040 for ngrok dashboard"
    fi
else
    echo -e "${YELLOW}⚠️  Ngrok not found - install with: brew install ngrok${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All services started!"
echo ""
echo "📊 Service Status:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Ngrok:    http://localhost:4040 (dashboard)"
if [ -n "$NGROK_URL" ]; then
    echo "   Public:   $NGROK_URL"
fi
echo ""
echo "📝 Process IDs (to kill later):"
echo "   Backend:  $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
if [ -n "$NGROK_PID" ]; then
    echo "   Ngrok:    $NGROK_PID"
fi
echo ""
echo "🛑 To stop all services:"
echo "   kill $BACKEND_PID $FRONTEND_PID $NGROK_PID"
echo "   Or: killall node ngrok"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
