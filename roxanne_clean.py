#!/usr/bin/env python3
"""
ROXANNE VOICE AGENT - CLEAN IMPLEMENTATION
==========================================
Simple, reliable voice agent for Twilio calls
"""

import asyncio
import json
import base64
import os
import time
import logging
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
import aiohttp
import websockets
from groq import AsyncGroq

load_dotenv()

# Simple logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger("roxanne")

# Environment
DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")

# Voice settings
TTS_MODEL = "aura-2-thalia-en"


class State(Enum):
    LISTENING = "listening"
    PROCESSING = "processing" 
    SPEAKING = "speaking"


@dataclass
class Call:
    sid: str
    stream_sid: str
    state: State = State.LISTENING
    messages: list = None
    
    def __post_init__(self):
        if self.messages is None:
            self.messages = [{"role": "system", "content": self.get_system_prompt()}]
    
    def get_system_prompt(self):
        return """You are Roxanne, elite AI Sales Agent for CallWaiting AI.
Keep responses BRIEF (1-3 sentences) - this is a phone call.
Be warm, consultative, steer toward booking demos.
Company: AI Voice Receptionists for medical practices.
Pricing: Essentials $169/mo, Growth $289/mo, Premium $499/mo."""


class RoxanneAgent:
    def __init__(self, websocket: WebSocket, stream_sid: str, call_sid: str):
        self.ws = websocket
        self.call = Call(call_sid, stream_sid)
        self.groq = AsyncGroq(api_key=GROQ_KEY)
        self.deepgram_ws = None
        self.tasks = []
        
    async def start(self):
        """Start the agent"""
        logger.info(f"🚀 Call started: {self.call.sid}")
        
        # Connect to Deepgram
        await self._connect_deepgram()
        
        # Send greeting
        await self._speak("Hi! This is Roxanne from CallWaiting A.I. How can I help you today?")
        
        # Start listening
        self.tasks = [
            asyncio.create_task(self._listen()),
            asyncio.create_task(self._process_queue())
        ]
        
    async def stop(self):
        """Stop the agent"""
        for task in self.tasks:
            task.cancel()
        if self.deepgram_ws:
            await self.deepgram_ws.close()
        logger.info(f"📞 Call ended: {self.call.sid}")
    
    async def send_audio(self, payload: str):
        """Forward audio to Deepgram"""
        if self.deepgram_ws:
            try:
                await self.deepgram_ws.send(base64.b64decode(payload))
            except:
                pass
    
    async def _connect_deepgram(self):
        """Connect to Deepgram STT"""
        url = (
            "wss://api.deepgram.com/v1/listen?"
            "model=nova-2&encoding=mulaw&sample_rate=8000&"
            "interim_results=false&smart_format=true"
        )
        
        try:
            self.deepgram_ws = await websockets.connect(url, additional_headers={
                "Authorization": f"Token {DEEPGRAM_KEY}"
            })
            logger.info("✅ Connected to Deepgram")
        except Exception as e:
            logger.error(f"❌ Deepgram failed: {e}")
    
    async def _listen(self):
        """Listen for speech from Deepgram"""
        if not self.deepgram_ws:
            return
            
        try:
            async for message in self.deepgram_ws:
                data = json.loads(message)
                
                if data.get("type") == "Results":
                    transcript = self._extract_transcript(data)
                    if transcript:
                        logger.info(f"🎤 User: {transcript}")
                        await self._handle_input(transcript)
                        
        except Exception as e:
            logger.error(f"❌ Listen error: {e}")
    
    def _extract_transcript(self, data):
        """Extract transcript from Deepgram response"""
        try:
            channel = data.get("channel", {})
            alternatives = channel.get("alternatives", [])
            if alternatives:
                transcript = alternatives[0].get("transcript", "").strip()
                confidence = alternatives[0].get("confidence", 0)
                if transcript and confidence > 0.5:  # Only high confidence
                    return transcript
        except:
            pass
        return None
    
    async def _handle_input(self, text: str):
        """Handle user input"""
        logger.info(f"🔧 Processing input: '{text}' (state: {self.call.state})")
        
        if self.call.state != State.LISTENING:
            logger.info(f"⚠️ Ignoring input - wrong state: {self.call.state}")
            return
            
        self.call.state = State.PROCESSING
        self.call.messages.append({"role": "user", "content": text})
        
        try:
            logger.info("🤖 Calling Groq LLM...")
            
            # Get response from Groq
            response = await self.groq.chat.completions.create(
                model="llama-3.1-8b-instant",  # Faster model
                messages=self.call.messages,
                max_tokens=80,  # Short responses
                temperature=0.7
            )
            
            reply = response.choices[0].message.content
            self.call.messages.append({"role": "assistant", "content": reply})
            
            logger.info(f"🤖 Roxanne: {reply}")
            await self._speak(reply)
            
        except Exception as e:
            logger.error(f"❌ LLM error: {e}")
            import traceback
            traceback.print_exc()
            await self._speak("Sorry, could you repeat that?")
        
        self.call.state = State.LISTENING
        logger.info("✅ Back to listening state")
    
    async def _speak(self, text: str):
        """Convert text to speech and send to Twilio"""
        if not text:
            return
            
        self.call.state = State.SPEAKING
        logger.info(f"🔊 Speaking: {text[:50]}...")
        
        try:
            # Get audio from Deepgram TTS
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"https://api.deepgram.com/v1/speak?model={TTS_MODEL}&encoding=mulaw&sample_rate=8000",
                    headers={
                        "Authorization": f"Token {DEEPGRAM_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={"text": text}
                ) as resp:
                    if resp.status == 200:
                        audio_data = await resp.read()
                        await self._send_audio_to_twilio(audio_data)
                        logger.info("✅ Audio sent, back to listening")
                    else:
                        logger.error(f"❌ TTS error: {resp.status}")
                        
        except Exception as e:
            logger.error(f"❌ TTS error: {e}")
        finally:
            # CRITICAL FIX: Always return to listening after speaking
            self.call.state = State.LISTENING
            logger.info("🎧 Ready to listen")
    
    async def _send_audio_to_twilio(self, audio_data: bytes):
        """Send audio to Twilio in chunks"""
        chunk_size = 160  # 20ms chunks
        
        for i in range(0, len(audio_data), chunk_size):
            chunk = audio_data[i:i + chunk_size]
            
            message = {
                "event": "media",
                "streamSid": self.call.stream_sid,
                "media": {
                    "payload": base64.b64encode(chunk).decode()
                }
            }
            
            try:
                await self.ws.send_text(json.dumps(message))
                await asyncio.sleep(0.02)  # 20ms pacing
            except:
                break
    
    async def _process_queue(self):
        """Simple queue processor"""
        while True:
            await asyncio.sleep(0.1)


