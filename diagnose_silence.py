#!/usr/bin/env python3
"""
Diagnose Twilio Call Silence - Test WebSocket Connection
"""
import asyncio
import websockets
import json
import base64
from datetime import datetime

async def test_call_simulation():
    """Simulate a Twilio call to see what happens"""
    
    print("🔍 Testing WebSocket connection like Twilio would...\n")
    
    ws_url = "ws://localhost:3000/ws"
    
    try:
        print(f"📡 Connecting to {ws_url}")
        async with websockets.connect(ws_url, open_timeout=10) as websocket:
            print("✅ WebSocket connected!\n")
            
            # Send Twilio start event (exactly like Twilio does)
            call_sid = f"test_call_{int(datetime.now().timestamp())}"
            stream_sid = f"test_stream_{int(datetime.now().timestamp())}"
            
            start_event = {
                "event": "start",
                "streamSid": stream_sid,
                "start": {
                    "streamSid": stream_sid,
                    "accountSid": "AC_test",
                    "callSid": call_sid,
                    "tracks": ["inbound"],
                    "customParameters": {},
                    "mediaFormat": {
                        "encoding": "audio/x-mulaw",
                        "sampleRate": 8000,
                        "channels": 1
                    }
                }
            }
            
            print(f"📤 Sending start event: {call_sid}")
            await websocket.send(json.dumps(start_event))
            print("✅ Start event sent\n")
            
            # Wait for any responses (greeting audio, etc.)
            print("👂 Listening for server responses (greeting audio)...")
            timeout_count = 0
            max_timeouts = 10
            messages_received = 0
            
            while timeout_count < max_timeouts:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    messages_received += 1
                    
                    if isinstance(message, str):
                        data = json.loads(message)
                        event_type = data.get("event", "unknown")
                        
                        if event_type == "media":
                            payload = data.get("media", {}).get("payload", "")
                            audio_bytes = len(base64.b64decode(payload)) if payload else 0
                            print(f"✅ Received audio! Event: {event_type}, {audio_bytes} bytes")
                        elif event_type == "mark":
                            print(f"📍 Received mark: {data}")
                        elif event_type == "clear":
                            print(f"🧹 Received clear event")
                        else:
                            print(f"📨 Received: {event_type} - {data}")
                    else:
                        print(f"📦 Received binary: {len(message)} bytes")
                        
                except asyncio.TimeoutError:
                    timeout_count += 1
                    if messages_received == 0:
                        print(f"⏳ Waiting... ({timeout_count}/{max_timeouts})")
                    else:
                        print(f"⏳ No more messages ({timeout_count}/{max_timeouts})")
                except websockets.exceptions.ConnectionClosed as e:
                    print(f"\n❌ WebSocket closed: {e.code} - {e.reason}")
                    if messages_received == 0:
                        print("\n🚨 CONNECTION CLOSED WITHOUT ANY GREETING!")
                        print("This is the problem - server closed connection immediately")
                    return False
                except Exception as e:
                    print(f"\n❌ Error: {e}")
                    return False
            
            # Send stop event
            stop_event = {
                "event": "stop",
                "streamSid": stream_sid
            }
            print(f"\n📤 Sending stop event")
            await websocket.send(json.dumps(stop_event))
            
            # Summary
            print(f"\n{'='*60}")
            if messages_received > 0:
                print(f"✅ SUCCESS! Received {messages_received} messages from server")
                print("   The greeting and TTS pipeline are working!")
                return True
            else:
                print(f"❌ FAILURE! Received 0 messages from server")
                print("   The greeting was never sent - this explains the silence!")
                return False
                
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ Connection failed with status {e.status_code}")
        return False
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    print("=" * 60)
    print("🧪 TWILIO CALL SILENCE DIAGNOSTIC TEST")
    print("=" * 60)
    
    result = await test_call_simulation()
    
    print("\n" + "=" * 60)
    if result:
        print("✅ TEST PASSED - Agent should work on real calls")
    else:
        print("❌ TEST FAILED - This explains the silence issue")
        print("\n🔧 Next steps:")
        print("   1. Check server logs for errors")
        print("   2. Verify TTS and STT tasks are starting correctly")
        print("   3. Check if greeting is being sent from TTS pipeline")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
