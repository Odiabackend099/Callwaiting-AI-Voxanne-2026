#!/usr/bin/env python3
"""
Voxanne Voice Agent - Clean Implementation
Twilio Media Stream → Deepgram STT → Groq LLM → Deepgram TTS → Twilio
"""

import asyncio
import json
import base64
import os
import logging
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
import websockets
from groq import Groq

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# API Keys
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# System prompt for Voxanne
SYSTEM_PROMPT = """You are Voxanne, a professional and friendly AI sales assistant for CallWaiting AI. 
Keep responses brief and conversational (1-2 sentences max).
Be helpful, warm, and professional. Focus on understanding the caller's needs."""

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "voxanne"}

@app.post("/twilio/incoming")
async def twilio_incoming(request: Request):
    """Handle incoming Twilio call with TwiML"""
    host = request.headers.get("host", "")
    if PUBLIC_URL:
        ws_host = PUBLIC_URL.replace("https://", "").replace("http://", "")
    else:
        ws_host = host
    
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://{ws_host}/ws" />
    </Connect>
</Response>"""
    return PlainTextResponse(twiml, media_type="application/xml")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handle Twilio Media Stream WebSocket"""
    await websocket.accept()
    logger.info("📞 WebSocket connected")
    
    stream_sid = None
    call_sid = None
    
    try:
        # Wait for start event
        start_msg = await websocket.receive_text()
        logger.info(f"📨 Received first message: {start_msg[:200]}")
        start_data = json.loads(start_msg)
        
        event_type = start_data.get("event")
        logger.info(f"📨 Event type: {event_type}")
        
        if event_type == "connected":
            # Twilio sends 'connected' first, then 'start'
            logger.info("📨 Got 'connected' event, waiting for 'start'...")
            start_msg = await websocket.receive_text()
            start_data = json.loads(start_msg)
            event_type = start_data.get("event")
            logger.info(f"📨 Second event type: {event_type}")
        
        if event_type == "start":
            stream_sid = start_data.get("streamSid")
            start_info = start_data.get("start", {})
            call_sid = start_info.get("callSid", "unknown")
            logger.info(f"📞 Call started: {call_sid}, Stream: {stream_sid}")
            
            # Send greeting immediately
            logger.info("🎤 Sending greeting...")
            await send_tts_to_twilio(
                websocket, 
                stream_sid,
                "Hello! This is Voxanne from CallWaiting AI. How can I help you today?"
            )
            
            # Start handling conversation
            await handle_conversation(websocket, stream_sid, call_sid)
        else:
            logger.error(f"❌ Unexpected event type: {event_type}")
            logger.error(f"❌ Full message: {start_data}")
    
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info(f"📞 Call ended: {call_sid}")

async def handle_conversation(websocket: WebSocket, stream_sid: str, call_sid: str):
    """Handle the conversation loop"""
    audio_buffer = []
    
    while True:
        try:
            msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            data = json.loads(msg)
            
            if data.get("event") == "media":
                # Collect audio
                audio_payload = data["media"]["payload"]
                audio_buffer.append(audio_payload)
                
                # Process after collecting enough audio (about 2 seconds)
                if len(audio_buffer) >= 100:
                    transcript = await transcribe_audio(audio_buffer)
                    audio_buffer = []
                    
                    if transcript and len(transcript.strip()) > 2:
                        logger.info(f"🎤 User said: {transcript}")
                        
                        # Get LLM response
                        response = await get_llm_response(transcript)
                        logger.info(f"🤖 Voxanne: {response}")
                        
                        # Send TTS response
                        await send_tts_to_twilio(websocket, stream_sid, response)
            
            elif data.get("event") == "stop":
                logger.info("📞 Stream stopped")
                break
                
        except asyncio.TimeoutError:
            continue
        except Exception as e:
            logger.error(f"❌ Conversation error: {e}")
            break

async def transcribe_audio(audio_chunks: list) -> str:
    """Transcribe audio using Deepgram"""
    try:
        # Combine audio chunks
        audio_bytes = b"".join(base64.b64decode(chunk) for chunk in audio_chunks)
        
        # Use Deepgram REST API for simplicity
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.deepgram.com/v1/listen?model=nova-2&encoding=mulaw&sample_rate=8000",
                headers={
                    "Authorization": f"Token {DEEPGRAM_API_KEY}",
                    "Content-Type": "audio/mulaw"
                },
                data=audio_bytes
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    transcript = result.get("results", {}).get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
                    return transcript
                else:
                    logger.error(f"Deepgram error: {response.status}")
                    return ""
    except Exception as e:
        logger.error(f"STT error: {e}")
        return ""

async def get_llm_response(user_message: str) -> str:
    """Get response from Groq LLM"""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            max_tokens=100,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"LLM error: {e}")
        return "I'm sorry, I didn't catch that. Could you please repeat?"

async def send_tts_to_twilio(websocket: WebSocket, stream_sid: str, text: str):
    """Convert text to speech and send to Twilio"""
    try:
        logger.info(f"🔊 Sending TTS: {text[:50]}...")
        
        # Use Deepgram TTS REST API
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000",
                headers={
                    "Authorization": f"Token {DEEPGRAM_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={"text": text}
            ) as response:
                if response.status == 200:
                    audio_data = await response.read()
                    
                    # Send audio in chunks to Twilio
                    chunk_size = 640  # 20ms at 8kHz mulaw
                    for i in range(0, len(audio_data), chunk_size):
                        chunk = audio_data[i:i+chunk_size]
                        media_msg = {
                            "event": "media",
                            "streamSid": stream_sid,
                            "media": {
                                "payload": base64.b64encode(chunk).decode("utf-8")
                            }
                        }
                        await websocket.send_text(json.dumps(media_msg))
                        await asyncio.sleep(0.02)  # 20ms pacing
                    
                    logger.info("✅ TTS audio sent")
                else:
                    error_text = await response.text()
                    logger.error(f"TTS error {response.status}: {error_text}")
    except Exception as e:
        logger.error(f"TTS send error: {e}")

if __name__ == "__main__":
    import uvicorn
    
    logger.info("🚀 Starting Voxanne Voice Agent")
    logger.info(f"📡 Deepgram API Key: {'✅ Set' if DEEPGRAM_API_KEY else '❌ Missing'}")
    logger.info(f"🤖 Groq API Key: {'✅ Set' if GROQ_API_KEY else '❌ Missing'}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "3000")),
        log_level="info"
    )
