#!/usr/bin/env python3
"""
VOXANNE VOICE AGENT - CLEAN MINIMAL VERSION
============================================
Proven architecture: STT → LLM → TTS
No complexity, just working code.
"""

import asyncio
import json
import os
import logging
from datetime import datetime

from fastapi import FastAPI, WebSocket
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import aiohttp
import websockets
from groq import AsyncGroq

load_dotenv()

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger("voxanne")

# Environment
DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

# System Prompt
SYSTEM_PROMPT = """You are Voxanne Support, a friendly AI assistant for CallWaiting AI.

Keep responses SHORT (1-2 sentences max). Be helpful and conversational.

Example responses:
- "Hi! I can help you with CallWaiting AI. What would you like to know?"
- "Sure! CallWaiting AI is an AI receptionist for medical practices."
- "I'd be happy to help with that. Can you tell me more?"

Always be concise and natural."""

# FastAPI App
app = FastAPI(title="Voxanne Clean")


@app.get("/")
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": "voxanne-clean",
        "timestamp": datetime.now().isoformat()
    }


class VoiceAgent:
    """Minimal voice agent with proven STT → LLM → TTS pipeline."""
    
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.deepgram_ws = None
        self.groq = AsyncGroq(api_key=GROQ_KEY)
        self.http_session = None
        self.messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.is_processing = False
        self.tasks = []
        
    async def start(self):
        """Start the agent."""
        logger.info("🚀 Starting voice agent...")
        
        # Create HTTP session for TTS
        self.http_session = aiohttp.ClientSession()
        
        # Connect to Deepgram STT
        await self._connect_deepgram()
        
        # Wait for connection to be ready
        for _ in range(50):  # 5 second max wait
            if self.deepgram_ws and self.deepgram_ws.open:
                break
            await asyncio.sleep(0.1)
        
        if not self.deepgram_ws or not self.deepgram_ws.open:
            raise Exception("Deepgram connection failed")
        
        logger.info("✅ Voice agent ready")
        
    async def stop(self):
        """Stop the agent."""
        for task in self.tasks:
            task.cancel()
        if self.deepgram_ws:
            await self.deepgram_ws.close()
        if self.http_session:
            await self.http_session.close()
        logger.info("🛑 Voice agent stopped")
        
    async def _connect_deepgram(self):
        """Connect to Deepgram STT."""
        url = (
            "wss://api.deepgram.com/v1/listen?"
            "model=nova-2&encoding=linear16&sample_rate=16000&channels=1&"
            "interim_results=true&endpointing=300&"
            "smart_format=true&punctuate=true"
        )
        
        logger.info("🎤 Connecting to Deepgram...")
        
        try:
            self.deepgram_ws = await asyncio.wait_for(
                websockets.connect(
                    url,
                    extra_headers={"Authorization": f"Token {DEEPGRAM_KEY}"},
                    ping_interval=10,  # Auto keepalive
                    ping_timeout=20
                ),
                timeout=10
            )
        except Exception as e:
            logger.error(f"❌ Deepgram connection failed: {e}")
            raise
        
        # Start listening task
        task = asyncio.create_task(self._listen_deepgram())
        self.tasks.append(task)
        
        logger.info("✅ Deepgram connected")
        
    async def _listen_deepgram(self):
        """Listen for Deepgram transcripts."""
        try:
            async for message in self.deepgram_ws:
                data = json.loads(message)
                
                if data.get("type") == "Results":
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if not alternatives:
                        continue
                    
                    transcript = alternatives[0].get("transcript", "").strip()
                    is_final = data.get("is_final", False)
                    speech_final = data.get("speech_final", False)
                    
                    if not transcript:
                        continue
                    
                    # Send transcript to client
                    await self.ws.send_json({
                        "type": "transcript",
                        "text": transcript,
                        "is_final": is_final or speech_final,
                        "speaker": "user"
                    })
                    
                    # Trigger LLM on final transcript
                    if (is_final or speech_final) and not self.is_processing:
                        logger.info(f"💬 User said: {transcript}")
                        asyncio.create_task(self._process_and_respond(transcript))
                        
        except Exception as e:
            logger.error(f"❌ Deepgram listener error: {e}")
            
    async def send_audio(self, audio_bytes: bytes):
        """Send audio to Deepgram."""
        if self.deepgram_ws and self.deepgram_ws.open:
            try:
                await self.deepgram_ws.send(audio_bytes)
            except Exception as e:
                logger.error(f"❌ Audio send error: {e}")
                # Try to reconnect
                try:
                    await self._connect_deepgram()
                except:
                    pass
                    
    async def _process_and_respond(self, text: str):
        """Process input and generate response."""
        if self.is_processing:
            return
            
        self.is_processing = True
        
        try:
            # Add user message
            self.messages.append({"role": "user", "content": text})
            
            # Get LLM response
            logger.info("🤖 Generating LLM response...")
            
            response = await self.groq.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=self.messages,
                temperature=0.7,
                max_tokens=150
            )
            
            reply = response.choices[0].message.content.strip()
            logger.info(f"💭 AI response: {reply}")
            
            # Save to history
            self.messages.append({"role": "assistant", "content": reply})
            
            # Send text to client
            await self.ws.send_json({
                "type": "response",
                "text": reply,
                "speaker": "agent"
            })
            
            # Generate TTS
            logger.info("🔊 Generating TTS...")
            
            async with self.http_session.post(
                "https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3",
                headers={
                    "Authorization": f"Token {DEEPGRAM_KEY}",
                    "Content-Type": "application/json"
                },
                json={"text": reply}
            ) as resp:
                if resp.status == 200:
                    audio_data = await resp.read()
                    logger.info(f"✅ TTS generated: {len(audio_data)} bytes")
                    
                    # Send audio to client
                    await self.ws.send_bytes(audio_data)
                    logger.info("📢 Audio sent to client")
                else:
                    logger.error(f"❌ TTS failed: {resp.status}")
                    
        except Exception as e:
            logger.error(f"❌ Process error: {e}", exc_info=True)
        finally:
            self.is_processing = False


@app.websocket("/ws/web-client")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for voice chat."""
    await websocket.accept()
    logger.info("🌐 Client connected")
    
    # Send ready message
    await websocket.send_json({
        "type": "connected",
        "message": "Voxanne is ready"
    })
    
    agent = None
    
    try:
        # Create and start agent
        agent = VoiceAgent(websocket)
        await agent.start()
        
        # Send agent ready message
        await websocket.send_json({
            "type": "agent_ready",
            "message": "Voice agent initialized"
        })
        
        # Handle messages
        while True:
            message = await websocket.receive()
            
            if message["type"] == "websocket.receive":
                if "text" in message:
                    # JSON control message
                    data = json.loads(message["text"])
                    if data.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                    elif data.get("type") == "stop":
                        break
                        
                elif "bytes" in message:
                    # Binary audio data
                    audio_bytes = message["bytes"]
                    if agent and len(audio_bytes) > 0:
                        await agent.send_audio(audio_bytes)
                        
            elif message["type"] == "websocket.disconnect":
                break
                
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except:
            pass
    finally:
        if agent:
            await agent.stop()
        logger.info("🌐 Client disconnected")


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 9121))
    
    print("=" * 60)
    print("  VOXANNE VOICE AGENT - CLEAN VERSION")
    print("=" * 60)
    print(f"  🎤 Deepgram: {'✅' if DEEPGRAM_KEY else '❌'}")
    print(f"  🤖 Groq: {'✅' if GROQ_KEY else '❌'}")
    print(f"  🌐 Port: {port}")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=port)
