#!/bin/bash
# =============================================================================
# STOP ALL SERVERS - Frontend, Backend, Ngrok
# =============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  🛑 STOPPING ALL SERVERS"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Stop processes by PID files
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "${GREEN}✅ Stopped backend server (PID: $BACKEND_PID)${NC}"
    else
        echo "⚠️  Backend process not found (may have already stopped)"
    fi
    rm -f logs/backend.pid
fi

if [ -f logs/frontend.pid ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID 2>/dev/null
        echo -e "${GREEN}✅ Stopped frontend server (PID: $FRONTEND_PID)${NC}"
    else
        echo "⚠️  Frontend process not found (may have already stopped)"
    fi
    rm -f logs/frontend.pid
fi

if [ -f logs/ngrok.pid ]; then
    NGROK_PID=$(cat logs/ngrok.pid)
    if ps -p $NGROK_PID > /dev/null 2>&1; then
        kill $NGROK_PID 2>/dev/null
        echo -e "${GREEN}✅ Stopped ngrok tunnel (PID: $NGROK_PID)${NC}"
    else
        echo "⚠️  Ngrok process not found (may have already stopped)"
    fi
    rm -f logs/ngrok.pid
fi

# Also kill any remaining processes on the ports
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Kill any remaining ngrok processes
pkill -f "ngrok http 3001" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  ✅ ALL SERVERS STOPPED"
echo "=========================================="
