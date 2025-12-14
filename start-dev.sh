#!/bin/bash
# =============================================================================
# DEVELOPMENT SERVER STARTUP SCRIPT
# =============================================================================
# This script starts Voxanne in DEVELOPMENT mode using .env.dev credentials
#
# Usage:
#   chmod +x start-dev.sh
#   ./start-dev.sh

echo "=========================================="
echo "  🧪 VOXANNE DEVELOPMENT SERVER"
echo "=========================================="
echo ""
echo "⚠️  Using DEVELOPMENT credentials (.env.dev)"
echo "📞 Test Number: +1 952 333 8443"
echo "🌐 Port: 8001"
echo ""
echo "✅ Phase 1 Optimizations ENABLED:"
echo "   - v3.0 Aura-optimized prompt"
echo "   - Humanizer: TRUE"
echo "   - Barge-in V2: TRUE"
echo "   - Endpointing: 150ms"
echo ""
echo "🚀 Starting server..."
echo "=========================================="
echo ""

# Load development environment variables
export $(grep -v '^#' .env.dev | xargs)

# Start the server
python3 voxanne_v2.py