# FastAPI app
app = FastAPI(title="Roxanne Clean")

@app.get("/")
async def root():
    return {"status": "ok", "agent": "roxanne"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.api_route("/status", methods=["GET", "POST"])
async def status():
    return PlainTextResponse("", status_code=204)

@app.post("/twilio/incoming")
async def incoming(request: Request):
    """Handle incoming calls"""
    host = PUBLIC_URL.replace("https://", "").replace("http://", "") if PUBLIC_URL else request.headers.get("host")
    
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://{host}/ws" />
    </Connect>
</Response>"""
    
    return PlainTextResponse(twiml, media_type="application/xml")

@app.websocket("/ws")
async def websocket_handler(ws: WebSocket):
    await ws.accept()
    logger.info("📞 WebSocket connected")
    
    agent = None
    
    try:
        while True:
            message = await ws.receive_text()
            data = json.loads(message)
            event = data.get("event")
            
            if event == "connected":
                logger.info("📞 Twilio connected")
                
            elif event == "start":
                stream_sid = data.get("streamSid")
                call_sid = data.get("start", {}).get("callSid", "unknown")
                
                agent = RoxanneAgent(ws, stream_sid, call_sid)
                await agent.start()
                
            elif event == "media" and agent:
                await agent.send_audio(data["media"]["payload"])
                
            elif event == "stop":
                break
                
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
    finally:
        if agent:
            await agent.stop()


if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting Roxanne Clean Agent")
    print(f"📡 Deepgram: {'✅' if DEEPGRAM_KEY else '❌'}")
    print(f"🤖 Groq: {'✅' if GROQ_KEY else '❌'}")
    
    uvicorn.run(app, host="0.0.0.0", port=3000)
