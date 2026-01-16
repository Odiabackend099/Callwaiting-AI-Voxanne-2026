#!/bin/bash
# =============================================================================
# PRODUCTION SERVER STARTUP SCRIPT
# =============================================================================
# This script starts Voxanne in PRODUCTION mode using .env credentials
#
# ⚠️  WARNING: Only use after testing Phase 1 fixes in development!
#
# Usage:
#   chmod +x start-prod.sh
#   ./start-prod.sh

echo "=========================================="
echo "  🚀 VOXANNE PRODUCTION SERVER"
echo "=========================================="
echo ""
echo "⚠️  Using PRODUCTION credentials (.env)"
echo "📞 Production Number: +1 252 645 3035"
echo "🌐 Port: 3000"
echo ""
echo "⏸️  Waiting 5 seconds... Press Ctrl+C to cancel"
sleep 5
echo ""
echo "🚀 Starting production server..."
echo "=========================================="
echo ""

# Load production environment variables
export $(grep -v '^#' .env | xargs)

# Start the server
python3 voxanne_v2.py
