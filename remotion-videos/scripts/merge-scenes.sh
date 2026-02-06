#!/bin/bash

##############################################################################
#
# FFmpeg Scene Merge Script
#
# This script merges all 13 individually rendered scene videos into a single
# 90-second final video using FFmpeg's concat demuxer.
#
# Usage:
#   bash scripts/merge-scenes.sh
#   OR
#   npm run merge:scenes
#
# Prerequisites:
#   - FFmpeg installed (brew install ffmpeg on macOS)
#   - All 13 scene videos rendered in out/ directory
#
##############################################################################

set -e  # Exit on any error

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Output paths
CONCAT_FILE="concat-list.txt"
OUTPUT_FILE="out/voxanne-demo-final.mp4"

echo -e "${BOLD}${CYAN}
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🎞️  MERGING 13 SCENES INTO FINAL VIDEO  🎞️                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
${RESET}\n"

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}❌ Error: FFmpeg is not installed${RESET}"
    echo -e "${YELLOW}Install FFmpeg:${RESET}"
    echo -e "  macOS: ${BOLD}brew install ffmpeg${RESET}"
    echo -e "  Ubuntu: ${BOLD}sudo apt install ffmpeg${RESET}"
    echo -e "  Windows: ${BOLD}choco install ffmpeg${RESET}"
    exit 1
fi

echo -e "${GREEN}✅ FFmpeg found: $(ffmpeg -version | head -n1)${RESET}\n"

# Check if all 13 scene videos exist
echo -e "${YELLOW}🔍 Checking for all 13 scene videos...${RESET}"

SCENE_FILES=(
    "out/scene-0a.mp4"
    "out/scene-0b.mp4"
    "out/scene-2.mp4"
    "out/scene-3.mp4"
    "out/scene-4.mp4"
    "out/scene-5.mp4"
    "out/scene-6.mp4"
    "out/scene-7.mp4"
    "out/scene-8.mp4"
    "out/scene-9.mp4"
    "out/scene-10.mp4"
    "out/scene-11.mp4"
    "out/scene-12.mp4"
)

MISSING_COUNT=0
for file in "${SCENE_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing: $file${RESET}"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    else
        echo -e "${GREEN}✅ Found: $file${RESET}"
    fi
done

if [ $MISSING_COUNT -gt 0 ]; then
    echo -e "\n${RED}❌ Error: $MISSING_COUNT scene video(s) missing${RESET}"
    echo -e "${YELLOW}Run the scene rendering workflow first:${RESET}"
    echo -e "  ${BOLD}npm run render:scene${RESET}"
    exit 1
fi

echo -e "\n${GREEN}✅ All 13 scene videos found!${RESET}\n"

# Create concat list file
echo -e "${YELLOW}📝 Creating concat list...${RESET}"

cat > $CONCAT_FILE <<EOF
file 'out/scene-0a.mp4'
file 'out/scene-0b.mp4'
file 'out/scene-2.mp4'
file 'out/scene-3.mp4'
file 'out/scene-4.mp4'
file 'out/scene-5.mp4'
file 'out/scene-6.mp4'
file 'out/scene-7.mp4'
file 'out/scene-8.mp4'
file 'out/scene-9.mp4'
file 'out/scene-10.mp4'
file 'out/scene-11.mp4'
file 'out/scene-12.mp4'
EOF

echo -e "${GREEN}✅ Concat list created: $CONCAT_FILE${RESET}\n"

# Merge videos using FFmpeg concat demuxer
echo -e "${YELLOW}🎬 Merging videos with FFmpeg...${RESET}"
echo -e "${CYAN}This may take 1-2 minutes depending on your system...${RESET}\n"

ffmpeg -f concat -safe 0 -i $CONCAT_FILE -c copy $OUTPUT_FILE -y

# Cleanup
rm $CONCAT_FILE

# Show file info
FILE_SIZE=$(du -h $OUTPUT_FILE | cut -f1)
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $OUTPUT_FILE)
DURATION_FORMATTED=$(printf "%.1f" $DURATION)

echo -e "\n${BOLD}${GREEN}
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ✅  FINAL VIDEO CREATED SUCCESSFULLY! ✅                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
${RESET}\n"

echo -e "${GREEN}📂 Output File:${RESET} ${BOLD}$OUTPUT_FILE${RESET}"
echo -e "${CYAN}📊 File Size:${RESET} $FILE_SIZE"
echo -e "${CYAN}⏱️  Duration:${RESET} ${DURATION_FORMATTED} seconds (~90 seconds expected)"
echo -e "${CYAN}📹 Resolution:${RESET} 1920x1080 (1080p)"
echo -e "${CYAN}🎵 Audio:${RESET} Embedded voiceovers + background music\n"

echo -e "${YELLOW}➡️  Next Steps:${RESET}"
echo -e "  1. ${BOLD}Review the final video:${RESET} open $OUTPUT_FILE"
echo -e "  2. ${BOLD}Check quality:${RESET} Verify audio sync, transitions, colors"
echo -e "  3. ${BOLD}Export:${RESET} Upload to YouTube, Vimeo, or website\n"

echo -e "${GREEN}✅ Merge complete!${RESET}\n"
