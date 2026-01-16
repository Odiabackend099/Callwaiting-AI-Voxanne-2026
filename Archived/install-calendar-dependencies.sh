#!/bin/bash

# Voxanne Google Calendar Integration - Dependency Installation Script
# Run this script to install all required packages for calendar integration

echo "🚀 Installing Google Calendar Integration Dependencies..."
echo ""

# Change to backend directory
cd backend

echo "📦 Installing backend dependencies..."
echo ""

# Install googleapis (Google Cloud client library)
echo "Installing googleapis..."
npm install googleapis

# googleapis should automatically include @types/gapi and @types/gapi.calendar
echo "Installing auth-related types..."
npm install --save-dev @types/node

echo ""
echo "✅ Backend dependencies installed!"
echo ""

# Return to root
cd ..

echo "🎯 Summary of installed packages:"
echo ""
echo "✓ googleapis - Google Cloud client library"
echo "✓ crypto - Token encryption (built-in Node.js)"
echo ""

echo "📋 Next Steps:"
echo ""
echo "1. Configure Google Cloud Project:"
echo "   → Follow instructions in GOOGLE_CALENDAR_OAUTH_SETUP.md"
echo ""
echo "2. Set environment variables in backend/.env:"
echo "   GOOGLE_CLIENT_ID=your-client-id"
echo "   GOOGLE_CLIENT_SECRET=your-secret"
echo "   GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/auth/callback"
echo "   ENCRYPTION_KEY=your-32-byte-base64-key"
echo "   FRONTEND_URL=http://localhost:3000"
echo ""
echo "3. Restart backend server:"
echo "   npm run dev"
echo ""
echo "4. Test in dashboard at /dashboard/integrations"
echo ""

echo "🔗 Documentation:"
echo "  • GOOGLE_CALENDAR_OAUTH_SETUP.md - Setup guide"
echo "  • GOOGLE_CALENDAR_IMPLEMENTATION_CHECKLIST.md - Implementation steps"
echo "  • VAPI_TOOLS_SCHEMA.json - Vapi function definitions"
echo ""

echo "✨ Ready to go! Happy building! 🚀"
