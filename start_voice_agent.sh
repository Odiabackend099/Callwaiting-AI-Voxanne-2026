#!/bin/bash
set -e

echo "========================================"
echo "VOXANNE VOICE AGENT - STARTUP SCRIPT"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Kill existing processes
echo ""
echo -e "${YELLOW}Step 1/5: Stopping existing processes...${NC}"
lsof -ti :9121 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Killed backend on port 9121${NC}" || echo "No existing backend on 9121"
lsof -ti :9120 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✅ Killed frontend on port 9120${NC}" || echo "No existing frontend on 9120"

# Step 2: Verify API keys
echo ""
echo -e "${YELLOW}Step 2/5: Verifying API keys...${NC}"

# Test Deepgram
DEEPGRAM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3" \
  -H "Authorization: Token c0f60c39e1994c1c708649f89d37f3873c88974e" \
  -H "Content-Type: application/json" \
  -d '{"text":"test"}')

if [ "$DEEPGRAM_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Deepgram API key valid${NC}"
else
    echo -e "${RED}❌ Deepgram API key invalid (HTTP $DEEPGRAM_STATUS)${NC}"
    exit 1
fi

# Test Groq
GROQ_TEST=$(curl -s -X POST "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer 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" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"hi"}],"max_tokens":5}')

if echo "$GROQ_TEST" | grep -q "choices"; then
    echo -e "${GREEN}✅ Groq API key valid${NC}"
else
    echo -e "${RED}❌ Groq API key invalid${NC}"
    exit 1
fi

# Step 3: Start backend
echo ""
echo -e "${YELLOW}Step 3/5: Starting backend on port 9121...${NC}"
python3 -m uvicorn roxanne_v2:app --host 0.0.0.0 --port 9121 --reload > backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in {1..10}; do
    if curl -s http://localhost:9121/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is ready${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Backend failed to start${NC}"
        cat backend.log
        exit 1
    fi
    sleep 1
done

# Step 4: Test deep health check
echo ""
echo -e "${YELLOW}Step 4/5: Running deep health check...${NC}"
HEALTH_CHECK=$(curl -s http://localhost:9121/health/deep)
echo "$HEALTH_CHECK" | python3 -m json.tool

if echo "$HEALTH_CHECK" | grep -q '"status".*"healthy"'; then
    echo -e "${GREEN}✅ All external dependencies healthy${NC}"
else
    echo -e "${RED}❌ Some dependencies are unhealthy${NC}"
    exit 1
fi

# Step 5: Start frontend
echo ""
echo -e "${YELLOW}Step 5/5: Starting frontend on port 9120...${NC}"
npm run dev -- --port 9120 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"

# Wait for frontend to be ready
echo "Waiting for frontend to start..."
sleep 5

echo ""
echo "========================================"
echo -e "${GREEN}✅ SETUP COMPLETE${NC}"
echo "========================================"
echo ""
echo "📊 Status:"
echo "  Backend:  http://localhost:9121/health"
echo "  Frontend: http://localhost:9120"
echo "  WebSocket: ws://localhost:9121/ws/web-client"
echo ""
echo "📝 Logs:"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo "🔧 Process IDs:"
echo "  Backend PID:  $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""
echo "🛑 To stop:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "🎤 Next Steps:"
echo "  1. Open http://localhost:9120 in Chrome/Edge"
echo "  2. Click the voice widget mic button"
echo "  3. Grant microphone permissions"
echo "  4. Speak: 'Hello Voxanne, can you hear me?'"
echo "  5. Watch backend.log for diagnostic logs"
echo ""
echo "========================================"
