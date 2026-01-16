#!/bin/bash
# VOXANNE VOICE AGENT – QUICK START
# One-liner to get everything running

set -e

echo "=========================================="
echo "  VOXANNE VOICE AGENT – QUICK START"
echo "=========================================="
echo ""

# Check if API keys are set
if [ -z "$GROQ_API_KEY" ] || [ -z "$DEEPGRAM_API_KEY" ]; then
    echo "❌ API keys not set in environment"
    echo ""
    echo "Set them first:"
    echo "  export GROQ_API_KEY=\"<YOUR_GROQ_KEY>\""
    echo "  export DEEPGRAM_API_KEY=\"<YOUR_DEEPGRAM_KEY>\""
    echo ""
    exit 1
fi

echo "✅ API keys detected"
echo ""

# Navigate to project root
cd "$(dirname "$0")"

echo "Running voice diagnostic workflow..."
echo ""

# Run the workflow
python3 cascade_sub_agents/voice_diagnostic_workflow.py

echo ""
echo "=========================================="
echo "  SETUP COMPLETE"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:9120 in Chrome/Edge"
echo "  2. Click the voice widget mic button"
echo "  3. Speak: 'Hello Voxanne, can you hear me?'"
echo "  4. Watch the backend logs for diagnostic output"
echo ""
echo "For help:"
echo "  python3 cascade_sub_agents/run_agent.py --agent voice_diag --task \"<question>\""
echo ""
