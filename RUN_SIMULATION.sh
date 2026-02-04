#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          VAPI SIMULATION - RUN THIS IMMEDIATELY                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Make sure backend is running in another terminal:"
echo "  $ cd backend && npm run dev"
echo ""
echo "Then run this in another terminal:"
echo ""
echo "Option 1: Quick Test (3 steps, ~5 seconds)"
echo "  $ cd backend && npm run simulate:simple"
echo ""
echo "Option 2: Complete Test (4 steps, ~10 seconds)"
echo "  $ cd backend && npm run simulate:full"
echo ""
echo "Or run directly:"
echo ""
echo "Option 1: Quick Test"
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run simulate:simple
RESULT1=$?

echo ""
echo ""
echo "Option 2: Complete Test"
npm run simulate:full
RESULT2=$?

echo ""
echo "════════════════════════════════════════════════════════════════"
if [ $RESULT1 -eq 0 ] && [ $RESULT2 -eq 0 ]; then
  echo "✅ ALL TESTS PASSED - READY FOR DEMO"
else
  echo "❌ SOME TESTS FAILED - CHECK OUTPUT ABOVE"
fi
echo "════════════════════════════════════════════════════════════════"
