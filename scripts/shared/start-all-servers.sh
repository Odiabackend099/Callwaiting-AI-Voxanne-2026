#!/bin/bash
# =============================================================================
# START ALL SERVERS - Frontend, Backend, Ngrok for Vapi Webhooks
# =============================================================================

set -e

echo "=========================================="
echo "  🚀 VOXANNE - STARTING ALL SERVERS"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required commands exist
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v ngrok >/dev/null 2>&1 || { echo "⚠️  ngrok not found. Install from https://ngrok.com/download" >&2; }

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "=========================================="
    echo "  🛑 SHUTTING DOWN SERVERS"
    echo "=========================================="
    
    # Kill all background jobs
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Kill specific processes if PIDs exist
    [ -f logs/backend.pid ] && kill $(cat logs/backend.pid) 2>/dev/null || true
    [ -f logs/frontend.pid ] && kill $(cat logs/frontend.pid) 2>/dev/null || true
    [ -f logs/ngrok.pid ] && kill $(cat logs/ngrok.pid) 2>/dev/null || true
    
    echo "✅ All servers stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# =============================================================================
# 1. START BACKEND SERVER (Port 3001)
# =============================================================================
echo -e "${BLUE}[1/3]${NC} Starting Backend Server (Port 3001)..."

cd backend

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Warning: backend/.env not found. Using environment defaults.${NC}"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d node_modules ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Start backend in background
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid

cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"
    echo "   📝 Logs: logs/backend.log"
else
    echo -e "❌ Backend server failed to start. Check logs/backend.log"
    exit 1
fi

# =============================================================================
# 2. START FRONTEND SERVER (Port 3000)
# =============================================================================
echo ""
echo -e "${BLUE}[2/3]${NC} Starting Frontend Server (Port 3000)..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}⚠️  Warning: .env.local not found. Using environment defaults.${NC}"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d node_modules ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend in background
npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > logs/frontend.pid

# Wait a moment for frontend to start
sleep 3

# Check if frontend started successfully
if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✅ Frontend server started (PID: $FRONTEND_PID)${NC}"
    echo "   📝 Logs: logs/frontend.log"
else
    echo -e "❌ Frontend server failed to start. Check logs/frontend.log"
    exit 1
fi

# =============================================================================
# 3. START NGROK TUNNEL (Port 3001 for Backend Webhooks)
# =============================================================================
echo ""
echo -e "${BLUE}[3/3]${NC} Starting Ngrok Tunnel (Port 3001)..."

if command -v ngrok >/dev/null 2>&1; then
    # Start ngrok in background
    ngrok http 3001 --log=stdout > logs/ngrok.log 2>&1 &
    NGROK_PID=$!
    echo $NGROK_PID > logs/ngrok.pid
    
    # Wait for ngrok to start and get the URL
    sleep 5
    
    # Try to get the ngrok URL from the API
    NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$NGROK_URL" ]; then
        echo -e "${GREEN}✅ Ngrok tunnel started${NC}"
        echo "   🌐 Public URL: $NGROK_URL"
        echo ""
        echo -e "${YELLOW}📋 VAPI WEBHOOK CONFIGURATION:${NC}"
        echo "   Webhook URL: ${NGROK_URL}/api/webhooks/vapi"
        echo "   RAG Webhook URL: ${NGROK_URL}/api/vapi/webhook"
        echo ""
        echo "   Update your Vapi assistant configuration with these URLs:"
        echo "   1. Go to https://dashboard.vapi.ai"
        echo "   2. Edit your assistant"
        echo "   3. Set Server URL to: ${NGROK_URL}/api/webhooks/vapi"
        echo "   4. Or use the API endpoint: POST /api/vapi/setup/configure-webhook"
    else
        echo -e "${YELLOW}⚠️  Ngrok started but couldn't fetch public URL.${NC}"
        echo "   Check ngrok dashboard: http://127.0.0.1:4040"
        echo "   Logs: logs/ngrok.log"
    fi
else
    echo -e "${YELLOW}⚠️  ngrok not installed. Skipping tunnel setup.${NC}"
    echo "   Install from: https://ngrok.com/download"
    echo "   For local development, webhooks will use: http://localhost:3001/api/webhooks/vapi"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=========================================="
echo "  ✅ ALL SERVERS STARTED"
echo "=========================================="
echo ""
echo -e "${GREEN}Frontend:${NC}  http://localhost:3000"
echo -e "${GREEN}Backend:${NC}   http://localhost:3001"
echo -e "${GREEN}Health:${NC}    http://localhost:3001/health"
if [ ! -z "$NGROK_URL" ]; then
    echo -e "${GREEN}Ngrok:${NC}     $NGROK_URL"
    echo -e "${GREEN}Webhook:${NC}   $NGROK_URL/api/webhooks/vapi"
fi
echo ""
echo "📝 Logs:"
echo "   - Backend:  tail -f logs/backend.log"
echo "   - Frontend: tail -f logs/frontend.log"
if [ ! -z "$NGROK_PID" ]; then
    echo "   - Ngrok:    tail -f logs/ngrok.log"
    echo "   - Ngrok UI: http://127.0.0.1:4040"
fi
echo ""
echo "🛑 To stop all servers: Press Ctrl+C or run ./stop-all-servers.sh"
echo ""
echo "=========================================="

# Keep script running
wait
