#!/bin/bash

# Backend Server Startup Script with Redis Configuration
# Uses full paths to avoid PATH issues

export PATH="/usr/local/Cellar/node@22/22.22.0/bin:$PATH"
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"
export NODE_ENV=production
export PORT=3001

echo "🚀 Starting Callwaiting AI Backend Server..."
echo "📍 Location: $(pwd)"
echo "🔴 Redis: rediss://cuddly-akita-61893.upstash.io:6379"
echo "⏱️  Timestamp: $(date)"
echo ""

# Kill any existing processes
echo "🧹 Cleaning up old processes..."
pkill -9 -f ngrok 2>/dev/null || true
pkill -9 -f "npm run dev" 2>/dev/null || true
pkill -9 -f tsx 2>/dev/null || true
sleep 2

# Verify environment
echo "✅ Verifying environment..."
node --version
npm --version
echo ""

# Start the server
echo "🎯 Starting npm run startup..."
npm run startup
