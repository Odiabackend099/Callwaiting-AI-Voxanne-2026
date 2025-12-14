#!/usr/bin/env python3
"""
VOXANNE VOICE AGENT - PRODUCTION READY
======================================
Battle-tested implementation for Twilio + Deepgram + Groq

Endpoints:
- GET  /health          -> Health check
- GET  /                -> Health check (root)
- POST /twilio/incoming -> TwiML for incoming calls
- POST /status          -> Twilio status callbacks
- WS   /ws              -> Media stream WebSocket

Voice: aura-2-thalia-en (Official Voxanne)
LLM: Groq Llama-3.3-70B
STT: Deepgram Nova-2 (Streaming)
"""

import asyncio
import json
import base64
import os
import time
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, WebSocket, Request, Response
from fastapi.responses import PlainTextResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import aiohttp
import websockets
from groq import AsyncGroq

# Load environment
load_dotenv()

# Logging
logging.basicConfig(
    level=logging.DEBUG,  # Enable debug logs
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger("voxanne")

# =============================================================================
# CONFIGURATION
# =============================================================================

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")
PORT = int(os.getenv("PORT", "3000"))

# TTS Settings (Official Voxanne Voice)
TTS_MODEL = "aura-2-thalia-en"
TTS_ENCODING = "mulaw"
TTS_SAMPLE_RATE = 8000

# Timing
SILENCE_THRESHOLD_MS = 700
CHUNK_SIZE = 160  # 20ms at 8kHz mulaw

# =============================================================================
# STATE MACHINE
# =============================================================================

class State(Enum):
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"

@dataclass
class CallContext:
    call_sid: str
    stream_sid: str
    state: State = State.IDLE
    transcript: str = ""
    last_speech: float = 0.0
    is_speaking: bool = False
    cancel_tts: bool = False
    cancel_llm: bool = False
    messages: list = field(default_factory=list)

# =============================================================================
# VOXANNE PERSONA
# =============================================================================

def get_system_prompt():
    now = datetime.now()
    return f"""You are Voxanne, elite AI Sales Agent for CallWaiting AI.

TODAY: {now.strftime("%A, %B %d, %Y")} | TIME: {now.strftime("%I:%M %p")} GMT

PERSONA: Warm British-Nigerian professional, mid-30s, consultative

RULES:
1. Keep responses BRIEF (1-3 sentences) - this is a phone call
2. Be conversational: "Got it...", "Hmm...", "Right..."
3. Steer toward booking demos
4. Read emotional tone and adapt

COMPANY: CallWaiting AI - AI Voice Receptionists for medical practices
PRICING: Essentials $169/mo, Growth $289/mo (popular), Premium $499/mo

MISSION: Qualify leads (BANT), handle objections, book demos.

NATURAL SPEECH:
- Prices: "two eighty-nine dollars per month"
- Acronyms: "A.I.", "B.B.L."

You're the best sales rep CallWaiting AI has ever had."""

# =============================================================================
# VOICE ORCHESTRATOR
# =============================================================================

class VoxanneOrchestrator:
    def __init__(self, ws: WebSocket, stream_sid: str, call_sid: str):
        self.ws = ws
        self.ctx = CallContext(call_sid=call_sid, stream_sid=stream_sid)
        self.groq = AsyncGroq(api_key=GROQ_API_KEY)
        self.dg_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.tasks: list = []
        self.ctx.messages = [{"role": "system", "content": get_system_prompt()}]

    async def start(self):
        """Initialize and send greeting"""
        logger.info(f"📞 Call started: {self.ctx.call_sid}")
        
        # Connect Deepgram STT
        try:
            url = (
                "wss://api.deepgram.com/v1/listen?"
                "model=nova-2&encoding=mulaw&sample_rate=8000&"
                "interim_results=true&endpointing=300&vad_events=true"
            )
            # Use additional_headers for older websockets versions
            self.dg_ws = await websockets.connect(
                url,
                additional_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"},
                ping_interval=20
            )
            logger.info("✅ Deepgram STT connected")
        except Exception as e:
            # Try alternative parameter name for different websockets versions
            try:
                self.dg_ws = await websockets.connect(
                    url,
                    extra_headers=[("Authorization", f"Token {DEEPGRAM_API_KEY}")],
                    ping_interval=20
                )
                logger.info("✅ Deepgram STT connected (alt)")
            except Exception as e2:
                logger.error(f"❌ Deepgram connection failed: {e2}")
                # Send greeting anyway via TTS only
                await self._speak("Hi! This is Voxanne from CallWaiting A.I. How can I help you today?")
                return

        # Start state
        self.ctx.state = State.LISTENING
        
        # Send greeting
        await self._speak("Hi! This is Voxanne from CallWaiting A.I. How can I help you today?")
        
        # Background tasks
        self.tasks = [
            asyncio.create_task(self._stt_receiver()),
            asyncio.create_task(self._vad_monitor()),
        ]

    async def stop(self):
        """Clean shutdown"""
        for t in self.tasks:
            t.cancel()
        if self.dg_ws:
            await self.dg_ws.close()
        logger.info(f"📞 Call ended: {self.ctx.call_sid}")

    async def send_audio(self, payload: str):
        """Forward audio to Deepgram"""
        if self.dg_ws:
            try:
                await self.dg_ws.send(base64.b64decode(payload))
            except:
                pass

    # =========================================================================
    # STT RECEIVER
    # =========================================================================
    
    async def _stt_receiver(self):
        """Receive transcripts from Deepgram"""
        try:
            async for msg in self.dg_ws:
                data = json.loads(msg)
                logger.debug(f"📡 Deepgram: {data.get('type', 'unknown')}")
                
                if data.get("type") != "Results":
                    continue
                
                alt = data.get("channel", {}).get("alternatives", [{}])[0]
                text = alt.get("transcript", "").strip()
                is_final = data.get("is_final") or data.get("speech_final")
                confidence = alt.get("confidence", 0)
                
                logger.info(f"📝 STT: '{text}' (final: {is_final}, conf: {confidence:.2f})")
                
                if not text:
                    continue
                
                # ALWAYS process if we have text (bypass final check for now)
                if len(text) > 2:
                    # Barge-in detection
                    if self.ctx.state == State.SPEAKING:
                        logger.info(f"🛑 BARGE-IN: {text}")
                        self.ctx.cancel_tts = True
                        self.ctx.cancel_llm = True
                        await self._clear_twilio()
                        self.ctx.state = State.LISTENING
                    
                    # Process immediately (don't wait for final)
                    logger.info(f"🎤 Processing: {text}")
                    await self._process(text)
                    
        except Exception as e:
            logger.error(f"STT error: {e}")

    # =========================================================================
    # VAD MONITOR
    # =========================================================================
    
    async def _vad_monitor(self):
        """Detect end of speech"""
        while True:
            await asyncio.sleep(0.1)
            
            if self.ctx.state != State.LISTENING:
                continue
            
            if not self.ctx.transcript:
                continue
            
            silence = (time.time() - self.ctx.last_speech) * 1000
            if silence >= SILENCE_THRESHOLD_MS:
                text = self.ctx.transcript
                self.ctx.transcript = ""
                if len(text) > 2:
                    await self._process(text)

    # =========================================================================
    # LLM PROCESSING
    # =========================================================================
    
    async def _process(self, text: str):
        """Process user input through LLM"""
        self.ctx.state = State.PROCESSING
        self.ctx.messages.append({"role": "user", "content": text})
        self.ctx.cancel_llm = False
        
        try:
            response = ""
            buffer = ""
            
            stream = await self.groq.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=self.ctx.messages,
                max_tokens=150,
                temperature=0.7,
                stream=True
            )
            
            async for chunk in stream:
                if self.ctx.cancel_llm:
                    logger.info("🛑 LLM cancelled")
                    break
                
                delta = chunk.choices[0].delta.content
                if delta:
                    response += delta
                    buffer += delta
                    logger.debug(f"📝 Buffer: '{buffer}'")
                    
                    # Sentence-level TTS (more aggressive)
                    # Check for sentence endings or length threshold
                    if (any(punct in buffer for punct in ['.', '!', '?']) or 
                        len(buffer) > 50):  # Send after 50 chars if no punctuation
                        
                        logger.info(f"🎯 Triggering TTS for: '{buffer[:30]}...'")
                        
                        # Find the best break point
                        for end in ['. ', '! ', '? ', '.', '!', '?']:
                            if end in buffer:
                                parts = buffer.split(end, 1)
                                sentence = parts[0] + end.rstrip()
                                logger.info(f"📤 Sending sentence: '{sentence}'")
                                await self._speak(sentence)
                                buffer = parts[1] if len(parts) > 1 else ""
                                break
                        else:
                            # No punctuation found, send whole buffer
                            logger.info(f"📤 Sending buffer: '{buffer}'")
                            await self._speak(buffer)
                            buffer = ""
            
            logger.info(f"🏁 Stream ended. Response: '{response[:50]}...', Buffer: '{buffer}'")
            
            # Remaining text
            if buffer.strip() and not self.ctx.cancel_llm:
                await self._speak(buffer.strip())
            
            if response:
                self.ctx.messages.append({"role": "assistant", "content": response})
                # Keep history short
                if len(self.ctx.messages) > 20:
                    self.ctx.messages = [self.ctx.messages[0]] + self.ctx.messages[-18:]
                    
        except Exception as e:
            logger.error(f"LLM error: {e}")
            await self._speak("Sorry, could you repeat that?")
        
        if self.ctx.state != State.INTERRUPTED:
            self.ctx.state = State.LISTENING

    # =========================================================================
    # TTS
    # =========================================================================
    
    async def _speak(self, text: str):
        """Convert text to speech and send to Twilio"""
        if not text or self.ctx.cancel_tts:
            return
        
        self.ctx.state = State.SPEAKING
        self.ctx.is_speaking = True
        self.ctx.cancel_tts = False
        
        logger.info(f"🔊 Voxanne: {text[:50]}...")
        
        try:
            url = f"https://api.deepgram.com/v1/speak?model={TTS_MODEL}&encoding={TTS_ENCODING}&sample_rate={TTS_SAMPLE_RATE}"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    headers={
                        "Authorization": f"Token {DEEPGRAM_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={"text": text}
                ) as resp:
                    if resp.status == 200:
                        audio = await resp.read()
                        
                        # Stream in 20ms chunks
                        for i in range(0, len(audio), CHUNK_SIZE):
                            if self.ctx.cancel_tts:
                                break
                            chunk = audio[i:i+CHUNK_SIZE]
                            await self._send_audio_chunk(chunk)
                            await asyncio.sleep(0.018)
                    else:
                        logger.error(f"TTS error: {resp.status}")
                        
        except Exception as e:
            logger.error(f"TTS error: {e}")
        
        self.ctx.is_speaking = False

    async def _send_audio_chunk(self, chunk: bytes):
        """Send audio to Twilio"""
        msg = {
            "event": "media",
            "streamSid": self.ctx.stream_sid,
            "media": {"payload": base64.b64encode(chunk).decode()}
        }
        await self.ws.send_text(json.dumps(msg))

    async def _clear_twilio(self):
        """Clear Twilio audio buffer"""
        msg = {"event": "clear", "streamSid": self.ctx.stream_sid}
        await self.ws.send_text(json.dumps(msg))
        logger.info("🧹 Cleared audio")

# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(title="Voxanne Voice Agent")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# HEALTH ENDPOINTS
# -----------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"status": "ok", "agent": "voxanne", "version": "1.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "voxanne"}

# -----------------------------------------------------------------------------
# TWILIO ENDPOINTS
# -----------------------------------------------------------------------------

@app.api_route("/status", methods=["GET", "POST"])
async def status(request: Request):
    """Twilio status callback"""
    if request.method == "POST":
        try:
            form = await request.form()
            logger.info(f"📊 Status: {form.get('CallStatus', 'unknown')}")
        except:
            pass
    return Response(status_code=204)

@app.api_route("/twilio/incoming", methods=["GET", "POST"])
async def twilio_incoming(request: Request):
    """Return TwiML for incoming calls"""
    # Determine WebSocket host
    if PUBLIC_URL:
        ws_host = PUBLIC_URL.replace("https://", "").replace("http://", "")
    else:
        ws_host = request.headers.get("host", "localhost:3000")
    
    twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://{ws_host}/ws" />
    </Connect>
</Response>'''
    
    logger.info(f"📞 Incoming call -> wss://{ws_host}/ws")
    return PlainTextResponse(twiml, media_type="application/xml")

# -----------------------------------------------------------------------------
# WEBSOCKET
# -----------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_handler(ws: WebSocket):
    await ws.accept()
    logger.info("🔌 WebSocket connected")
    
    orchestrator: Optional[VoxanneOrchestrator] = None
    
    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)
            event = data.get("event")
            
            if event == "connected":
                logger.info("📞 Twilio connected")
                
            elif event == "start":
                stream_sid = data.get("streamSid")
                call_sid = data.get("start", {}).get("callSid", "unknown")
                orchestrator = VoxanneOrchestrator(ws, stream_sid, call_sid)
                await orchestrator.start()
                
            elif event == "media" and orchestrator:
                await orchestrator.send_audio(data["media"]["payload"])
                
            elif event == "stop":
                break
                
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if orchestrator:
            await orchestrator.stop()
        logger.info("🔌 WebSocket closed")

# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║  VOXANNE VOICE AGENT - PRODUCTION                            ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║    GET  /              -> Health check                       ║
║    GET  /health        -> Health check                       ║
║    POST /twilio/incoming -> TwiML                            ║
║    POST /status        -> Twilio callbacks                   ║
║    WS   /ws            -> Media stream                       ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    logger.info(f"🚀 Starting Voxanne on port {PORT}")
    logger.info(f"📡 Deepgram: {'✅' if DEEPGRAM_API_KEY else '❌'}")
    logger.info(f"🤖 Groq: {'✅' if GROQ_API_KEY else '❌'}")
    logger.info(f"🎤 Voice: {TTS_MODEL}")
    
    if PUBLIC_URL:
        logger.info(f"🌐 Public URL: {PUBLIC_URL}")
    
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
