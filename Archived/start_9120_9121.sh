#!/bin/bash
set -euo pipefail

cd "/Users/mac/Desktop/VOXANNE  WEBSITE"

if ! command -v python3 >/dev/null; then echo "python3 not found"; exit 1; fi
if ! command -v npm >/dev/null; then echo "npm not found"; exit 1; fi
if ! command -v lsof >/dev/null; then echo "lsof not found"; exit 1; fi

BACKEND_PORT=9120
FRONTEND_PORT=9121

echo "Killing existing processes on ports $BACKEND_PORT and $FRONTEND_PORT..."
lsof -ti :"$BACKEND_PORT" | xargs kill -9 >/dev/null 2>&1 || true
lsof -ti :"$FRONTEND_PORT" | xargs kill -9 >/dev/null 2>&1 || true
sleep 1

echo "Installing backend dependencies..."
python3 -m pip install --quiet --upgrade pip setuptools wheel
python3 -m pip install --quiet -r requirements.txt

echo "Installing frontend dependencies..."
npm ci --silent

echo "Starting backend on port $BACKEND_PORT..."
python3 -m uvicorn roxanne_v2:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload > backend_9120.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -fsS "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    echo "✅ Backend is ready"
    break
  fi
  echo "  Attempt $i/30..."
  sleep 1
done

if ! curl -fsS "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
  echo "❌ Backend failed to start. Logs:"
  tail -n 50 backend_9120.log || true
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
  exit 1
fi

echo "Starting frontend on port $FRONTEND_PORT..."
npx next dev -p "$FRONTEND_PORT" > frontend_9121.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

cleanup() {
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo ""
echo "=========================================="
echo "✅ SERVICES RUNNING"
echo "=========================================="
echo "Backend:  http://localhost:${BACKEND_PORT}/health"
echo "Frontend: http://localhost:${FRONTEND_PORT}"
echo ""
echo "Logs:"
echo "  Backend:  tail -f backend_9120.log"
echo "  Frontend: tail -f frontend_9121.log"
echo ""
echo "Press Ctrl+C to stop"
echo "=========================================="
echo ""

wait
