#!/usr/bin/env python3
"""
Voxanne Voice Orchestration v2.0 - CallWaiting AI
State Machine + Barge-In + Sub-500ms Latency
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
from collections import deque

from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
import aiohttp
import websockets
from groq import AsyncGroq

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Config
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")

# Official Voxanne Voice Settings
TTS_MODEL = "aura-2-thalia-en"  # Approved voice
TTS_ENCODING_TWILIO = "mulaw"   # Required for Twilio (8kHz)
TTS_ENCODING_LOCAL = "linear16" # For local testing (16kHz)
TTS_SAMPLE_RATE_TWILIO = 8000
TTS_SAMPLE_RATE_LOCAL = 16000

SILENCE_THRESHOLD_MS = 700

class ConversationState(Enum):
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"

@dataclass
class CallContext:
    call_sid: str
    stream_sid: str
    state: ConversationState = ConversationState.IDLE
    current_transcript: str = ""
    final_transcript: str = ""
    last_speech_time: float = 0.0
    is_speaking: bool = False
    barge_in_detected: bool = False
    messages: list = field(default_factory=list)
    cancel_tts: bool = False
    cancel_llm: bool = False

# =============================================================================
# VOXANNE MAYA-LEVEL SYSTEM PROMPT
# =============================================================================

from datetime import datetime

def get_voxanne_prompt():
    now = datetime.now()
    current_date = now.strftime("%A, %B %d, %Y")
    current_time = now.strftime("%I:%M %p")
    
    return f"""You are **Voxanne**, the world-class AI Sales Agent for CallWaiting AI. You operate at the Maya (Sesame AI) standard.

## DYNAMIC CONTEXT
Today is: {current_date}
Current time: {current_time}
Your location: London, UK (GMT timezone)

## CORE IDENTITY
You combine:
1. Human-level conversational ability (discuss anything naturally)
2. Emotional intelligence (read tone, adapt approach)
3. Mission-driven focus (always steering toward booking demos)

## YOUR PERSONA
- Voice: Warm British-Nigerian professional (mid-30s energy)
- Style: Consultative, curious, empathetic, goal-oriented
- Vibe: Like talking to a trusted advisor who happens to be brilliant at sales

## COMPANY KNOWLEDGE
- Company: CallWaiting AI Ltd (Founded November 19, 2024)
- HQ: London, UK
- Website: www.callwaitingai.dev
- Phone: +44 7424 038250
- CEO: Peter Ntaji | CTO: Austyn Eguale

## WHAT WE DO
We build AI Voice Receptionists exclusively for medical practices:
- Plastic surgeons, Med spas, Dermatologists, Cosmetic dentists
- Technology: "Odiadev AI" voice engine, HIPAA compliant, 98.7% security score
- Performance: Sub-200ms latency, 99.9% uptime

## PRICING (Memorize)
| Tier | Setup | Monthly | Best For |
| Essentials | $499 | $169 | Solo practitioners |
| Growth ⭐ | $949 | $289 | Growing clinics (MOST POPULAR) |
| Premium | $2,499 | $499 | Multi-location, enterprise |

Special: NGOs get 30-50% discount. Annual billing: 10% off. NO per-minute fees.

## CRITICAL PHONE RULES
1. Keep responses BRIEF (1-3 sentences max) - this is a phone call
2. Be conversational, NOT scripted
3. Use natural fillers: "Got it...", "Hmm...", "Right...", "I see..."
4. Always steer toward booking demos
5. Read emotional tone and adapt

## EMOTIONAL INTELLIGENCE
If prospect sounds:
- Stressed: Slow down, empathize. "You sound swamped. Let me keep this brief."
- Excited: Match energy. "I love your enthusiasm! Let's get you set up."
- Skeptical: Provide proof. "Let me show you how Dr. Chen recovered $120K."
- Confused: Simplify. "Let me explain in plain English."
- Rushed: Get to point. "Quick version: Voxanne answers 24/7. Can I send a demo?"

