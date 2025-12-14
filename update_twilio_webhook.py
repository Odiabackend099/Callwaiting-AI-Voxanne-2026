#!/usr/bin/env python3
"""
Update Twilio webhook to point to Voxanne on Render.
Run: python update_twilio_webhook.py
"""

import os
from twilio.rest import Client

# Configuration
VOXANNE_URL = "https://voxanneai.onrender.com"

# Get credentials from environment or prompt
ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID") or input("Enter TWILIO_ACCOUNT_SID: ")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN") or input("Enter TWILIO_AUTH_TOKEN: ")
PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER") or input("Enter phone number (e.g., +1234567890): ")

def update_webhook():
    client = Client(ACCOUNT_SID, AUTH_TOKEN)
    
    # Find the phone number
    numbers = client.incoming_phone_numbers.list(phone_number=PHONE_NUMBER)
    
    if not numbers:
        print(f"❌ Phone number {PHONE_NUMBER} not found in your Twilio account")
        return
    
    phone = numbers[0]
    
    # Update the webhook
    phone.update(
        voice_url=f"{VOXANNE_URL}/twilio/voice",
        voice_method="POST",
        status_callback=f"{VOXANNE_URL}/twilio/status",
        status_callback_method="POST"
    )
    
    print(f"✅ Updated {PHONE_NUMBER}")
    print(f"   Voice URL: {VOXANNE_URL}/twilio/voice")
    print(f"   Status Callback: {VOXANNE_URL}/twilio/status")

if __name__ == "__main__":
    update_webhook()
