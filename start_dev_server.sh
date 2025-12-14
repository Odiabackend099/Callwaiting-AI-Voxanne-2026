#!/bin/bash
# Start development server with .env.dev configuration

cd "/Users/mac/Desktop/VOXANNE  ADMIN"

# Load environment variables from .env.dev
export DEEPGRAM_API_KEY=c0f60c39e1994c1c708649f89d37f3873c88974e
export GROQ_API_KEY=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
export SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
export SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA
export TWILIO_ACCOUNT_SID=AC0a90c92cbd17b575fde9ec6e817b71af
export TWILIO_AUTH_TOKEN=11c1e5e1069e38f99a2f8c35b8baaef8
export TWILIO_PHONE_NUMBER=+19523338443
export ERPAPI_KEY=bca65b856835e869adebff31648f272f551b022ed0618c26ea7b2682034cdb42
export N8N_WEBHOOK_BASE=https://leads-cwai.app.n8n.cloud/webhook/c2ef7825-e23d-4d31-ae3e-c74ecd69d294
export PORT=8001
export PUBLIC_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
export AGENT_NAME=Voxanne
export NEXT_PUBLIC_AGENT_NAME=Voxanne
export ENABLE_HUMANIZER=true
export ENABLE_BARGE_IN_V2=true
export ENDPOINT_MS=150
export ENABLE_SEMANTIC_ENDPOINTING=true

# Start server in background
nohup python3 voxanne_v2.py > dev_server.log 2>&1 &
echo $! > dev_server.pid

echo "✅ Development server starting..."
sleep 3

# Check if server started successfully
if lsof -i:8001 > /dev/null 2>&1; then
  echo "✅ Server running on port 8001"
  echo "📝 PID: $(cat dev_server.pid)"
  echo "📞 Test number: +1 952 333 8443"
  echo ""
  echo "View logs: tail -f dev_server.log"
  echo "Stop server: kill $(cat dev_server.pid)"
else
  echo "❌ Server failed to start"
  echo "Check logs: cat dev_server.log"
fi
