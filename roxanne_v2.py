#!/usr/bin/env python3
"""
VOXANNE V2 - ConversationManager-based Voice Orchestration
===========================================================
Uses the new state machine architecture for:
  - Sub-500ms voice-to-voice latency
  - Hard barge-in cancellation
  - Sentence-level TTS streaming
  - Detailed latency metrics

This file provides the FastAPI app for v2 mode.
"""

import asyncio
import json
import os
import logging

from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv

from conversation_manager import ConversationManager, ConversationState
from collections import deque
from datetime import datetime
import threading
import aiohttp
import websockets
from groq import AsyncGroq

load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("voxanne-v2")

# =============================================================================
# ENVIRONMENT & CONFIG
# =============================================================================

DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")

# Feature flags (OPTIMIZED DEFAULTS FOR VAPI-LEVEL QUALITY)
ENDPOINT_MS = int(os.getenv("ENDPOINT_MS", "150"))  # Reduced from 180ms for faster turn-taking
ENABLE_BARGE_IN_V2 = os.getenv("ENABLE_BARGE_IN_V2", "true").lower() == "true"  # ENABLED: Hard barge-in cancellation
ENABLE_HUMANIZER = os.getenv("ENABLE_HUMANIZER", "true").lower() == "true"  # ENABLED: Post-processing for natural TTS

# =============================================================================
# SYSTEM PROMPT - Voxanne Support (shared with web chat / support widget)
# =============================================================================

SYSTEM_PROMPT = """
You are "Voxanne Support", a friendly, concise support assistant for CallWaiting AI (callwaitingai.dev).

YOUR JOB
- Help website visitors and customers understand what Voxanne does.
- Answer FAQs about features, pricing, onboarding, and technical setup.
- Qualify interested clinics and guide them to book a demo or talk to a human.
- Never invent product capabilities or prices that are not in the knowledge base.

TONE & STYLE
- Be warm, clear, and professional. Short paragraphs, no walls of text.
- Prefer bullet points and step-by-step instructions.
- Assume the user is busy – get to the point quickly.
- Use simple language (B2B, non-technical clinic owners and managers).

WHAT VOXANNE DOES (HIGH LEVEL)
- AI receptionist for aesthetic / medical clinics.
- Answers 100% of calls (inbound + outbound), books appointments, sends reminders.
- Integrates with phone system and calendar (explain at high level only, unless user asks).
- Main value: fewer missed calls, more booked appointments, more monthly revenue.

FAQ TOPICS TO COVER
- What Voxanne is and how it works day to day.
- Who it is for (aesthetic clinics, med spas, cosmetic surgeons, etc.).
- Pricing tiers (Essentials, Growth, Premium, Enterprise) in approximate ranges, not exact custom quotes.
- Setup time and onboarding steps.
- Basic integrations (phone numbers, calendars, EMR/CRM if applicable).
- Call quality, accents, and patient experience.
- Security and data privacy at a high level.

IF YOU DON'T KNOW
- If you are not sure, say you are not sure.
- Offer to connect the person with a human, or to submit their question to the team.
- Never make up technical details, compliance claims, or contracts.

QUALIFYING INTEREST
When someone seems interested, ask a few light questions:
- What type of clinic are you? (e.g. med spa, plastic surgery, dermatology)
- How many locations and approximate monthly patient calls?
- Do you mainly lose calls during busy hours, after-hours, or both?

If they answer:
- Suggest a demo and share the booking link if provided in the tools/knowledge base.
- Summarize how Voxanne could help in their specific situation in 2–4 bullet points.

ESCALATION RULES
- If the user is angry, frustrated, or mentions billing issues: stay calm, apologize, and offer to escalate.
- If conversation touches legal, medical, or compliance questions:
  - Give only high-level information.
  - Recommend speaking with a qualified professional or our team.
- If the user explicitly asks to talk to a human:
  - Collect their name, email, clinic name, and the best time to reach them.
  - Provide whatever escalation / contact option is defined in your tools.

DATA & SECURITY
- Never ask for passwords, full payment card numbers, or any sensitive credential.
- If user shares sensitive data, acknowledge and advise them not to share such details in chat.
- Do not promise specific legal or regulatory compliance beyond what is stated in the knowledge base.

CONVERSATION RULES
- Always confirm your understanding of the question before giving a long answer.
- Ask one clarifying question at a time if the request is vague.
- When giving instructions (e.g. how to set up phone numbers or DNS), use clear numbered steps.
- At the end of useful answers, offer a simple next step (e.g. "Would you like the 2-minute demo link?" or "Do you want me to explain pricing options?").

LIMITATIONS
YOU USE TEXT AND VOICE OUTREACH 
- You cannot directly perform actions in their account unless tools are explicitly provided.
- If tools exist (e.g. to look up account status), use them; otherwise be honest about the limitation.

Your primary goal: help the visitor quickly understand whether Voxanne is right for their clinic, answer their questions accurately, and smoothly guide qualified prospects toward a demo or conversation with the team.
"""

# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(title="Voxanne V2 - ConversationManager")

# =============================================================================
# STAGE 6: OBSERVABILITY - Session & Metrics Tracking
# =============================================================================

# Thread-safe metrics storage
class MetricsStore:
    """Store for session metrics and observability data."""
    
    def __init__(self, max_sessions: int = 100):
        self._lock = threading.Lock()
        self._sessions = deque(maxlen=max_sessions)
        self._total_calls = 0
        self._total_barge_ins = 0
        self._start_time = datetime.now()
    
    def record_session(self, session_data: dict):
        """Record a completed session."""
        with self._lock:
            self._sessions.append({
                **session_data,
                "recorded_at": datetime.now().isoformat()
            })
            self._total_calls += 1
            self._total_barge_ins += session_data.get("barge_in_count", 0)
    
    def get_stats(self) -> dict:
        """Get aggregate statistics."""
        with self._lock:
            sessions = list(self._sessions)
            
            # Calculate averages
            if sessions:
                avg_turn_latency = sum(
                    s.get("avg_turn_latency_ms", 0) for s in sessions
                ) / len(sessions)
                avg_turns = sum(
                    s.get("turn_count", 0) for s in sessions
                ) / len(sessions)
            else:
                avg_turn_latency = 0
                avg_turns = 0
            
            return {
                "uptime_seconds": (datetime.now() - self._start_time).total_seconds(),
                "total_calls": self._total_calls,
                "total_barge_ins": self._total_barge_ins,
                "recent_sessions": len(sessions),
                "avg_turn_latency_ms": round(avg_turn_latency, 1),
                "avg_turns_per_call": round(avg_turns, 1),
            }
    
    def get_recent_sessions(self, limit: int = 10) -> list:
        """Get recent session details."""
        with self._lock:
            return list(self._sessions)[-limit:]


metrics_store = MetricsStore()


@app.get("/")
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": "voxanne-v2",
        "mode": "ConversationManager",
        "endpoint_ms": ENDPOINT_MS,
        "barge_in_v2": ENABLE_BARGE_IN_V2,
        "humanizer": ENABLE_HUMANIZER,
    }


@app.get("/metrics")
async def get_metrics():
    """Get aggregate metrics for monitoring."""
    stats = metrics_store.get_stats()
    return {
        "status": "ok",
        "config": {
            "endpoint_ms": ENDPOINT_MS,
            "barge_in_v2": ENABLE_BARGE_IN_V2,
            "humanizer": ENABLE_HUMANIZER,
        },
        "stats": stats,
    }


@app.get("/metrics/sessions")
async def get_recent_sessions(limit: int = 10):
    """Get recent session details for debugging."""
    sessions = metrics_store.get_recent_sessions(limit)
    return {
        "count": len(sessions),
        "sessions": sessions,
    }


@app.api_route("/status", methods=["GET", "POST"])
async def status():
    return PlainTextResponse("", status_code=204)


