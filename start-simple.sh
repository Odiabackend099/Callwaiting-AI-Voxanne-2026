#!/bin/bash

# ============================================
# Voxanne AI - Simple 3-Terminal Startup
# ============================================
# This script provides instructions for manual 3-terminal startup
# Use this if you don't have tmux or prefer manual control
# ============================================

echo "🚀 Voxanne AI - Manual Startup Instructions"
echo "==========================================="
echo ""
echo "You'll need 3 terminal windows. Here's what to run in each:"
echo ""
echo "📋 TERMINAL 1 - Backend:"
echo "  cd backend"
echo "  npm run dev"
echo ""
echo "📋 TERMINAL 2 - Frontend:"
echo "  npm run dev"
echo ""
echo "📋 TERMINAL 3 - Ngrok:"
echo "  ngrok http 3001"
echo ""
echo "⚠️  IMPORTANT: After ngrok starts:"
echo "  1. Copy the HTTPS URL from ngrok output"
echo "  2. Update backend/.env → BACKEND_URL=https://your-ngrok-url.ngrok-free.app"
echo "  3. Update Vapi dashboard → Webhook URL"
echo "  4. Restart backend (Ctrl+C in Terminal 1, then npm run dev)"
echo ""
echo "🔗 Access Points:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:3001"
echo ""
echo "Press Enter to continue..."
read

# Ask which terminal the user wants to start
echo ""
echo "Which terminal do you want to start?"
echo "1) Backend (Terminal 1)"
echo "2) Frontend (Terminal 2)"
echo "3) Ngrok (Terminal 3)"
echo "4) Exit (I'll start them manually)"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo "Starting backend..."
        cd backend && npm run dev
        ;;
    2)
        echo "Starting frontend..."
        npm run dev
        ;;
    3)
        echo "Starting ngrok..."
        echo ""
        echo "⚠️  Copy the HTTPS URL and update:"
        echo "  1. backend/.env BACKEND_URL"
        echo "  2. Vapi webhook URL"
        echo ""
        ngrok http 3001
        ;;
    4)
        echo "Exiting. Start services manually in 3 terminals."
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac
