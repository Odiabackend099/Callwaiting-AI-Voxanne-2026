import asyncio
import websockets
import json
import time
import base64
import random
import statistics
from dataclasses import dataclass, field
from typing import List

# Configuration
WS_URL = "ws://localhost:8000/ws"
CONCURRENT_USERS = 10  # Start small, can be increased
DURATION_SECONDS = 30
RAMP_UP_INTERVAL = 0.1

@dataclass
class ConnectionMetrics:
    connected: bool = False
    handshake_latency: float = 0.0
    ttft_ms: float = 0.0  # Time to first audio
    error: str = ""
    messages_received: int = 0

async def simulate_user(user_id: int, metrics_list: List[ConnectionMetrics]):
    metrics = ConnectionMetrics()
    metrics_list.append(metrics)
    
    start_time = time.perf_counter()
    
    try:
        async with websockets.connect(WS_URL) as ws:
            metrics.connected = True
            metrics.handshake_latency = (time.perf_counter() - start_time) * 1000
            
            # 1. Send Start Event
            stream_sid = f"stream_{user_id}_{int(time.time())}"
            call_sid = f"call_{user_id}_{int(time.time())}"
            
            start_event = {
                "event": "start",
                "sequenceNumber": "1",
                "start": {
                    "streamSid": stream_sid,
                    "accountSid": "AC_test",
                    "callSid": call_sid,
                    "tracks": ["inbound"],
                    "mediaFormat": {
                        "encoding": "mulaw",
                        "sampleRate": 8000,
                        "channels": 1
                    }
                },
                "streamSid": stream_sid
            }
            await ws.send(json.dumps(start_event))
            
            # 2. Wait for Audio (TTS)
            # We expect the server to greet us immediately.
            first_audio_received = False
            
            # Keep connection open for a bit
            loop_start = time.perf_counter()
            while time.perf_counter() - loop_start < 10: # 10s session
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    data = json.loads(msg)
                    metrics.messages_received += 1
                    
                    if data.get("event") == "media" and not first_audio_received:
                        metrics.ttft_ms = (time.perf_counter() - start_time) * 1000
                        first_audio_received = True
                        
                    # Simulate sending audio (silence/noise)
                    # Send a chunk every 20ms
                    # await asyncio.sleep(0.02)
                    # payload = base64.b64encode(b'\x00' * 160).decode('ascii')
                    # await ws.send(json.dumps({
                    #     "event": "media",
                    #     "streamSid": stream_sid,
                    #     "media": {"payload": payload}
                    # }))
                    
                except asyncio.TimeoutError:
                    break
                except websockets.exceptions.ConnectionClosed:
                    break
                    
    except Exception as e:
        metrics.error = str(e)

async def main():
    print(f"🚀 Starting Load Test: {CONCURRENT_USERS} users against {WS_URL}")
    print(f"   Duration: ~{DURATION_SECONDS}s")
    
    metrics_list = []
    tasks = []
    
    start_global = time.perf_counter()
    
    for i in range(CONCURRENT_USERS):
        task = asyncio.create_task(simulate_user(i, metrics_list))
        tasks.append(task)
        await asyncio.sleep(RAMP_UP_INTERVAL)
        
    await asyncio.gather(*tasks)
    
    duration = time.perf_counter() - start_global
    
    # Analysis
    successful = [m for m in metrics_list if m.connected and not m.error]
    failed = [m for m in metrics_list if m.error]
    with_audio = [m for m in successful if m.ttft_ms > 0]
    
    print("\n📊 Load Test Results")
    print("====================")
    print(f"Total Users: {len(metrics_list)}")
    print(f"Successful:  {len(successful)}")
    print(f"Failed:      {len(failed)}")
    print(f"Got Audio:   {len(with_audio)}")
    print(f"Duration:    {duration:.2f}s")
    
    if successful:
        avg_handshake = statistics.mean([m.handshake_latency for m in successful])
        print(f"\nAvg Handshake: {avg_handshake:.2f}ms")
        
    if with_audio:
        avg_ttft = statistics.mean([m.ttft_ms for m in with_audio])
        p95_ttft = statistics.quantiles([m.ttft_ms for m in with_audio], n=20)[18]
        print(f"Avg TTFT:      {avg_ttft:.2f}ms")
        print(f"P95 TTFT:      {p95_ttft:.2f}ms")
        
    if failed:
        print("\nErrors:")
        for m in failed[:5]:
            print(f"- {m.error}")

if __name__ == "__main__":
    asyncio.run(main())
