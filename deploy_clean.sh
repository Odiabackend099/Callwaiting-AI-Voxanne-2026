#!/bin/bash
set -e

echo "🧹 NUCLEAR OPTION - CLEAN DEPLOYMENT"
echo "===================================="
echo ""

# Kill existing services
echo "🛑 Stopping existing services..."
lsof -ti :9121 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :9120 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

# Start clean backend
echo "🚀 Starting clean backend..."
cd "/Users/mac/Desktop/VOXANNE  WEBSITE"
python3 -m uvicorn voxanne_clean:app --host 0.0.0.0 --port 9121 --reload > clean_backend.log 2>&1 &
BACKEND_PID=$!

sleep 3

# Verify backend
echo "🔍 Verifying backend..."
if curl -s http://localhost:9121/health | grep -q "healthy"; then
    echo "✅ Backend running (PID: $BACKEND_PID)"
else
    echo "❌ Backend failed to start"
    echo "Logs:"
    cat clean_backend.log
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend..."
npm run dev -- --port 9120 > clean_frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 5

echo ""
echo "✅ DEPLOYMENT COMPLETE"
echo "====================="
echo ""
echo "📊 Status:"
echo "  Backend:  http://localhost:9121/health"
echo "  Frontend: http://localhost:9120"
echo ""
echo "🔧 Process IDs:"
echo "  Backend:  $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "  Backend:  tail -f clean_backend.log"
echo "  Frontend: tail -f clean_frontend.log"
echo ""
echo "🎤 TEST NOW:"
echo "  1. Open http://localhost:9120 in Chrome/Edge"
echo "  2. Click mic button ONCE"
echo "  3. Speak: 'Hello Voxanne, can you hear me?'"
echo "  4. Listen for TTS audio response"
echo ""
echo "🔍 Watch logs:"
echo "  tail -f clean_backend.log | grep '💬\\|🤖\\|🔊\\|📢'"
echo ""
echo "🛑 To stop:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "===================================="
