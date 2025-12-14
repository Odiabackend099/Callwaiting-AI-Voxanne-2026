#!/usr/bin/env python3
import os
import sys
import time
import requests
from twilio.rest import Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_number = os.getenv("TWILIO_PHONE_NUMBER")
public_url = os.getenv("PUBLIC_URL")

if not all([account_sid, auth_token, twilio_number]):
    print("❌ Missing critical environment variables. Check .env")
    print(f"SID: {'OK' if account_sid else 'MISSING'}")
    print(f"Token: {'OK' if auth_token else 'MISSING'}")
    print(f"Twilio Number: {'OK' if twilio_number else 'MISSING'}")
    sys.exit(1)

# If PUBLIC_URL is missing, we might default or warn. 
# The script needs a TwiML URL to tell Twilio what to do when answered.
if not public_url:
    print("⚠️ PUBLIC_URL not found in .env. Using a placeholder or ensure you passed a valid URL.")
    # We can try to infer or ask user, but let's just warn for now.

# Get test number from args or env
your_number = os.getenv("TEST_PHONE_NUMBER")
if len(sys.argv) > 1:
    your_number = sys.argv[1]

if not your_number:
    print("❌ Please provide a test phone number (verified caller ID if trial account).")
    print("Usage: python3 check_voxanne_alive.py <YOUR_PHONE_NUMBER>")
    sys.exit(1)

client = Client(account_sid, auth_token)

def check_agent_alive():
    """Call Twilio number, verify Voxanne answers"""
    print(f"📞 Calling {your_number} from {twilio_number}...")
    
    twiml_url = f"{public_url}/twiml" if public_url else "http://demo.twilio.com/docs/voice.xml"
    status_callback = f"{public_url}/status" if public_url else None
    
    # Pre-check: Verify server health if possible
    if public_url:
        print(f"🏥 Checking server health at {public_url}/health ...")
        try:
            health_resp = requests.get(f"{public_url}/health", timeout=5)
            if health_resp.status_code == 200:
                print("✅ Server is reachable and healthy.")
            else:
                print(f"⚠️ Server returned status {health_resp.status_code}. Proceeding anyway...")
        except Exception as e:
            print(f"⚠️ Could not reach server health endpoint: {e}")
            print("   (Ensure your ngrok/server is running)")

    print(f"🔗 TwiML URL: {twiml_url}")
    
    try:
        call = client.calls.create(
            to=your_number,
            from_=twilio_number,
            url=twiml_url,
            status_callback=status_callback,
            status_callback_event=["answered", "completed"]
        )
        
        print(f"✅ Call initiated: {call.sid}")
        print("⏳ Waiting for call to be answered (max 30s)...")
        
        # Poll for status
        for _ in range(30): # Wait up to 30 seconds
            time.sleep(1)
            call = client.calls(call.sid).fetch()
            print(f"   Status: {call.status}", end="\r")
            
            if call.status in ["in-progress", "completed"]:
                print(f"\n✅ Voxanne ALIVE (Status: {call.status})")
                return True
            if call.status in ["busy", "failed", "no-answer", "canceled"]:
                print(f"\n❌ Voxanne DEAD (Status: {call.status})")
                return False
                
        print("\n⚠️ Timeout waiting for answer.")
        return False
        
    except Exception as e:
        print(f"\n❌ Error initiating call: {e}")
        return False

if __name__ == "__main__":
    check_agent_alive()
