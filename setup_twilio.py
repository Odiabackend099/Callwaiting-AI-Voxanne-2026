#!/usr/bin/env python3
"""
Setup Twilio Webhook
Updates the Twilio Phone Number's Voice URL to point to the current Ngrok tunnel.
"""

import os
import sys
from dotenv import load_dotenv
from twilio.rest import Client

# Load environment variables
load_dotenv()

# Configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
PUBLIC_URL = os.getenv("PUBLIC_URL")

if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, PUBLIC_URL]):
    print("❌ Error: Missing required environment variables.")
    print("   Ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and PUBLIC_URL are set in .env")
    sys.exit(1)

def setup_twilio_webhook():
    print(f"🔧 Configuring Twilio Number: {TWILIO_PHONE_NUMBER}")
    print(f"   Target URL: {PUBLIC_URL}/twilio/incoming")
    
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        # Find the phone number SID
        incoming_phone_numbers = client.incoming_phone_numbers.list(
            phone_number=TWILIO_PHONE_NUMBER,
            limit=1
        )
        
        if not incoming_phone_numbers:
            print(f"❌ Error: Phone number {TWILIO_PHONE_NUMBER} not found in your Twilio account.")
            return
            
        phone_number_sid = incoming_phone_numbers[0].sid
        
        # Update the Voice URL
        updated_number = client.incoming_phone_numbers(phone_number_sid).update(
            voice_url=f"{PUBLIC_URL}/twilio/incoming",
            voice_method="POST",
            status_callback=f"{PUBLIC_URL}/status",
            status_callback_method="POST"
        )
        
        print(f"✅ Success! Twilio webhook updated.")
        print(f"   - Voice URL: {updated_number.voice_url}")
        print(f"   - Status Callback: {updated_number.status_callback}")
        print("\n📞 You can now call the number to test the agent.")

    except Exception as e:
        print(f"❌ Error updating Twilio configuration: {e}")

if __name__ == "__main__":
    setup_twilio_webhook()
