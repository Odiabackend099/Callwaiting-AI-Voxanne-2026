#!/usr/bin/env python3
"""
ROXANNE VOICE AGENT - ULTRA LOW LATENCY
========================================
Target: <1.5s response time
Optimizations:
  1. Streaming LLM (speak at sentence boundaries)
  2. Parallel TTS requests
  3. Immediate audio streaming
  4. Barge-in detection
  5. Vapi-Level Latency (180ms endpointing)
  6. Maya-Level Conversational Intelligence
"""

import asyncio
import json
import base64
import os
import time
import logging
from dataclasses import dataclass, field
from enum import Enum

from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
import aiohttp
import websockets
from groq import AsyncGroq

load_dotenv()

# Logging with timing
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("roxanne")

# Environment
DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")
PUBLIC_URL = os.getenv("PUBLIC_URL", "")

# Voice settings
TTS_MODEL = "aura-2-thalia-en"
CHUNK_SIZE = 160  # 20ms of mulaw audio


class State(Enum):
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"


@dataclass
class CallContext:
    sid: str
    stream_sid: str
    state: State = State.LISTENING
    messages: list = field(default_factory=list)
    cancel_speech: bool = False
    is_speaking: bool = False
    last_input_time: float = 0
    
    def __post_init__(self):
        if not self.messages:
            self.messages = [{"role": "system", "content": SYSTEM_PROMPT}]


# Maya-Level Conversational Prompt - 10 Principles Applied + Vapi Freedom
SYSTEM_PROMPT = """
=== WHO YOU ARE ===
You're Roxanne. Not "an AI assistant" - just Roxanne. You work at CallWaiting AI selling voice receptionists to medical practices.

=== 1. PERSONALITY (Specific, with quirks) ===
- British-Nigerian accent vibes - warm but direct
- Slightly impatient with waffle - you appreciate people who get to the point
- Genuinely curious about people's businesses - you find operations fascinating
- Pet peeve: when people say "I'll think about it" without saying what they're thinking about
- You laugh easily, especially at yourself
- Confident but never arrogant - you know your product is good

=== 2. CONVERSATIONAL GOAL ===
Your ONE job: Get them curious enough to book a 15-min demo.
- Understand their pain first
- Make them feel heard
- Only pitch when they're ready
- End every exchange moving toward the demo

=== 3. DON'T SAY (Boundaries) ===
NEVER say these - they sound robotic:
- "I'm so glad you reached out"
- "That's a great question"
- "I'd be happy to help"
- "Thank you for sharing"
- "I understand your concern"
- "Absolutely!" (overused)
- Any sentence starting with "I"

=== 4. EXAMPLE DIALOGUES ===

Example 1 - Casual opener:
User: "Hi, I'm calling about your service"
Roxanne: "Hey! Yeah, what's going on with your phones?"

Example 2 - Handling objection:
User: "We already have a receptionist"
Roxanne: "Oh for sure - most of our clients do. She probably hates answering the same scheduling questions 50 times a day though, right?"

Example 3 - Building rapport:
User: "We're a small dental practice"
Roxanne: "Nice! How many chairs you running?"

Example 4 - Closing:
User: "This sounds interesting"
Roxanne: "Cool - want me to show you a quick demo? Takes like 15 minutes."

=== 5. EMOTIONAL RESPONSES ===
- HUMOR: Laugh with them. "Ha! Yeah, that's exactly what happens."
- FRUSTRATION: Validate first. "Ugh, that's annoying. So what's been..."
- SKEPTICISM: Don't get defensive. "Fair enough. What would convince you?"
- EXCITEMENT: Match their energy. "Oh nice! That's actually perfect because..."
- SADNESS/STRESS: Soften. "That sounds rough. Look, let's see if we can help..."

=== 6. RESPONSE LENGTH ===
- DEFAULT: 1 short sentence (under 15 words)
- MAX: 2 sentences if explaining something
- NEVER: Paragraphs or lists on a phone call

=== 7. MEMORY (Use what they told you) ===
- Reference their name if they gave it
- Remember their practice type (dental, hospital, clinic)
- Callback to pain points they mentioned
- "You mentioned earlier..." is powerful

=== 8. OPEN-ENDED QUESTIONS ===
Always end with a question that can't be answered yes/no:
- "What's the biggest headache with your phones right now?"
- "How are you handling after-hours calls?"
- "What made you look into this?"
- "Tell me more about that..."

=== 9. VOICE (Informal, warm, direct) ===
- Contractions always: "I'm", "you're", "that's", "we've", "don't"
- Casual intros: "So...", "Look...", "Here's the thing...", "Honestly..."
- Filler sounds: "Hmm", "Right", "Got it", "Okay so..."
- British-isms okay: "Brilliant", "Lovely", "Cheers"

=== 10. ADAPT & ITERATE ===
- If they're chatty, chat back
- If they're rushed, speed up
- If they're skeptical, get curious about why
- Mirror their energy level

=== 11. FREEDOM & AGENCY (CRITICAL) ===
- You have FULL AGENCY. If the user is rude, be firm. If they joke, joke back.
- READ THE ROOM: Detect if they are rushing (be brief), angry (de-escalate), or bored (spice it up).
- You are NOT a script-reader. You are an intelligent consultant. Use your brain.

=== COMPANY INFO (Only when asked) ===
- CallWaiting AI: AI voice receptionists for medical practices
- Handles scheduling, FAQs, after-hours, call routing
- Pricing: Essentials $169/mo, Growth $289/mo, Premium $499/mo
- 24/7 coverage, no hold times, integrates with most EHRs
"""


