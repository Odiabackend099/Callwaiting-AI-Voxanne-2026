#!/usr/bin/env python3
"""
Twilio Programmatic Deployment Script
Updates Twilio phone number webhook URLs to use ngrok tunnel
"""

import os
import sys
import json
import requests
from twilio.rest import Client
from typing import Optional
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TwilioDeployment:
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.phone_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        if not all([self.account_sid, self.auth_token, self.phone_number]):
            logger.error("❌ Missing Twilio credentials in environment variables")
            logger.info("Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER")
            sys.exit(1)
            
        self.client = Client(self.account_sid, self.auth_token)
        
    def get_ngrok_url(self) -> Optional[str]:
        """Get the current ngrok public URL"""
        try:
            response = requests.get("http://localhost:4040/api/tunnels", timeout=5)
            response.raise_for_status()
            
            data = response.json()
            tunnels = data.get("tunnels", [])
            
            if tunnels:
                public_url = tunnels[0].get("public_url")
                if public_url:
                    logger.info(f"🌐 Found ngrok URL: {public_url}")
                    return public_url
                    
            logger.error("❌ No ngrok tunnels found")
            # Fallback to PUBLIC_URL from environment
            public_url = os.getenv("PUBLIC_URL")
            if public_url:
                logger.info(f"🌐 Using PUBLIC_URL fallback: {public_url}")
                return public_url
            return None
        
        except Exception as e:
            logger.error(f"❌ Failed to get ngrok URL: {e}")
            # Fallback to PUBLIC_URL from environment
            public_url = os.getenv("PUBLIC_URL")
            if public_url:
                logger.info(f"🌐 Using PUBLIC_URL fallback: {public_url}")
                return public_url
            return None
    
    def update_phone_number_webhooks(self, ngrok_url: str):
        """Update Twilio phone number webhook URLs"""
        try:
            # Remove protocol from phone number if present
            phone_sid = self.phone_number
            if phone_sid.startswith("+"):
                # It's a phone number, need to find the SID
                logger.info("🔍 Looking up phone number SID...")
                numbers = self.client.incoming_phone_numbers.list(phone_number=phone_sid)
                if numbers:
                    phone_sid = numbers[0].sid
                else:
                    logger.error(f"❌ Phone number {self.phone_number} not found in account")
                    return False
            
            # Construct webhook URLs
            voice_url = f"{ngrok_url}/twiml"
            status_callback_url = f"{ngrok_url}/health"
            
            logger.info(f"📞 Updating phone number {self.phone_number}")
            logger.info(f"🎙️  Voice URL: {voice_url}")
            logger.info(f"📊 Status Callback: {status_callback_url}")
            
            # Update the phone number configuration
            phone_number = self.client.incoming_phone_numbers(phone_sid).update(
                voice_url=voice_url,
                voice_method="POST",
                status_callback=status_callback_url,
                status_callback_method="GET"
            )
            
            logger.info("✅ Twilio phone number webhooks updated successfully!")
            logger.info(f"📱 Phone Number: {phone_number.phone_number}")
            logger.info(f"🎯 Voice Webhook: {phone_number.voice_url}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to update Twilio webhooks: {e}")
            return False
    
    def verify_configuration(self):
        """Verify current Twilio configuration"""
        try:
            numbers = self.client.incoming_phone_numbers.list()
            
            if not numbers:
                logger.warning("⚠️  No phone numbers found in Twilio account")
                return False
            
            logger.info("📋 Current Twilio Phone Numbers:")
            for number in numbers:
                logger.info(f"   📱 {number.phone_number}")
                logger.info(f"      Voice URL: {number.voice_url or 'Not set'}")
                logger.info(f"      Status Callback: {number.status_callback or 'Not set'}")
                
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to verify Twilio configuration: {e}")
            return False

def main():
    """Main deployment function"""
    logger.info("🚀 Starting Twilio Programmatic Deployment")
    
    # Initialize deployment
    deployment = TwilioDeployment()
    
    # Verify current configuration
    deployment.verify_configuration()
    
    # Get ngrok URL
    logger.info("🔍 Getting ngrok tunnel URL...")
    ngrok_url = deployment.get_ngrok_url()
    
    if not ngrok_url:
        logger.error("❌ Failed to get ngrok URL. Make sure ngrok is running on port 4040")
        sys.exit(1)
    
    # Update Twilio webhooks
    logger.info("🔄 Updating Twilio webhooks...")
    success = deployment.update_phone_number_webhooks(ngrok_url)
    
    if success:
        logger.info("🎉 Deployment completed successfully!")
        logger.info(f"🌐 Your Twilio number is now connected to: {ngrok_url}")
        logger.info("📞 Test by calling your Twilio number")
    else:
        logger.error("❌ Deployment failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
