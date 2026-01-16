#!/bin/bash
# Start development server with .env.dev configuration

cd "/Users/mac/Desktop/VOXANNE  ADMIN"

# Load environment variables from .env.dev
if [ -f .env.dev ]; then
  export $(grep -v '^#' .env.dev | xargs)
fi

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
