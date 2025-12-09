#!/usr/bin/env python3
"""
ROXANNE V2 - ConversationManager-based Voice Orchestration
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

load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("roxanne-v2")

# =============================================================================
# ENVIRONMENT & CONFIG
# =============================================================================

DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")

# Feature flags
ENDPOINT_MS = int(os.getenv("ENDPOINT_MS", "180"))
ENABLE_BARGE_IN_V2 = os.getenv("ENABLE_BARGE_IN_V2", "false").lower() == "true"
ENABLE_HUMANIZER = os.getenv("ENABLE_HUMANIZER", "false").lower() == "true"

# =============================================================================
# SYSTEM PROMPT - Professional Voice Receptionist
# =============================================================================

SYSTEM_PROMPT = """You are Roxanne, a professional AI receptionist for CallWaiting AI.

CONTEXT:
- CallWaiting AI provides AI voice receptionists for medical practices
- You answer inbound calls from potential customers
- Your goal: Qualify interest and book a 15-minute demo

CONVERSATION FLOW:
1. GREETING - You generate a fresh, natural greeting for each new call
2. DISCOVERY - Ask ONE question at a time about their practice
3. QUALIFY - Understand their pain points with missed calls
4. PITCH - Briefly explain how we help (only after they share a problem)
5. CLOSE - Offer to book a demo or send info

RULES:
- Keep responses under 30 words
- Ask only ONE question per response
- Stay on topic: medical practice operations, missed calls, scheduling
- Never ask about personal details, phones, or unrelated topics
- If confused, ask them to clarify
- Be warm but professional

SPEECH STYLE (for natural TTS):
- Short sentences (max 12 words each)
- Use contractions (I'm, we're, you'll)
- Natural punctuation for pacing

GREETING RULES:
- Vary your greeting wording between calls
- Always introduce yourself and the company
- Optionally mention time of day ("Good morning", "Good afternoon")
- Example patterns (do NOT reuse verbatim each time):
  - "Good morning, this is Roxanne with CallWaiting AI. How can I help today?"
  - "Hi, you've reached Roxanne at CallWaiting AI. What can I do for you?"
  - "Thanks for calling CallWaiting AI, this is Roxanne. How may I assist?"

TOPICS YOU CAN DISCUSS:
- Their practice type (dental, medical, specialty)
- How they currently handle calls
- Problems with missed calls or after-hours
- Our AI receptionist solution
- Booking a demo

TOPICS TO AVOID:
- Personal questions unrelated to their business
- Technical details about AI/ML
- Pricing (say "depends on practice size, we can discuss in the demo")
- Competitors by name

If the caller seems confused or asks what this is about, say:
"CallWaiting AI helps medical practices never miss a call. We use AI to answer phones, book appointments, and handle patient questions. Would you like to see how it works?"
"""

# =============================================================================
# FASTAPI APP
# =============================================================================

app = FastAPI(title="Roxanne V2 - ConversationManager")


@app.get("/")
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": "roxanne-v2",
        "mode": "ConversationManager",
        "endpoint_ms": ENDPOINT_MS,
        "barge_in_v2": ENABLE_BARGE_IN_V2,
        "humanizer": ENABLE_HUMANIZER,
    }


@app.api_route("/status", methods=["GET", "POST"])
async def status():
    return PlainTextResponse("", status_code=204)


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
    
    await ws.send_json({"type": "connected", "message": "Roxanne V2 is ready"})
    
    # For now, use the same logic as main.py's WebClientAgent
    # TODO: Refactor to use ConversationManager for web clients too
    from main import WebClientAgent
    
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
    print("  ROXANNE V2 - ConversationManager Architecture")
    print("=" * 60)
    print(f"  📡 Deepgram: {'✅' if DEEPGRAM_KEY else '❌'}")
    print(f"  🤖 Groq: {'✅' if GROQ_KEY else '❌'}")
    print(f"  🌐 Port: {port}")
    print(f"  ⚡ Endpointing: {ENDPOINT_MS}ms")
    print(f"  🚨 Barge-in V2: {ENABLE_BARGE_IN_V2}")
    print(f"  🎭 Humanizer: {ENABLE_HUMANIZER}")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=port)
