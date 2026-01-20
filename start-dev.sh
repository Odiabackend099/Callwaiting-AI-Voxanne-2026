#!/bin/bash
echo "Starting development environment..."
echo " - Frontend: http://localhost:3000"
echo " - Backend: http://localhost:3001"
echo " - Ngrok: http://localhost:4040"

# Use npx concurrently to run all commands
npx concurrently --kill-others \
  --names "FRONT,BACK,NGROK" \
  --prefix-colors "blue,green,yellow" \
  "npm run dev" \
  "cd backend && npm run dev" \
  "ngrok http 3001"