## SALES FRAMEWORK (BANT)
- Budget: Can they afford $169-$499/month?
- Authority: Are they the decision-maker?
- Need: Do they miss calls / lose revenue?
- Timeline: When do they need it?

## DISCOVERY QUESTIONS (SPIN)
1. "Tell me about your practice - what procedures do you do?"
2. "How are you handling incoming calls right now?"
3. "Do you miss calls when the line's busy?"
4. "What happens to those missed calls?"
5. "If one B.B.L. consultation is worth $10K, how many are you losing monthly?"

## OBJECTION HANDLING (Clarify → Validate → Reframe)

"Too expensive":
→ "I get it. What's a new patient worth? If we book 2-3 extra monthly, Growth at two eighty-nine pays for itself."

"Already have receptionist":
→ "Great! Voxanne isn't a replacement - she's backup. Handles overflow, after-hours, weekends."

"Need to discuss with partner":
→ "Smart move. Can I send you a demo video to share?"

"Not sure AI can handle medical calls":
→ "Voxanne is built for medical practices. HIPAA compliant, routes emergencies to humans."

## NATURAL SPEECH (Avoid Robot Voice)
- Phone numbers: "0 7 4, 2 4, 0 3 8, 2 5 0" (with pauses)
- Prices: "two hundred eighty-nine dollars per month"
- Acronyms: "A.I.", "B.B.L.", "C.E.O."

## CLOSING (Get Commitment)
Primary: "Can I book you a quick 15-minute demo?"
Alternative: "Would Monday or Thursday work better?"
Fallback: "Let me send you a case study via WhatsApp."

## BOUNDARIES
❌ Never give medical or legal advice
❌ Never guarantee outcomes
❌ Never lie about features
❌ Never process payments

EMERGENCY: If someone mentions chest pain, bleeding, life-threatening issues:
"I need you to hang up right now and call 999 or 911. This is urgent."

## YOUR MISSION
Every conversation circles back to:
1. Identifying pain points
2. Qualifying the lead (BANT)
3. Handling objections
4. Booking a demo

