#!/bin/bash

# PHASE 0: Setup Temi's Twilio Credentials
# This script configures environment variables for Twilio SMS testing

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║  PHASE 0: Temi Twilio Credentials Setup       ║"
echo "╚════════════════════════════════════════════════╝"

# Check if .env exists
ENV_FILE="backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  echo "   Creating from .env.example..."
  cp backend/.env.example backend/.env
fi

echo ""
echo "📝 Updating $ENV_FILE with Temi's Twilio credentials..."

# Update or add Twilio credentials
# Use a more reliable method to handle the .env file

# Create a temporary file
TEMP_ENV=$(mktemp)

# Copy existing .env to temp, removing any existing Twilio lines
grep -v "^TWILIO_" "$ENV_FILE" > "$TEMP_ENV" || true

# Add Temi's credentials
cat >> "$TEMP_ENV" << 'EOF'

# Twilio Configuration (PHASE 0: Temi Test Account)
TWILIO_ACCOUNT_SID=AC0a90c92cbd17b575fde9ec6e817b71af
TWILIO_AUTH_TOKEN=11c1e5e1069e38f99a2f8c35b8baaef8
TWILIO_PHONE_NUMBER=+1234567890
EOF

# Move temp file to actual .env
mv "$TEMP_ENV" "$ENV_FILE"

echo "✅ Credentials added to $ENV_FILE"

# Display what was added
echo ""
echo "📋 Configured values:"
echo "   TWILIO_ACCOUNT_SID: AC0a90c92cbd17b575fde9ec6e817b71af"
echo "   TWILIO_AUTH_TOKEN: ••••••••••••••••••• (hidden)"
echo "   TWILIO_PHONE_NUMBER: +1234567890 (needs Temi's actual number)"

echo ""
echo "⚠️  NEXT STEPS:"
echo "   1. Get Temi's actual Twilio phone number"
echo "   2. Update TWILIO_PHONE_NUMBER in backend/.env"
echo "   3. Verify the phone is registered in Twilio account"
echo "   4. Run: npm run dev (from backend/)"
echo "   5. In another terminal: npx ts-node scripts/test-twilio-sms.ts"

echo ""
echo "🔗 Twilio Console: https://www.twilio.com/console"
echo "✅ Setup complete!"
