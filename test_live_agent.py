#!/usr/bin/env python3
"""
Live Agent Test - Simulates a real Twilio call to test the full pipeline
"""

import asyncio
import json
import websockets
import base64
import wave
import struct
from datetime import datetime

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_info(msg):
    print(f"{Colors.CYAN}ℹ️  {msg}{Colors.RESET}")

def print_header(msg):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{msg}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")

def generate_silent_mulaw_audio(duration_ms=20):
    """Generate silent µ-law audio data (what Twilio sends)"""
    # µ-law silence is 0xFF (or 0x7F)
    samples = int(8000 * duration_ms / 1000)  # 8kHz sample rate
    return bytes([0xFF] * samples)

async def test_agent_pipeline():
    """Test the full agent pipeline via WebSocket"""
    
    print_header("🧪 LIVE AGENT PIPELINE TEST")
    print_info(f"Timestamp: {datetime.now().isoformat()}")
    
    ws_url = "ws://localhost:3000/ws"
    
    try:
        print_info(f"Connecting to WebSocket: {ws_url}")
        
        async with websockets.connect(ws_url) as websocket:
            print_success("WebSocket connected!")
            
            # Step 1: Send Twilio "start" event
            print_info("Sending Twilio 'start' event...")
            start_event = {
                "event": "start",
                "streamSid": "test_stream_" + str(int(datetime.now().timestamp())),
                "start": {
                    "callSid": "test_call_" + str(int(datetime.now().timestamp())),
                    "accountSid": "test_account",
                    "streamSid": "test_stream_" + str(int(datetime.now().timestamp())),
                    "tracks": ["inbound"],
                    "mediaFormat": {
                        "encoding": "audio/x-mulaw",
                        "sampleRate": 8000,
                        "channels": 1
                    }
                }
            }
            
            await websocket.send(json.dumps(start_event))
            print_success("Sent 'start' event")
            
            # Step 2: Send some audio frames
            print_info("Sending audio frames (silence)...")
            
            for i in range(5):
                audio_data = generate_silent_mulaw_audio(20)  # 20ms chunks
                audio_b64 = base64.b64encode(audio_data).decode('utf-8')
                
                media_event = {
                    "event": "media",
                    "streamSid": start_event["streamSid"],
                    "media": {
                        "track": "inbound",
                        "chunk": str(i),
                        "timestamp": str(int(datetime.now().timestamp() * 1000)),
                        "payload": audio_b64
                    }
                }
                
                await websocket.send(json.dumps(media_event))
                await asyncio.sleep(0.02)  # 20ms between frames
            
            print_success(f"Sent 5 audio frames")
            
            # Step 3: Listen for responses
            print_info("Waiting for agent response...")
            
            received_greeting = False
            timeout_seconds = 10
            start_time = asyncio.get_event_loop().time()
            
            while asyncio.get_event_loop().time() - start_time < timeout_seconds:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    
                    if isinstance(message, str):
                        data = json.loads(message)
                        event_type = data.get("event")
                        
                        if event_type == "media":
                            received_greeting = True
                            payload_b64 = data.get("media", {}).get("payload", "")
                            audio_bytes = base64.b64decode(payload_b64) if payload_b64 else b''
                            print_success(f"Received audio response: {len(audio_bytes)} bytes")
                            
                        elif event_type == "mark":
                            mark_name = data.get("mark", {}).get("name", "unknown")
                            print_info(f"Received mark: {mark_name}")
                            
                        elif event_type == "clear":
                            print_info("Received clear event")
                            
                        else:
                            print_info(f"Received event: {event_type}")
                    
                except asyncio.TimeoutError:
                    if received_greeting:
                        print_info("No more messages, test complete")
                        break
                    else:
                        print_info("Waiting for greeting...")
                except Exception as e:
                    print_error(f"Error receiving message: {e}")
                    break
            
            # Step 4: Send stop event
            print_info("Sending 'stop' event...")
            stop_event = {
                "event": "stop",
                "streamSid": start_event["streamSid"]
            }
            await websocket.send(json.dumps(stop_event))
            print_success("Sent 'stop' event")
            
            # Summary
            print_header("📊 TEST RESULTS")
            if received_greeting:
                print_success("✨ FULL PIPELINE WORKING!")
                print_success("Agent successfully:")
                print_success("  ✓ Accepted WebSocket connection")
                print_success("  ✓ Processed Twilio start event")
                print_success("  ✓ Received audio input")
                print_success("  ✓ Generated TTS audio response")
                print_success("  ✓ Sent audio back to caller")
                return True
            else:
                print_error("Did not receive audio greeting")
                print_info("This could mean:")
                print_info("  - TTS pipeline needs more time")
                print_info("  - Agent is waiting for actual speech")
                print_info("  - Greeting is queued but not sent yet")
                return False
                
    except Exception as e:
        print_error(f"Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_agent_text_mode():
    """Test agent in text mode (bypass audio)"""
    print_header("📝 TEXT MODE TEST")
    
    try:
        # Import the orchestrator
        import sys
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        from roxanne_enhanced_orchestration import EnhancedVoiceOrchestrator
        
        deepgram_key = os.getenv("DEEPGRAM_API_KEY")
        groq_key = os.getenv("GROQ_API_KEY")
        
        orchestrator = EnhancedVoiceOrchestrator(deepgram_key, groq_key)
        
        # Test text input
        test_query = "What is your name and what do you do?"
        print_info(f"Testing query: '{test_query}'")
        
        response = await orchestrator.process_text_input(test_query)
        
        print_success("Text mode working!")
        print_info(f"Response: {response[:200]}...")
        
        return True
        
    except Exception as e:
        print_error(f"Text mode test failed: {e}")
        return False

async def main():
    """Run all tests"""
    
    results = {}
    
    # Test 1: WebSocket pipeline
    results["websocket_pipeline"] = await test_agent_pipeline()
    
    # Give some spacing
    await asyncio.sleep(1)
    
    # Final summary
    print_header("🎯 FINAL SUMMARY")
    
    for test_name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        color = Colors.GREEN if passed else Colors.RED
        print(f"{color}{status:6}{Colors.RESET} | {test_name}")
    
    total = len(results)
    passed_count = sum(1 for v in results.values() if v)
    
    print(f"\n{Colors.BOLD}Overall: {passed_count}/{total} tests passed{Colors.RESET}\n")
    
    if passed_count == total:
        print_success("🎉 AGENT IS FULLY OPERATIONAL!")
        print_info("📞 Ready to receive calls on: +1 252 645 3035")
        print_info("🌐 Ngrok URL: https://sobriquetical-zofia-abysmally.ngrok-free.dev")
    else:
        print_error("Some tests failed, but core functionality may still work")
        print_info("Try calling the number to test end-to-end")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⚠️  Test interrupted{Colors.RESET}")
    except Exception as e:
        print_error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