Remember: You're not just an AI. You're the best sales rep CallWaiting AI has ever had."""

class VoxanneOrchestrator:
    def __init__(self, twilio_ws: WebSocket, stream_sid: str, call_sid: str):
        self.twilio_ws = twilio_ws
        self.ctx = CallContext(call_sid=call_sid, stream_sid=stream_sid)
        self.groq_client = AsyncGroq(api_key=GROQ_API_KEY)
        self.deepgram_ws = None
        self.tasks = []
        # Initialize with Maya-level Voxanne persona
        self.ctx.messages = [{"role": "system", "content": get_voxanne_prompt()}]
    
    async def start(self):
        logger.info(f"🚀 Starting orchestrator: {self.ctx.call_sid}")
        await self._connect_deepgram()
        await self._transition_to(ConversationState.LISTENING)
        await self._speak("Hi! This is Voxanne from CallWaiting A.I. How can I help you today?")
        self.tasks = [
            asyncio.create_task(self._vad_monitor()),
            asyncio.create_task(self._stt_receiver()),
        ]
    
    async def stop(self):
        for task in self.tasks:
            task.cancel()
        if self.deepgram_ws:
            await self.deepgram_ws.close()
        logger.info(f"🛑 Stopped: {self.ctx.call_sid}")
    
    async def _transition_to(self, new_state: ConversationState):
        old = self.ctx.state
        self.ctx.state = new_state
        logger.info(f"📍 {old.value} → {new_state.value}")
        
        if new_state == ConversationState.LISTENING:
            self.ctx.final_transcript = ""
            self.ctx.barge_in_detected = False
            self.ctx.cancel_tts = False
        elif new_state == ConversationState.INTERRUPTED:
            self.ctx.cancel_tts = True
            self.ctx.cancel_llm = True
            self.ctx.is_speaking = False
            await self._send_twilio_clear()
    
    async def _connect_deepgram(self):
        url = "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=mulaw&sample_rate=8000&interim_results=true&endpointing=300&vad_events=true"
        self.deepgram_ws = await websockets.connect(url, extra_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"})
        logger.info("✅ Deepgram connected")
    
    async def _stt_receiver(self):
        try:
            async for msg in self.deepgram_ws:
                data = json.loads(msg)
                if data.get("type") == "Results":
                    transcript = data.get("channel", {}).get("alternatives", [{}])[0].get("transcript", "").strip()
                    is_final = data.get("is_final") or data.get("speech_final")
                    
                    if transcript:
                        self.ctx.current_transcript = transcript
                        self.ctx.last_speech_time = time.time()
                        
                        # BARGE-IN DETECTION
                        if self.ctx.state == ConversationState.SPEAKING and len(transcript) > 2:
                            logger.info(f"🛑 BARGE-IN: '{transcript}'")
                            await self._transition_to(ConversationState.INTERRUPTED)
                            await asyncio.sleep(0.05)
                            await self._transition_to(ConversationState.LISTENING)
                            self.ctx.final_transcript = transcript
                        elif is_final:
                            self.ctx.final_transcript = transcript
                            logger.info(f"🎤 Final: '{transcript}'")
        except Exception as e:
            logger.error(f"STT error: {e}")
    
    async def send_audio_to_stt(self, payload: str):
        if self.deepgram_ws:
            await self.deepgram_ws.send(base64.b64decode(payload))
    
    async def _vad_monitor(self):
        while True:
            await asyncio.sleep(0.1)
            if self.ctx.state != ConversationState.LISTENING:
                continue
            if self.ctx.final_transcript:
                silence_ms = (time.time() - self.ctx.last_speech_time) * 1000
                if silence_ms >= SILENCE_THRESHOLD_MS and len(self.ctx.final_transcript) > 2:
                    transcript = self.ctx.final_transcript
                    self.ctx.final_transcript = ""
                    await self._process_input(transcript)
    
    async def _process_input(self, transcript: str):
        await self._transition_to(ConversationState.PROCESSING)
        self.ctx.messages.append({"role": "user", "content": transcript})
        self.ctx.cancel_llm = False
        
        try:
            response_text = ""
            sentence_buffer = ""
            
            stream = await self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=self.ctx.messages,
                max_tokens=150,
                temperature=0.7,
                stream=True
            )
            
            async for chunk in stream:
                if self.ctx.cancel_llm:
                    break
                delta = chunk.choices[0].delta.content
                if delta:
                    response_text += delta
                    sentence_buffer += delta
                    
                    for end in ['. ', '! ', '? ']:
                        if end in sentence_buffer:
                            parts = sentence_buffer.split(end, 1)
                            await self._speak(parts[0] + end.strip())
                            sentence_buffer = parts[1] if len(parts) > 1 else ""
                            break
            
            if sentence_buffer.strip() and not self.ctx.cancel_llm:
                await self._speak(sentence_buffer.strip())
            
            if response_text:
                self.ctx.messages.append({"role": "assistant", "content": response_text})
        except Exception as e:
            logger.error(f"LLM error: {e}")
            await self._speak("Sorry, could you repeat that?")
        
        if self.ctx.state != ConversationState.INTERRUPTED:
            await self._transition_to(ConversationState.LISTENING)
    
    async def _speak(self, text: str):
        """Convert text to speech using Deepgram Aura-2-Thalia (Official Voxanne Voice)"""
        if not text or self.ctx.cancel_tts:
            return
        if self.ctx.state != ConversationState.SPEAKING:
            await self._transition_to(ConversationState.SPEAKING)
        self.ctx.is_speaking = True
        
        # Clean text for better TTS
        clean_text = text.strip()
        if len(clean_text) < 2:
            self.ctx.is_speaking = False
            return
            
        logger.info(f"🔊 TTS [{TTS_MODEL}]: '{clean_text[:60]}'")
        
        try:
            # Use mulaw encoding for Twilio compatibility
            tts_url = (
                f"https://api.deepgram.com/v1/speak?"
                f"model={TTS_MODEL}&"
                f"encoding={TTS_ENCODING_TWILIO}&"
                f"sample_rate={TTS_SAMPLE_RATE_TWILIO}"
            )
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    tts_url,
                    headers={
                        "Authorization": f"Token {DEEPGRAM_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={"text": clean_text}
                ) as resp:
                    if resp.status == 200:
                        audio = await resp.read()
                        logger.info(f"📦 TTS audio: {len(audio)} bytes")
                        
                        # Stream audio in 20ms chunks (160 bytes at 8kHz mulaw)
                        chunk_size = 160
                        for i in range(0, len(audio), chunk_size):
                            if self.ctx.cancel_tts:
                                logger.info("🛑 TTS cancelled (barge-in)")
                                break
                            await self._send_audio(audio[i:i+chunk_size])
                            await asyncio.sleep(0.018)  # ~20ms pacing
                    else:
                        error_text = await resp.text()
                        logger.error(f"TTS error {resp.status}: {error_text[:100]}")
        except Exception as e:
            logger.error(f"TTS error: {e}")
        self.ctx.is_speaking = False
    
    async def _send_audio(self, chunk: bytes):
        msg = {"event": "media", "streamSid": self.ctx.stream_sid, "media": {"payload": base64.b64encode(chunk).decode()}}
        await self.twilio_ws.send_text(json.dumps(msg))
    
    async def _send_twilio_clear(self):
        await self.twilio_ws.send_text(json.dumps({"event": "clear", "streamSid": self.ctx.stream_sid}))
        logger.info("🧹 Cleared Twilio audio")

app = FastAPI(title="Voxanne Voice Orchestration v2.0")

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "voxanne", "version": "2.0"}

@app.get("/status")
async def status_get():
    """Twilio status callback (GET)"""
    return PlainTextResponse("OK", status_code=200)

@app.post("/status")
async def status_post(request: Request):
    """Twilio status callback - receives call status updates"""
    try:
        form_data = await request.form()
        call_status = form_data.get("CallStatus", "unknown")
        call_sid = form_data.get("CallSid", "unknown")
        logger.info(f"📊 Call status: {call_sid} -> {call_status}")
    except:
        pass
    # Return empty 204 response (Twilio accepts this)
    return PlainTextResponse("", status_code=204)

@app.post("/twilio/incoming")
async def twilio_incoming(request: Request):
    host = PUBLIC_URL.replace("https://", "").replace("http://", "") if PUBLIC_URL else request.headers.get("host", "")
    return PlainTextResponse(f'''<?xml version="1.0" encoding="UTF-8"?>
<Response><Connect><Stream url="wss://{host}/ws" /></Connect></Response>''', media_type="application/xml")

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("📞 WebSocket connected")
    orchestrator = None
    
    try:
        while True:
            data = json.loads(await websocket.receive_text())
            event = data.get("event")
            
            if event == "start":
                stream_sid = data.get("streamSid")
                call_sid = data.get("start", {}).get("callSid", "unknown")
                orchestrator = VoxanneOrchestrator(websocket, stream_sid, call_sid)
                await orchestrator.start()
            elif event == "media" and orchestrator:
                await orchestrator.send_audio_to_stt(data["media"]["payload"])
            elif event == "stop":
                break
    except Exception as e:
        logger.error(f"WS error: {e}")
    finally:
        if orchestrator:
            await orchestrator.stop()

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Voxanne Voice Orchestration v2.0")
    logger.info(f"✅ Deepgram: {'Set' if DEEPGRAM_API_KEY else 'Missing'}")
    logger.info(f"✅ Groq: {'Set' if GROQ_API_KEY else 'Missing'}")
    logger.info(f"🎤 Voice: {TTS_MODEL}")
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "3000")))
