#!/usr/bin/env python3
"""
Configure Twilio Webhook for Development Testing
Automatically sets up the test number (+1 952 333 8443) to point to the dev server
"""

import os
import sys
from twilio.rest import Client

# Development Twilio credentials
ACCOUNT_SID = "AC0a90c92cbd17b575fde9ec6e817b71af"
AUTH_TOKEN = "11c1e5e1069e38f99a2f8c35b8baaef8"
TEST_PHONE_NUMBER = "+19523338443"
WEBHOOK_URL = "https://sobriquetical-zofia-abysmally.ngrok-free.dev/twilio/incoming"

def configure_webhook():
    """Configure Twilio webhook for the test number."""
    print("=" * 60)
    print("  🔧 Configuring Twilio Webhook for Development")
    print("=" * 60)
    print(f"📞 Test Number: {TEST_PHONE_NUMBER}")
    print(f"🌐 Webhook URL: {WEBHOOK_URL}")
    print("")

    try:
        # Initialize Twilio client
        client = Client(ACCOUNT_SID, AUTH_TOKEN)

        # Get all phone numbers for this account
        print("🔍 Finding phone number in Twilio account...")
        phone_numbers = client.incoming_phone_numbers.list()

        target_number = None
        for number in phone_numbers:
            if number.phone_number == TEST_PHONE_NUMBER:
                target_number = number
                break

        if not target_number:
            print(f"❌ Error: Phone number {TEST_PHONE_NUMBER} not found in account")
            print(f"   Available numbers:")
            for number in phone_numbers:
                print(f"   - {number.phone_number}")
            sys.exit(1)

        print(f"✅ Found: {target_number.phone_number} ({target_number.friendly_name})")
        print("")

        # Update webhook configuration
        print("🔧 Updating webhook configuration...")
        target_number.update(
            voice_url=WEBHOOK_URL,
            voice_method='POST',
            status_callback="",  # Clear status callback
            voice_fallback_url="",  # Clear fallback
        )

        print("✅ Webhook configured successfully!")
        print("")
        print("=" * 60)
        print("  ✅ Configuration Complete")
        print("=" * 60)
        print("")
        print("📞 Call this number to test: +1 952 333 8443")
        print("")
        print("Expected behavior:")
        print("  ✅ Numbers spoken as words ('one sixty-nine dollars')")
        print("  ✅ Agent stops instantly when interrupted")
        print("  ✅ Natural pauses and contractions")
        print("  ✅ Fillers like 'um', 'so', 'well'")
        print("")
        print("Monitor metrics:")
        print("  curl http://localhost:8001/metrics")
        print("")

    except Exception as e:
        print(f"❌ Error configuring webhook: {e}")
        print("")
        print("Manual setup instructions:")
        print("1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming")
        print(f"2. Click on {TEST_PHONE_NUMBER}")
        print("3. Under 'Voice Configuration':")
        print(f"   - A CALL COMES IN: {WEBHOOK_URL} (POST)")
        print("4. Click 'Save'")
        sys.exit(1)

if __name__ == "__main__":
    configure_webhook()