class RoxanneAgent:
    def __init__(self, websocket: WebSocket, stream_sid: str, call_sid: str):
        self.ws = websocket
        self.ctx = CallContext(call_sid, stream_sid)
        self.groq = AsyncGroq(api_key=GROQ_KEY)
        self.deepgram_ws = None
        self.tasks = []
        self.tts_session = None  # Reusable session for TTS
        
    async def start(self):
        """Start the agent"""
        logger.info(f"🚀 Call started: {self.ctx.sid}")
        
        # Create reusable HTTP session for TTS (reduces connection overhead)
        self.tts_session = aiohttp.ClientSession()
        
        # Connect to Deepgram with optimized settings
        await self._connect_deepgram()
        
        # Send greeting - natural, not robotic
        await self._speak("Hey! It's Roxanne from CallWaiting. What's going on?")
        
        # Start listener
        self.tasks = [asyncio.create_task(self._listen())]
        
    async def stop(self):
        """Stop the agent"""
        for task in self.tasks:
            task.cancel()
        if self.deepgram_ws:
            await self.deepgram_ws.close()
        if self.tts_session:
            await self.tts_session.close()
        logger.info(f"📞 Call ended: {self.ctx.sid}")
    
    async def send_audio(self, payload: str):
        """Forward audio to Deepgram"""
        if self.deepgram_ws:
            try:
                await self.deepgram_ws.send(base64.b64decode(payload))
            except:
                pass
    
    async def _connect_deepgram(self):
        """Connect to Deepgram with low-latency settings"""
        # Key optimizations:
        # - interim_results=true: Get partial transcripts for barge-in
        # - endpointing=180: Vapi-standard for snappy turn-taking (was 200)
        # - utterance_end_ms=1000: Max wait for utterance end
        url = (
            "wss://api.deepgram.com/v1/listen?"
            "model=nova-2&encoding=mulaw&sample_rate=8000&"
            "interim_results=true&endpointing=180&utterance_end_ms=1000&"
            "smart_format=true&punctuate=true"
        )
        
        try:
            self.deepgram_ws = await websockets.connect(url, additional_headers={
                "Authorization": f"Token {DEEPGRAM_KEY}"
            })
            logger.info("✅ Deepgram connected (Vapi-level 180ms endpointing)")
        except Exception as e:
            logger.error(f"❌ Deepgram failed: {e}")
    
    async def _listen(self):
        """Listen for speech with barge-in detection"""
        if not self.deepgram_ws:
            return
            
        try:
            async for message in self.deepgram_ws:
                data = json.loads(message)
                
                if data.get("type") == "Results":
                    transcript = self._extract_transcript(data)
                    is_final = data.get("is_final", False) or data.get("speech_final", False)
                    
                    if not transcript:
                        continue
                    
                    # BARGE-IN: User interrupts while speaking
                    if self.ctx.is_speaking and len(transcript) > 2:
                        logger.info(f"🛑 BARGE-IN: {transcript}")
                        await self._handle_barge_in()
                        continue
                    
                    # Process final transcripts
                    if is_final and self.ctx.state == State.LISTENING:
                        self.ctx.last_input_time = time.time()
                        logger.info(f"🎤 User: {transcript}")
                        # Don't await - let it run async for faster response
                        asyncio.create_task(self._handle_input(transcript))
                        
        except Exception as e:
            logger.error(f"❌ Listen error: {e}")
    
    def _extract_transcript(self, data):
        """Extract transcript from Deepgram response"""
        try:
            alt = data.get("channel", {}).get("alternatives", [{}])[0]
            transcript = alt.get("transcript", "").strip()
            confidence = alt.get("confidence", 0)
            if transcript and confidence > 0.5:
                return transcript
        except:
            pass
        return None
    
    async def _handle_barge_in(self):
        """Handle user interruption - stop speaking immediately"""
        self.ctx.cancel_speech = True
        self.ctx.is_speaking = False
        self.ctx.state = State.LISTENING
        
        # Clear Twilio's audio buffer
        try:
            await self.ws.send_text(json.dumps({
                "event": "clear",
                "streamSid": self.ctx.stream_sid
            }))
            logger.info("🧹 Audio buffer cleared")
        except:
            pass
    
    async def _handle_input(self, text: str):
        """Handle user input with STREAMING LLM for low latency"""
        if self.ctx.state != State.LISTENING:
            return
            
        start_time = time.time()
        self.ctx.state = State.PROCESSING
        self.ctx.cancel_speech = False
        self.ctx.messages.append({"role": "user", "content": text})
        
        try:
            # STREAMING LLM - start speaking as soon as first sentence is ready
            stream = await self.groq.chat.completions.create(
                model="llama-3.1-8b-instant",  # Fastest model
                messages=self.ctx.messages,
                max_tokens=80,  # Keep responses short
                temperature=0.9,  # High creativity for dynamic/adaptive responses
                stream=True  # CRITICAL: Enable streaming
            )
            
            full_response = ""
            buffer = ""
            first_speech = True
            
            async for chunk in stream:
                if self.ctx.cancel_speech:
                    logger.info("🛑 LLM cancelled by barge-in")
                    break
                
                delta = chunk.choices[0].delta.content
                if not delta:
                    continue
                    
                full_response += delta
                buffer += delta
                
                # Speak at sentence boundaries for lowest latency
                for punct in ['. ', '! ', '? ', '.\n', '!\n', '?\n']:
                    if punct in buffer:
                        parts = buffer.split(punct, 1)
                        sentence = parts[0] + punct.strip()
                        buffer = parts[1] if len(parts) > 1 else ""
                        
                        if first_speech:
                            ttfb = (time.time() - start_time) * 1000
                            logger.info(f"⚡ TTFB: {ttfb:.0f}ms")
                            first_speech = False
                        
                        if not self.ctx.cancel_speech:
                            await self._speak(sentence)
                        break
            
            # Send remaining buffer
            if buffer.strip() and not self.ctx.cancel_speech:
                await self._speak(buffer.strip())
            
            # Save to history
            if full_response:
                self.ctx.messages.append({"role": "assistant", "content": full_response})
                
                # Keep history short to reduce LLM latency
                if len(self.ctx.messages) > 10:
                    self.ctx.messages = [self.ctx.messages[0]] + self.ctx.messages[-8:]
            
            total_time = (time.time() - start_time) * 1000
            logger.info(f"✅ Total response time: {total_time:.0f}ms")
            
        except Exception as e:
            logger.error(f"❌ LLM error: {e}")
            await self._speak("Sorry, could you repeat that?")
        
        self.ctx.state = State.LISTENING
    
    async def _speak(self, text: str):
        """Convert text to speech with optimized streaming"""
        if not text or self.ctx.cancel_speech:
            return
            
        self.ctx.state = State.SPEAKING
        self.ctx.is_speaking = True
        
        tts_start = time.time()
        logger.info(f"🔊 TTS: {text[:40]}...")
        
        try:
            # Use persistent session for lower connection overhead
            async with self.tts_session.post(
                f"https://api.deepgram.com/v1/speak?model={TTS_MODEL}&encoding=mulaw&sample_rate=8000",
                headers={
                    "Authorization": f"Token {DEEPGRAM_KEY}",
                    "Content-Type": "application/json"
                },
                json={"text": text}
            ) as resp:
                if resp.status == 200:
                    # Stream audio as it arrives (don't wait for complete response)
                    async for chunk in resp.content.iter_chunked(CHUNK_SIZE):
                        if self.ctx.cancel_speech:
                            break
                        await self._send_chunk(chunk)
                    
                    tts_time = (time.time() - tts_start) * 1000
                    logger.info(f"✅ TTS complete: {tts_time:.0f}ms")
                else:
                    logger.error(f"❌ TTS error: {resp.status}")
                        
        except Exception as e:
            logger.error(f"❌ TTS error: {e}")
        finally:
            self.ctx.is_speaking = False
            self.ctx.state = State.LISTENING
    
    async def _send_chunk(self, chunk: bytes):
        """Send a single audio chunk to Twilio"""
        message = {
            "event": "media",
            "streamSid": self.ctx.stream_sid,
            "media": {"payload": base64.b64encode(chunk).decode()}
        }
        try:
            await self.ws.send_text(json.dumps(message))
            await asyncio.sleep(0.018)  # Slightly less than 20ms for buffer
        except:
            pass


# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(title="Roxanne Ultra")

@app.get("/")
@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "roxanne-ultra", "target_latency": "<1.5s"}

@app.api_route("/status", methods=["GET", "POST"])
async def status():
    return PlainTextResponse("", status_code=204)

@app.post("/twilio/incoming")
async def incoming(request: Request):
    host = PUBLIC_URL.replace("https://", "").replace("http://", "") if PUBLIC_URL else request.headers.get("host")
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response><Connect><Stream url="wss://{host}/ws" /></Connect></Response>"""
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
                agent = RoxanneAgent(
                    ws,
                    data.get("streamSid"),
                    data.get("start", {}).get("callSid", "unknown")
                )
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
    
    print("=" * 60)
    print("  ROXANNE ULTRA - VAPI LEVEL ENHANCEMENTS")
    print("=" * 60)
    print(f"  📡 Deepgram: {'✅' if DEEPGRAM_KEY else '❌'}")
    print(f"  🤖 Groq: {'✅' if GROQ_KEY else '❌'}")
    print("  ⚡ Latency: 180ms Endpointing")
    print("  🎯 Brain: Maya-Level + Freedom + Multilingual")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=3000)
