#!/bin/bash

# ============================================
# Voxanne AI - Development Environment Starter
# ============================================
# This script starts backend, frontend, and ngrok in tmux panes
# Usage: ./start-dev.sh
# Requirements: tmux installed (brew install tmux)
# ============================================

set -e

echo "🚀 Starting Voxanne AI Development Environment..."
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "❌ Error: tmux is not installed."
    echo "Install it with: brew install tmux"
    exit 1
fi

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ Error: ngrok is not installed."
    echo "Install it with: npm install -g ngrok"
    exit 1
fi

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Warning: backend/.env not found!"
    echo "Creating template..."
    cat > backend/.env <<'INNEREOF'
# VAPI Keys
VAPI_PRIVATE_KEY=your-vapi-private-key-here
VAPI_PUBLIC_KEY=your-vapi-public-key-here
VAPI_WEBHOOK_SECRET=your-webhook-secret-here

# Backend
BACKEND_URL=http://localhost:3001
PORT=3001

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# JWT
JWT_SECRET=your-jwt-secret-here
INNEREOF
    echo "✅ Created backend/.env template - PLEASE CONFIGURE IT BEFORE CONTINUING!"
    exit 1
fi

if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local not found!"
    echo "Creating template..."
    cat > .env.local <<'INNEREOF'
# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
INNEREOF
    echo "✅ Created .env.local template - PLEASE CONFIGURE IT BEFORE CONTINUING!"
    exit 1
fi

# Kill existing tmux session if it exists
tmux kill-session -t voxanne 2>/dev/null || true

echo "📦 Installing dependencies (if needed)..."
echo ""

# Install backend dependencies
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

# Install frontend dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo ""
echo "🎯 Starting services in tmux session 'voxanne'..."
echo ""
echo "  Window 1: Backend (port 3001)"
echo "  Window 2: Frontend (port 3000)"
echo "  Window 3: Ngrok tunnel"
echo ""
echo "📝 Tmux Controls:"
echo "  - Switch windows: Ctrl+B then 0/1/2"
echo "  - Detach: Ctrl+B then D"
echo "  - Reattach: tmux attach -t voxanne"
echo "  - Kill session: tmux kill-session -t voxanne"
echo ""

# Create tmux session with 3 windows
tmux new-session -d -s voxanne -n backend "cd backend && echo '🔧 Starting Backend...' && npm run dev"
tmux new-window -t voxanne:1 -n frontend "echo '🎨 Starting Frontend...' && sleep 3 && npm run dev"
tmux new-window -t voxanne:2 -n ngrok "echo '🌐 Starting Ngrok Tunnel...' && sleep 5 && echo '⚠️  IMPORTANT: Copy the HTTPS URL and update:' && echo '  1. backend/.env BACKEND_URL' && echo '  2. Vapi webhook URL' && echo '' && ngrok http 3001"

# Select the backend window by default
tmux select-window -t voxanne:0

echo "✅ All services started in tmux session 'voxanne'"
echo ""
echo "🔗 Access Points:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:3001"
echo "  - Ngrok:    See window 3 for HTTPS URL"
echo ""
echo "📌 Next Steps:"
echo "  1. Attach to tmux: tmux attach -t voxanne"
echo "  2. Switch to ngrok window (Ctrl+B then 2)"
echo "  3. Copy the HTTPS URL"
echo "  4. Update backend/.env with BACKEND_URL"
echo "  5. Update Vapi webhook URL in dashboard"
echo "  6. Restart backend (Ctrl+C in window 0, then npm run dev)"
echo ""
echo "Happy coding! 🚀"

# Attach to the session
tmux attach-session -t voxanne
