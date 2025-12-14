#!/usr/bin/env python3
"""
Comprehensive Agent Verification Script
Tests all components programmatically: Ngrok, Agent Persona, STT, LLM, TTS, Twilio
"""

import asyncio
import aiohttp
import json
import sys
import os
from datetime import datetime
from typing import Dict, Any
import websockets
import base64

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_section(title: str):
    """Print formatted section header"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")

def print_success(message: str):
    """Print success message"""
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")

def print_error(message: str):
    """Print error message"""
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")

def print_warning(message: str):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")

def print_info(message: str):
    """Print info message"""
    print(f"{Colors.CYAN}ℹ️  {message}{Colors.RESET}")


class AgentVerification:
    """Comprehensive agent verification"""
    
    def __init__(self):
        self.ngrok_url = "https://sobriquetical-zofia-abysmally.ngrok-free.dev"
        self.results = {
            "ngrok_health": False,
            "agent_persona": False,
            "stt_pipeline": False,
            "llm_pipeline": False,
            "tts_pipeline": False,
            "twilio_integration": False
        }
        self.agent_info = {}
        
    async def verify_ngrok_health(self) -> bool:
        """Test 1: Verify ngrok tunnel is alive and server is responding"""
        print_section("TEST 1: NGROK HEALTH CHECK")
        
        try:
            headers = {"ngrok-skip-browser-warning": "true"}
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.ngrok_url}/health", headers=headers, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        print_success(f"Ngrok tunnel is ALIVE")
                        print_info(f"Status: {data.get('status')}")
                        print_info(f"Active calls: {data.get('active_calls', 0)}")
                        print_info(f"System metrics: {data.get('system_metrics', {})}")
                        self.results["ngrok_health"] = True
                        return True
                    else:
                        print_error(f"Health endpoint returned status {response.status}")
                        return False
        except Exception as e:
            print_error(f"Failed to connect to ngrok: {str(e)}")
            return False
    
    async def verify_agent_persona(self) -> bool:
        """Test 2: Verify agent persona configuration"""
        print_section("TEST 2: AGENT PERSONA VERIFICATION")
        
        try:
            # Read the orchestration file to get persona info
            with open("voxanne_enhanced_orchestration.py", "r") as f:
                content = f.read()
                
            # Check for key persona elements
            persona_checks = {
                "Agent Name": "Voxanne" in content or "voxanne" in content.lower(),
                "Sales Focus": "sales" in content.lower(),
                "Groq LLM": "groq" in content.lower() and "llama" in content.lower(),
                "Deepgram STT": "deepgram" in content.lower() and "nova" in content.lower(),
                "Deepgram TTS": "aura" in content.lower(),
                "VAD Handler": "AdvancedVADHandler" in content,
                "Echo Cancellation": "EchoCanceller" in content
            }
            
            print_info("Agent Configuration:")
            all_passed = True
            for check, passed in persona_checks.items():
                if passed:
                    print_success(f"{check}: Configured")
                else:
                    print_error(f"{check}: NOT configured")
                    all_passed = False
            
            # Try to read persona files
            persona_files = [
                "voxanne_sales_system_prompt.md",
                "voxanne_sales_system_prompt (1).md",
                "ROXAN PERASONA"
            ]
            
            for file in persona_files:
                if os.path.exists(file):
                    print_success(f"Found persona file: {file}")
                    if file.endswith('.md'):
                        with open(file, 'r') as f:
                            content = f.read()
                            self.agent_info["persona_length"] = len(content)
                            # Extract first few lines
                            lines = content.split('\n')[:5]
                            print_info(f"Persona preview:\n{'  '.join(lines[:3])}")
            
            self.results["agent_persona"] = all_passed
            return all_passed
            
        except Exception as e:
            print_error(f"Failed to verify persona: {str(e)}")
            return False
    
    async def verify_stt_pipeline(self) -> bool:
        """Test 3: Verify Speech-to-Text pipeline"""
        print_section("TEST 3: STT PIPELINE (Deepgram Nova-2)")
        
        try:
            # Check environment variables
            dg_api_key = os.getenv("DEEPGRAM_API_KEY")
            if not dg_api_key:
                print_error("DEEPGRAM_API_KEY not set in environment")
                return False
            
            print_success("Deepgram API key found")
            print_info(f"Key preview: {dg_api_key[:8]}...{dg_api_key[-4:]}")
            
            # Test WebSocket connection to Deepgram
            dg_url = (
                "wss://api.deepgram.com/v1/listen?"
                "model=nova-2&encoding=linear16&sample_rate=16000&"
                "vad=true&interim_results=true&endpointing=200"
            )
            
            try:
                async with websockets.connect(
                    dg_url,
                    additional_headers={"Authorization": f"Token {dg_api_key}"},
                    ping_interval=20,
                    ping_timeout=10,
                    open_timeout=5
                ) as ws:
                    print_success("Successfully connected to Deepgram STT WebSocket")
                    
                    # Send a test audio frame (silence)
                    test_audio = b'\x00\x00' * 100  # Silent audio
                    await ws.send(test_audio)
                    print_success("Sent test audio frame")
                    
                    # Wait for response
                    try:
                        response = await asyncio.wait_for(ws.recv(), timeout=2.0)
                        data = json.loads(response)
                        print_success(f"Received STT response: {data.get('type', 'unknown')}")
                        self.results["stt_pipeline"] = True
                        return True
                    except asyncio.TimeoutError:
                        print_warning("No response from STT (expected for silent audio)")
                        self.results["stt_pipeline"] = True
                        return True
                        
            except Exception as e:
                print_error(f"Failed to connect to Deepgram STT: {str(e)}")
                return False
                
        except Exception as e:
            print_error(f"STT pipeline test failed: {str(e)}")
            return False
    
    async def verify_llm_pipeline(self) -> bool:
        """Test 4: Verify LLM pipeline (Groq)"""
        print_section("TEST 4: LLM PIPELINE (Groq Llama-3.3-70B)")
        
        try:
            groq_api_key = os.getenv("GROQ_API_KEY")
            if not groq_api_key:
                print_error("GROQ_API_KEY not set in environment")
                return False
            
            print_success("Groq API key found")
            print_info(f"Key preview: {groq_api_key[:10]}...{groq_api_key[-4:]}")
            
            # Test LLM call
            from groq import Groq
            client = Groq(api_key=groq_api_key)
            
            print_info("Testing LLM with sample query...")
            
            start_time = asyncio.get_event_loop().time()
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are Voxanne, a professional sales AI assistant."},
                    {"role": "user", "content": "What is your name and what do you do?"}
                ],
                max_tokens=100,
                temperature=0.7
            )
            end_time = asyncio.get_event_loop().time()
            
            latency_ms = (end_time - start_time) * 1000
            
            llm_response = response.choices[0].message.content
            tokens_used = response.usage.total_tokens
            
            print_success(f"LLM responded successfully")
            print_info(f"Latency: {latency_ms:.0f}ms")
            print_info(f"Tokens used: {tokens_used}")
            print_info(f"Response: {llm_response[:200]}...")
            
            self.agent_info["llm_latency_ms"] = latency_ms
            self.results["llm_pipeline"] = True
            return True
            
        except Exception as e:
            print_error(f"LLM pipeline test failed: {str(e)}")
            return False
    
    async def verify_tts_pipeline(self) -> bool:
        """Test 5: Verify Text-to-Speech pipeline"""
        print_section("TEST 5: TTS PIPELINE (Deepgram Aura-Asteria)")
        
        try:
            dg_api_key = os.getenv("DEEPGRAM_API_KEY")
            if not dg_api_key:
                print_error("DEEPGRAM_API_KEY not set")
                return False
            
            # Test TTS WebSocket
            aura_url = (
                "wss://api.deepgram.com/v1/speak?"
                "model=aura-asteria-en&encoding=linear16&sample_rate=16000&"
                "container=none"
            )
            
            try:
                async with websockets.connect(
                    aura_url,
                    additional_headers={"Authorization": f"Token {dg_api_key}"},
                    ping_interval=20,
                    ping_timeout=10,
                    open_timeout=5
                ) as ws:
                    print_success("Successfully connected to Deepgram TTS WebSocket")
                    
                    # Send test text (JSON format with type and text)
                    test_text = "Hello, this is Voxanne."
                    await ws.send(json.dumps({"type": "Speak", "text": test_text}))
                    print_success(f"Sent test text: '{test_text}'")
                    
                    # Receive audio frames
                    audio_received = False
                    timeout_count = 0
                    max_timeouts = 3
                    
                    while timeout_count < max_timeouts:
                        try:
                            message = await asyncio.wait_for(ws.recv(), timeout=2.0)
                            
                            if isinstance(message, bytes):
                                audio_received = True
                                print_success(f"Received audio frame: {len(message)} bytes")
                                break
                            else:
                                data = json.loads(message)
                                print_info(f"Received metadata: {data.get('type', 'unknown')}")
                                
                        except asyncio.TimeoutError:
                            timeout_count += 1
                            if not audio_received:
                                print_warning(f"Waiting for audio... ({timeout_count}/{max_timeouts})")
                    
                    if audio_received:
                        print_success("TTS pipeline working correctly")
                        self.results["tts_pipeline"] = True
                        return True
                    else:
                        print_error("No audio received from TTS")
                        return False
                        
            except Exception as e:
                print_error(f"Failed to connect to Deepgram TTS: {str(e)}")
                return False
                
        except Exception as e:
            print_error(f"TTS pipeline test failed: {str(e)}")
            return False
    
    async def verify_twilio_integration(self) -> bool:
        """Test 6: Verify Twilio integration"""
        print_section("TEST 6: TWILIO INTEGRATION")
        
        try:
            twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID")
            twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN")
            twilio_phone_number = os.getenv("TWILIO_PHONE_NUMBER", "+12526453035")
            
            if not twilio_account_sid or not twilio_auth_token:
                print_error("Twilio credentials not set")
                return False
            
            print_success("Twilio credentials found")
            print_info(f"Account SID: {twilio_account_sid[:10]}...{twilio_account_sid[-4:]}")
            print_info(f"Phone Number: {twilio_phone_number}")
            
            # Check Twilio configuration
            from twilio.rest import Client
            client = Client(twilio_account_sid, twilio_auth_token)
            
            # Get phone number configuration
            phone_numbers = client.incoming_phone_numbers.list(phone_number=twilio_phone_number)
            
            if phone_numbers:
                number = phone_numbers[0]
                print_success(f"Found Twilio number: {number.friendly_name}")
                print_info(f"Voice URL: {number.voice_url}")
                print_info(f"Status Callback: {number.status_callback}")
                
                # Check if voice URL points to our ngrok
                expected_voice_url = f"{self.ngrok_url}/twilio/incoming"
                if number.voice_url == expected_voice_url:
                    print_success("Voice webhook correctly configured!")
                    self.results["twilio_integration"] = True
                    return True
                else:
                    print_warning(f"Voice webhook not pointing to ngrok")
                    print_info(f"Expected: {expected_voice_url}")
                    print_info(f"Actual: {number.voice_url}")
                    
                    # Offer to fix
                    print_warning("Run setup_twilio.py to fix this")
                    return False
            else:
                print_error(f"Phone number {twilio_phone_number} not found in account")
                return False
                
        except Exception as e:
            print_error(f"Twilio integration test failed: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all verification tests"""
        print_section(f"🤖 COMPREHENSIVE AGENT VERIFICATION")
        print_info(f"Timestamp: {datetime.now().isoformat()}")
        print_info(f"Ngrok URL: {self.ngrok_url}")
        
        # Run tests in sequence
        await self.verify_ngrok_health()
        await self.verify_agent_persona()
        await self.verify_stt_pipeline()
        await self.verify_llm_pipeline()
        await self.verify_tts_pipeline()
        await self.verify_twilio_integration()
        
        # Print final summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print_section("📊 VERIFICATION SUMMARY")
        
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results.values() if result)
        
        for test_name, result in self.results.items():
            status = "PASS" if result else "FAIL"
            color = Colors.GREEN if result else Colors.RED
            print(f"{color}{status:6}{Colors.RESET} | {test_name}")
        
        print(f"\n{Colors.BOLD}Overall: {passed_tests}/{total_tests} tests passed{Colors.RESET}")
        
        if passed_tests == total_tests:
            print_success("🎉 ALL SYSTEMS OPERATIONAL! Agent is ready to handle calls.")
            print_info(f"\n📞 You can now call: {os.getenv('TWILIO_PHONE_NUMBER', '+12526453035')}")
        else:
            print_error("❌ Some tests failed. Please review the errors above.")
            
        # Print agent metrics if available
        if self.agent_info:
            print_section("📈 AGENT PERFORMANCE METRICS")
            for key, value in self.agent_info.items():
                print_info(f"{key}: {value}")


async def main():
    """Main entry point"""
    
    # Load environment variables
    from dotenv import load_dotenv
    if os.path.exists(".env"):
        load_dotenv()
        print_success("Loaded .env file")
    else:
        print_warning("No .env file found, using system environment")
    
    # Run verification
    verifier = AgentVerification()
    await verifier.run_all_tests()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print_warning("\n\nVerification interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"\n\nFatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
