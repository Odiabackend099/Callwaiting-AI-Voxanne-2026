#!/bin/bash
# Generate PWA icons from source logo
# Requires ImageMagick: brew install imagemagick

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎨 Voxanne AI - PWA Icon Generator${NC}"
echo "======================================"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo -e "${RED}❌ Error: ImageMagick not found${NC}"
    echo "Install with: brew install imagemagick"
    exit 1
fi

# Source logo path
SOURCE="public/callwaiting-ai-logo.png"
OUTPUT_DIR="public/icons"

# Check if source exists
if [ ! -f "$SOURCE" ]; then
    echo -e "${RED}❌ Error: Source logo not found at $SOURCE${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo -e "${YELLOW}📁 Created directory: $OUTPUT_DIR${NC}"

# Icon sizes for PWA
sizes=(72 96 128 144 152 192 384 512)

echo -e "${YELLOW}🔄 Generating icons...${NC}"

# Generate each size
for size in "${sizes[@]}"; do
    output_file="$OUTPUT_DIR/icon-${size}x${size}.png"

    # Generate icon with background and padding
    convert "$SOURCE" \
        -resize "${size}x${size}" \
        -background "#0a0e27" \
        -gravity center \
        -extent "${size}x${size}" \
        "$output_file"

    echo -e "${GREEN}✅ Generated: icon-${size}x${size}.png${NC}"
done

# Generate maskable icon (512x512 with safe zone)
echo -e "${YELLOW}🎭 Generating maskable icon...${NC}"
convert "$SOURCE" \
    -resize "410x410" \
    -background "#0a0e27" \
    -gravity center \
    -extent "512x512" \
    "$OUTPUT_DIR/icon-512x512-maskable.png"

echo -e "${GREEN}✅ Generated: icon-512x512-maskable.png (with safe zone)${NC}"

# Generate apple-touch-icon
echo -e "${YELLOW}🍎 Generating Apple touch icon...${NC}"
convert "$SOURCE" \
    -resize "180x180" \
    -background "#0a0e27" \
    -gravity center \
    -extent "180x180" \
    "public/apple-touch-icon.png"

echo -e "${GREEN}✅ Generated: apple-touch-icon.png${NC}"

# Generate favicon sizes
echo -e "${YELLOW}🔖 Generating favicons...${NC}"
convert "$SOURCE" -resize "16x16" "public/favicon-16x16.png"
convert "$SOURCE" -resize "32x32" "public/favicon-32x32.png"
convert "$SOURCE" -resize "48x48" "public/favicon-48x48.png"

echo -e "${GREEN}✅ Generated: favicon sizes (16, 32, 48)${NC}"

# Count generated files
icon_count=$(ls -1 "$OUTPUT_DIR" | wc -l | tr -d ' ')

echo ""
echo -e "${GREEN}======================================"
echo "✅ PWA Icon Generation Complete!"
echo "======================================"
echo "📊 Total icons generated: $icon_count"
echo "📁 Output directory: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Verify icons in $OUTPUT_DIR"
echo "2. Update manifest.json if needed"
echo "3. Test PWA installation"
echo -e "${NC}"