@app.get("/health/deep")
async def deep_health_check():
    """Test all external dependencies."""
    checks = {
        "deepgram_stt": False,
        "deepgram_tts": False,
        "groq_llm": False,
    }
    
    # Test Deepgram STT
    try:
        async with websockets.connect(
            "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000",
            extra_headers={"Authorization": f"Token {DEEPGRAM_KEY}"},
            close_timeout=3,
            open_timeout=5,
        ) as ws:
            checks["deepgram_stt"] = True
    except Exception as e:
        logger.warning(f"Deepgram STT health check failed: {e}")
    
    # Test Deepgram TTS
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3",
                headers={"Authorization": f"Token {DEEPGRAM_KEY}"},
                json={"text": "test"},
                timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status == 200:
                    checks["deepgram_tts"] = True
    except Exception as e:
        logger.warning(f"Deepgram TTS health check failed: {e}")
    
    # Test Groq LLM
    try:
        groq = AsyncGroq(api_key=GROQ_KEY)
        response = await groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=5,
        )
        if response.choices:
            checks["groq_llm"] = True
    except Exception as e:
        logger.warning(f"Groq LLM health check failed: {e}")
    
    all_healthy = all(checks.values())
    return {
        "status": "healthy" if all_healthy else "degraded",
        "checks": checks,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/twilio/incoming")
@app.post("/twilio/voice")
async def twilio_incoming(request: Request):
    """Handle incoming Twilio call - return TwiML to connect Media Stream."""
    host = PUBLIC_URL.replace("https://", "").replace("http://", "") if PUBLIC_URL else request.headers.get("host")
    
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://{host}/ws" />
    </Connect>
</Response>"""
    
    return PlainTextResponse(twiml, media_type="application/xml")


@app.websocket("/ws")
async def twilio_websocket(ws: WebSocket):
    """Handle Twilio Media Stream WebSocket."""
    await ws.accept()
    logger.info("📞 Twilio WebSocket connected")
    
    manager: ConversationManager = None
    
    try:
        while True:
            message = await ws.receive_text()
            data = json.loads(message)
            event = data.get("event")
            
            if event == "connected":
                logger.info("📞 Twilio stream connected")
                
            elif event == "start":
                # Initialize ConversationManager
                stream_sid = data.get("streamSid")
                call_sid = data.get("start", {}).get("callSid", "unknown")
                
                manager = ConversationManager(
                    twilio_ws=ws,
                    deepgram_key=DEEPGRAM_KEY,
                    groq_key=GROQ_KEY,
                    system_prompt=SYSTEM_PROMPT,
                    endpoint_ms=ENDPOINT_MS,
                    enable_barge_in_v2=ENABLE_BARGE_IN_V2,
                    enable_humanizer=ENABLE_HUMANIZER,
                )
                
                await manager.start(call_sid, stream_sid)
                
            elif event == "media" and manager:
                # Forward audio to manager
                audio_payload = data.get("media", {}).get("payload", "")
                await manager.handle_audio(audio_payload)
                
            elif event == "stop":
                logger.info("📞 Twilio stream stopped")
                break
                
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
    finally:
        if manager:
            # Record session metrics before stopping
            session_data = manager.get_session_metrics()
            if session_data:
                metrics_store.record_session(session_data)
            await manager.stop()
        logger.info("📞 Twilio WebSocket closed")


# =============================================================================
# WEB CLIENT WEBSOCKET (for browser voice chat)
# =============================================================================

@app.websocket("/ws/web-client")
async def web_client_websocket(ws: WebSocket):
    """Handle web browser voice client WebSocket."""
    await ws.accept()
    logger.info("🌐 Web client connected")
    
    await ws.send_json({"type": "connected", "message": "Voxanne V2 is ready"})
    
    # WebClientAgent class for browser voice clients
    # Uses the Voxanne Support prompt defined above (lines 51-122)
    
    class WebClientAgent:
        """Agent for handling web browser voice clients."""
        
        def __init__(self, ws: WebSocket):
            self.ws = ws
            self.deepgram_ws = None
            self.groq = AsyncGroq(api_key=GROQ_KEY)
            self.http_session = None
            self.messages = [{"role": "system", "content": SYSTEM_PROMPT}]  # Uses roxanne_v2.SYSTEM_PROMPT
            self.state = ConversationState.LISTENING
            self.is_speaking = False
            self.cancel_speech = False
            self.tasks = []
            
        async def start(self):
            """Initialize connections."""
            self.http_session = aiohttp.ClientSession()
            await self._connect_deepgram()
            
            # Wait for Deepgram to be fully ready before signaling ready
            max_wait = 30  # 3 seconds max
            for _ in range(max_wait):
                if self.deepgram_ws and self.deepgram_ws.open:
                    break
                await asyncio.sleep(0.1)
            
            if not self.deepgram_ws or not self.deepgram_ws.open:
                raise Exception("Deepgram failed to connect within 3 seconds")
            
            logger.info("🌐 Web client agent started and ready")
            
        async def stop(self):
            """Clean up resources."""
            for task in self.tasks:
                task.cancel()
            if self.deepgram_ws:
                await self.deepgram_ws.close()
            if self.http_session:
                await self.http_session.close()
            logger.info("🌐 Web client agent stopped")
            
        async def _connect_deepgram(self):
            """Connect to Deepgram for STT with web audio settings."""
            # Web browsers typically send 16kHz PCM audio
            url = (
                "wss://api.deepgram.com/v1/listen?"
                "model=nova-2&encoding=linear16&sample_rate=16000&channels=1&"
                "interim_results=true&endpointing=180&utterance_end_ms=1000&"
                "smart_format=true&punctuate=true"
            )
            
            logger.info(f"🎤 Connecting to Deepgram STT... (key: {DEEPGRAM_KEY[:8]}...)")
            
            # Use extra_headers for newer websockets versions, fallback for older
            try:
                self.deepgram_ws = await asyncio.wait_for(
                    websockets.connect(
                        url, 
                        extra_headers={"Authorization": f"Token {DEEPGRAM_KEY}"},
                        close_timeout=5,
                        open_timeout=10,
                    ),
                    timeout=15
                )
            except TypeError:
                # Fallback for older websockets versions
                self.deepgram_ws = await asyncio.wait_for(
                    websockets.connect(
                        url,
                        additional_headers={"Authorization": f"Token {DEEPGRAM_KEY}"},
                    ),
                    timeout=15
                )
            except asyncio.TimeoutError:
                logger.error("❌ Deepgram connection timed out")
                raise Exception("Failed to connect to Deepgram - timeout")
            
            # Start listening for transcripts
            task = asyncio.create_task(self._listen_deepgram())
            self.tasks.append(task)
            
            # Start keepalive ping to prevent timeout
            keepalive_task = asyncio.create_task(self._keepalive_deepgram())
            self.tasks.append(keepalive_task)
            
            logger.info(f"🎤 Deepgram connected for web client (WebSocket state: {self.deepgram_ws.open})")
            
        async def _listen_deepgram(self):
            """Listen for Deepgram transcripts."""
            try:
                async for message in self.deepgram_ws:
                    logger.debug(f"📥 Deepgram message received: {message[:200]}")
                    data = json.loads(message)
                    
                    if data.get("type") == "Results":
                        alt = data.get("channel", {}).get("alternatives", [{}])[0]
                        transcript = alt.get("transcript", "").strip()
                        is_final = data.get("is_final", False)
                        speech_final = data.get("speech_final", False)
                        
                        if transcript:
                            # Send transcript to web client
                            await self.ws.send_json({
                                "type": "transcript",
                                "text": transcript,
                                "is_final": is_final or speech_final,
                                "speaker": "user",
                                "confidence": alt.get("confidence", 0)
                            })
                            
                            # Process final transcripts (check BOTH flags)
                            if (is_final or speech_final) and self.state == ConversationState.LISTENING:
                                logger.info(f"🎯 Triggering LLM for: '{transcript}' (is_final={is_final}, speech_final={speech_final})")
                                await self._process_input(transcript)
                                
            except Exception as e:
                logger.error(f"❌ Deepgram listener error: {e}", exc_info=True)
                
        async def _keepalive_deepgram(self):
            """Send ping every 10s to keep Deepgram WebSocket alive."""
            try:
                while self.deepgram_ws and self.deepgram_ws.open:
                    await asyncio.sleep(10)
                    if self.deepgram_ws and self.deepgram_ws.open:
                        await self.deepgram_ws.ping()
                        logger.debug("🏓 Sent keepalive ping to Deepgram")
            except Exception as e:
                logger.warning(f"⚠️ Keepalive ping failed: {e}")
                
        async def send_audio_bytes(self, audio_bytes: bytes):
            """Send raw audio bytes to Deepgram."""
            logger.debug(f"📤 Sending {len(audio_bytes)} bytes to Deepgram")
            if self.deepgram_ws and self.state == ConversationState.LISTENING:
                try:
                    # Check if WebSocket is still open
                    if not self.deepgram_ws.open:
                        logger.warning("⚠️ Deepgram WebSocket closed, reconnecting...")
                        await self._connect_deepgram()
                    
                    await self.deepgram_ws.send(audio_bytes)
                    logger.debug("✅ Audio sent successfully")
                except Exception as e:
                    logger.error(f"❌ Error sending audio to Deepgram: {e}", exc_info=True)
                    # Try to reconnect on error
                    try:
                        logger.info("🔄 Attempting to reconnect to Deepgram...")
                        await self._connect_deepgram()
                    except Exception as reconnect_error:
                        logger.error(f"❌ Reconnection failed: {reconnect_error}")
                    
        async def _process_input(self, text: str):
            """Process user input and generate response."""
            if not text or len(text) < 2:
                return
                
            self.state = ConversationState.PROCESSING
            self.cancel_speech = False
            
            # Notify client we're processing
            await self.ws.send_json({"type": "state", "to": "PROCESSING"})
            
            self.messages.append({"role": "user", "content": text})
            
            try:
                # Stream LLM response
                response_text = ""
                sentence_buffer = ""
                
                stream = await self.groq.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=self.messages,
                    temperature=0.9,
                    max_tokens=200,
                    stream=True
                )
                
                self.state = ConversationState.SPEAKING
                self.is_speaking = True
                await self.ws.send_json({"type": "state", "to": "SPEAKING"})
                
                async for chunk in stream:
                    if self.cancel_speech:
                        break
                        
                    delta = chunk.choices[0].delta.content or ""
                    response_text += delta
                    sentence_buffer += delta
                    
                    # Check for sentence boundaries
                    for punct in [". ", "! ", "? ", ".\n", "!\n", "?\n"]:
                        if punct in sentence_buffer:
                            parts = sentence_buffer.split(punct, 1)
                            sentence = parts[0] + punct.strip()
                            sentence_buffer = parts[1] if len(parts) > 1 else ""
                            
                            if sentence.strip():
                                # Send text to client
                                await self.ws.send_json({
                                    "type": "response",
                                    "text": sentence.strip(),
                                    "speaker": "agent"
                                })
                                
                                # Generate and stream TTS
                                await self._speak_sentence(sentence.strip())
                            break
                            
                # Handle remaining text
                if sentence_buffer.strip() and not self.cancel_speech:
                    await self.ws.send_json({
                        "type": "response",
                        "text": sentence_buffer.strip(),
                        "speaker": "agent"
                    })
                    await self._speak_sentence(sentence_buffer.strip())
                    
                # Save response
                if response_text:
                    self.messages.append({"role": "assistant", "content": response_text})
                    
            except Exception as e:
                logger.error(f"❌ LLM error: {e}", exc_info=True)
                await self.ws.send_json({"type": "error", "error": str(e)})
            finally:
                self.state = ConversationState.LISTENING
                self.is_speaking = False
                await self.ws.send_json({"type": "state", "to": "LISTENING"})
                
        async def _speak_sentence(self, text: str):
            """Generate TTS and send audio to web client."""
            if self.cancel_speech:
                return
                
            logger.info(f"🔊 Generating TTS for: {text[:50]}...")
            try:
                # Use Deepgram TTS with web-compatible format (mp3)
                TTS_MODEL = "aura-2-thalia-en"
                url = f"https://api.deepgram.com/v1/speak?model={TTS_MODEL}&encoding=mp3"
                
                async with self.http_session.post(
                    url,
                    headers={
                        "Authorization": f"Token {DEEPGRAM_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={"text": text}
                ) as resp:
                    logger.info(f"🔊 TTS response status: {resp.status}")
                    if resp.status == 200:
                        audio_data = await resp.read()
                        logger.info(f"🔊 TTS audio size: {len(audio_data)} bytes")
                        # Send as binary WebSocket message
                        await self.ws.send_bytes(audio_data)
                    else:
                        logger.error(f"❌ TTS error: {resp.status}")
                        
            except Exception as e:
                logger.error(f"❌ TTS error: {e}", exc_info=True)
    
    agent = None
    
    try:
        agent = WebClientAgent(ws)
        await agent.start()
        
        while True:
            message = await ws.receive()
            
            if message["type"] == "websocket.receive":
                if "text" in message:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")
                    
                    if msg_type == "ping":
                        await ws.send_json({"type": "pong"})
                    elif msg_type == "stop":
                        break
                        
                elif "bytes" in message:
                    audio_bytes = message["bytes"]
                    if agent and len(audio_bytes) > 0:
                        await agent.send_audio_bytes(audio_bytes)
                        
            elif message["type"] == "websocket.disconnect":
                break
                
    except Exception as e:
        logger.error(f"❌ Web client error: {e}")
        try:
            await ws.send_json({"type": "error", "error": str(e)})
        except:
            pass
    finally:
        if agent:
            await agent.stop()
        logger.info("🌐 Web client disconnected")


# =============================================================================
# ENTRYPOINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    
    print("=" * 60)
    print("  VOXANNE V2 - ConversationManager Architecture")
    print("=" * 60)
    print(f"  📡 Deepgram: {'✅' if DEEPGRAM_KEY else '❌'}")
    print(f"  🤖 Groq: {'✅' if GROQ_KEY else '❌'}")
    print(f"  🌐 Port: {port}")
    print(f"  ⚡ Endpointing: {ENDPOINT_MS}ms")
    print(f"  🚨 Barge-in V2: {ENABLE_BARGE_IN_V2}")
    print(f"  🎭 Humanizer: {ENABLE_HUMANIZER}")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=port)
