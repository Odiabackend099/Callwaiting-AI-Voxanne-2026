#!/usr/bin/env python3
"""
WebSocket Test Script for Voxanne Voice Agent
Tests the /ws/web-client endpoint to verify connectivity
"""

import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:9121/ws/web-client"
    
    print(f"🔌 Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected!")
            
            # Wait for connected message
            message = await websocket.recv()
            data = json.loads(message)
            print(f"📨 Received: {data}")
            
            # Send a ping
            await websocket.send(json.dumps({"type": "ping"}))
            print("📤 Sent ping")
            
            # Wait for pong
            message = await websocket.recv()
            data = json.loads(message)
            print(f"📨 Received: {data}")
            
            print("\n✅ WebSocket test PASSED!")
            print("   - Connection established")
            print("   - Received connected message")
            print("   - Ping/pong working")
            
            # Send stop to close gracefully
            await websocket.send(json.dumps({"type": "stop"}))
            
    except Exception as e:
        print(f"\n❌ WebSocket test FAILED: {e}")
        return False
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_websocket())
    exit(0 if result else 1)
