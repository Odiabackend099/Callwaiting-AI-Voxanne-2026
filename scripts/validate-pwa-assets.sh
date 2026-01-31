#!/bin/bash

echo "🔍 Validating PWA Assets..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Function to check file exists
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✅${NC} $2"
    ((PASS++))
  else
    echo -e "${RED}❌${NC} $2 - File missing: $1"
    ((FAIL++))
  fi
}

# Check app icons
echo "📱 Checking App Icons..."
for size in 72 96 128 144 152 192 384 512; do
  check_file "public/icons/icon-${size}x${size}.png" "${size}x${size} app icon"
done
echo ""

# Check shortcut icons
echo "🎯 Checking Shortcut Icons..."
for icon in dashboard calls agent; do
  check_file "public/icons/shortcut-${icon}.png" "${icon} shortcut icon"
done
echo ""

# Check screenshots
echo "📸 Checking Screenshots..."
check_file "public/screenshots/desktop-dashboard.png" "Desktop screenshot (1920x1080)"
check_file "public/screenshots/mobile-dashboard.png" "Mobile screenshot (750x1334)"
echo ""

# Check manifest
echo "📄 Checking Manifest..."
if [ -f "public/manifest.json" ]; then
  if node -pe "JSON.parse(require('fs').readFileSync('public/manifest.json', 'utf8')); 'valid'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} manifest.json is valid JSON"
    ((PASS++))
  else
    echo -e "${RED}❌${NC} manifest.json is invalid JSON"
    ((FAIL++))
  fi
else
  echo -e "${RED}❌${NC} manifest.json missing"
  ((FAIL++))
fi
echo ""

# Check offline page
echo "📡 Checking Offline Page..."
check_file "src/app/offline/page.tsx" "Offline page component"
echo ""

# Verify icon dimensions (if sips is available)
if command -v sips &> /dev/null; then
  echo "🔍 Verifying Icon Dimensions..."
  
  for size in 72 96 128 144 152 192 384 512; do
    if [ -f "public/icons/icon-${size}x${size}.png" ]; then
      actual_width=$(sips -g pixelWidth "public/icons/icon-${size}x${size}.png" 2>/dev/null | grep pixelWidth | awk '{print $2}')
      actual_height=$(sips -g pixelHeight "public/icons/icon-${size}x${size}.png" 2>/dev/null | grep pixelHeight | awk '{print $2}')
      
      if [ "$actual_width" = "$size" ] && [ "$actual_height" = "$size" ]; then
        echo -e "${GREEN}✅${NC} ${size}x${size} icon has correct dimensions"
      else
        echo -e "${YELLOW}⚠️${NC}  ${size}x${size} icon has incorrect dimensions: ${actual_width}x${actual_height}"
      fi
    fi
  done
  echo ""
  
  # Verify screenshot dimensions
  echo "🔍 Verifying Screenshot Dimensions..."
  if [ -f "public/screenshots/desktop-dashboard.png" ]; then
    desktop_width=$(sips -g pixelWidth "public/screenshots/desktop-dashboard.png" 2>/dev/null | grep pixelWidth | awk '{print $2}')
    desktop_height=$(sips -g pixelHeight "public/screenshots/desktop-dashboard.png" 2>/dev/null | grep pixelHeight | awk '{print $2}')
    
    if [ "$desktop_width" = "1920" ] && [ "$desktop_height" = "1080" ]; then
      echo -e "${GREEN}✅${NC} Desktop screenshot has correct dimensions (1920x1080)"
    else
      echo -e "${YELLOW}⚠️${NC}  Desktop screenshot has incorrect dimensions: ${desktop_width}x${desktop_height}"
    fi
  fi
  
  if [ -f "public/screenshots/mobile-dashboard.png" ]; then
    mobile_width=$(sips -g pixelWidth "public/screenshots/mobile-dashboard.png" 2>/dev/null | grep pixelWidth | awk '{print $2}')
    mobile_height=$(sips -g pixelHeight "public/screenshots/mobile-dashboard.png" 2>/dev/null | grep pixelHeight | awk '{print $2}')
    
    if [ "$mobile_width" = "750" ] && [ "$mobile_height" = "1334" ]; then
      echo -e "${GREEN}✅${NC} Mobile screenshot has correct dimensions (750x1334)"
    else
      echo -e "${YELLOW}⚠️${NC}  Mobile screenshot has incorrect dimensions: ${mobile_width}x${mobile_height}"
    fi
  fi
  echo ""
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Validation Summary:"
echo -e "   ${GREEN}✅ Passed: $PASS${NC}"
echo -e "   ${RED}❌ Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 All PWA assets validated successfully!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Run: npm run build"
  echo "  2. Run: npm run start"
  echo "  3. Open Chrome DevTools → Application → Manifest"
  echo "  4. Test PWA installation"
  exit 0
else
  echo -e "${RED}⚠️  Some assets are missing or invalid.${NC}"
  echo ""
  echo "To fix missing assets:"
  echo "  - Icons: npm run generate:icons"
  echo "  - Screenshots: npm run generate:screenshots"
  exit 1
fi
