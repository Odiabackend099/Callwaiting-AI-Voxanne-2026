#!/bin/bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# Start backend with logging
npm run start > oauth-debug.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Open OAuth URL
open "http://localhost:3001/api/google-oauth/authorize?orgId=550e8400-e29b-41d4-a716-446655440000"

# Monitor logs
tail -f oauth-debug.log | grep -A 20 -B 20 "callback"
