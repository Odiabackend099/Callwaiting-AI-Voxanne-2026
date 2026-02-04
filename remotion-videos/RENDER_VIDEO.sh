#!/bin/bash

###############################################################################
#                    VOXANNE AI VIDEO RENDER SCRIPT                          #
#                                                                             #
#  This script renders the 90-second demo video for Voxanne AI               #
#  Output: out/voxanne-demo.mp4 (~15-20 MB)                                  #
#  Time: 5-7 minutes on M1 Mac, 3-4 minutes on M2/M3                         #
###############################################################################

echo "🎬 Voxanne AI: 90-Second Demo Video Render"
echo "=========================================="
echo ""

# Navigate to project directory
cd "$(dirname "$0")" || exit 1

echo "📁 Working directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Error: node_modules not found"
    echo "   Please run: npm install"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    exit 1
fi

# Check if src/index.ts exists
if [ ! -f "src/index.ts" ]; then
    echo "❌ Error: src/index.ts not found"
    exit 1
fi

echo "✅ All required files found"
echo ""

# Create output directory if it doesn't exist
mkdir -p out

echo "🎥 Starting render process..."
echo "   Composition: VoxanneDemo"
echo "   Duration: 90 seconds (2700 frames @ 30fps)"
echo "   Resolution: 1920 × 1080"
echo "   Output: out/voxanne-demo.mp4"
echo ""
echo "⏱️  Estimated time: 5-7 minutes"
echo "💡 Tip: You can monitor CPU/memory usage during render"
echo ""

# Run the render command
npm run build

# Check if render was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ RENDER SUCCESSFUL!"
    echo ""
    echo "📁 Output file: out/voxanne-demo.mp4"

    # Check file size
    if [ -f "out/voxanne-demo.mp4" ]; then
        FILE_SIZE=$(ls -lh out/voxanne-demo.mp4 | awk '{print $5}')
        echo "📊 File size: $FILE_SIZE"
        echo ""
        echo "🎬 Next steps:"
        echo "   1. Test video: open out/voxanne-demo.mp4"
        echo "   2. Record phone call audio separately"
        echo "   3. Merge audio in iMovie/Final Cut Pro"
        echo "   4. Deploy to:"
        echo "      - Homepage: public/videos/product-tour.mp4"
        echo "      - Google Play Store"
        echo "      - YouTube (for marketing)"
        echo ""
    fi
else
    echo ""
    echo "❌ RENDER FAILED"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check that all screenshots exist in public/screenshots/"
    echo "  2. Verify Node.js version: node -v"
    echo "  3. Reinstall dependencies: npm install"
    echo "  4. Try again: npm run build"
    echo ""
    exit 1
fi
