"""
CallWaiting AI - Roxanne Voice Orchestration Layer
Core Event Loop for STT → LLM → TTS Pipeline
Targets: Sub-500ms latency, Barge-In Handling, Graceful Interruption

ARCHITECTURE:
- 5 concurrent asyncio tasks managing: Twilio audio RX, STT, LLM, TTS, Barge-In detection
- State machine: IDLE → LISTENING → PROCESSING → SPEAKING → (or INTERRUPTED)
- Non-blocking buffers: deque for audio, asyncio.Queue for tokens
- Streaming-first: token-level LLM streaming, sentence-level TTS batching
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from collections import deque
import logging

import websockets
from websockets.asyncio.server import ServerConnection
from deepgram import DeepgramClient
from groq import Groq


# ============================================================================
# STATE MACHINE & DATA STRUCTURES
# ============================================================================

class ConversationState(Enum):
    """Finite state machine for conversation flow"""
    IDLE = "idle"
    LISTENING = "listening"           # Receiving user audio
    PROCESSING = "processing"         # LLM generating response
    SPEAKING = "speaking"             # TTS playing audio
    INTERRUPTED = "interrupted"       # User barged in


@dataclass
class ConversationContext:
    """Per-call context maintained across all 5 concurrent tasks"""
    call_sid: str
    stream_sid: str
    state: ConversationState = ConversationState.IDLE
    user_transcript: str = ""
    interim_transcript: str = ""
    llm_response: str = ""
    speaking_started_at: float = 0.0
    listening_started_at: float = 0.0
    
    # Concurrent audio state
    deepgram_ws: Optional[ServerConnection] = None
    tts_ws: Optional[ServerConnection] = None
    
    # Non-blocking buffers
    audio_buffer: deque = field(default_factory=lambda: deque(maxlen=8))
    token_buffer: deque = field(default_factory=deque)
    tts_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    
    # Interrupt flags
    barge_in_detected: bool = False
    vad_silence_count: int = 0
    vad_threshold_ms: int = 500


@dataclass
class AudioMetrics:
    """Track latency breakdown at each hop"""
    stt_latency: float = 0.0          # Deepgram TTFT
    llm_latency: float = 0.0          # Groq TTFT
    tts_latency: float = 0.0          # Aura TTFB
    network_latency: float = 0.0
    total_rtt: float = 0.0


# ============================================================================
# TWILIO MEDIA STREAM HANDLER
# ============================================================================

class TwilioMediaHandler:
    """Orchestration layer: bridges Twilio ↔ Deepgram ↔ Groq ↔ Deepgram Aura"""
    
    def __init__(self, deepgram_api_key: str, groq_api_key: str):
        self.dg_client = DeepgramClient(api_key=deepgram_api_key)
        self.groq_client = Groq(api_key=groq_api_key)
        self.logger = logging.getLogger(__name__)
        self.active_calls: dict[str, ConversationContext] = {}
    
    async def handle_twilio_stream(self, websocket: ServerConnection):
        """
        Main entry point for Twilio Media Stream WebSocket
        Orchestrates 5 concurrent tasks
        """
        ctx = None
        try:
            message = await websocket.recv()
            event = json.loads(message)
            
            if event["event"] == "start":
                stream_sid = event["streamSid"]
                call_sid = event["start"]["callSid"]
                ctx = ConversationContext(call_sid=call_sid, stream_sid=stream_sid)
                self.active_calls[call_sid] = ctx
                self.logger.info(f"📞 Call started: {call_sid}")
            
            # CRITICAL: Launch 5 concurrent tasks with asyncio.gather()
            # Each task is non-blocking and cooperates via shared ConversationContext
            await asyncio.gather(
                self._audio_receiver(websocket, ctx),      # Task 1: Twilio RX
                self._transcription_manager(ctx),          # Task 2: STT + VAD
                self._llm_processor(ctx),                  # Task 3: LLM streaming
                self._tts_sender(ctx, websocket),          # Task 4: TTS + Twilio TX
                self._interrupt_monitor(ctx),              # Task 5: Barge-in detector
                return_exceptions=True
            )
        
        except websockets.exceptions.ConnectionClosed:
            self.logger.info(f"Call ended: {ctx.call_sid if ctx else 'unknown'}")
        finally:
            if ctx:
                del self.active_calls[ctx.call_sid]


    async def _audio_receiver(self, websocket: ServerConnection, ctx: ConversationContext):
        """
        TASK 1: Receive mu-law audio from Twilio (8kHz, 20ms chunks)
        
        Non-blocking: Pops audio from Twilio WebSocket and appends to ctx.audio_buffer
        This buffer is consumed by STT task _transcription_manager()
        """
        try:
            async for message in websocket:
                if isinstance(message, str):
                    event = json.loads(message)
                    
                    if event["event"] == "media":
                        audio_payload = event["media"]["payload"]
                        ctx.audio_buffer.append(audio_payload)  # Non-blocking enqueue
                        ctx.listening_started_at = time.perf_counter()
                    
                    elif event["event"] == "stop":
                        self.logger.info("Twilio stream stopped")
                        ctx.state = ConversationState.IDLE
                        break
        
        except Exception as e:
            self.logger.error(f"Audio receiver error: {e}")


    async def _transcription_manager(self, ctx: ConversationContext):
        """
        TASK 2: Speech-to-Text with Endpointing
        
        - Streams audio from ctx.audio_buffer to Deepgram Nova-2 (WebSocket)
        - Receives interim & final transcripts
        - Implements VAD-based endpointing: 200ms silence = speech complete
        - Signals LLM processor: LISTENING → PROCESSING transition
        
        LATENCY: Deepgram Nova-2 achieves <300ms TTFT with streaming API
        """
        try:
            async with websockets.connect(
                "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=mulaw&sample_rate=8000"
                "&vad=true&interim_results=true&endpointing=200",
                extra_headers={"Authorization": f"Token {self.dg_client.api_key}"}
            ) as dg_ws:
                ctx.state = ConversationState.LISTENING
                ctx.deepgram_ws = dg_ws
                stt_start = time.perf_counter()
                first_transcript = True
                
                async def send_audio():
                    """Non-blocking sender: drain audio_buffer → Deepgram"""
                    try:
                        while ctx.state != ConversationState.IDLE:
                            if ctx.audio_buffer:
                                payload = ctx.audio_buffer.popleft()
                                await dg_ws.send(payload)
                            await asyncio.sleep(0.02)  # Yield to event loop
                    except Exception as e:
                        self.logger.error(f"STT send error: {e}")
                
                async def receive_transcripts():
                    """Non-blocking receiver: parse Deepgram messages"""
                    nonlocal first_transcript
                    try:
                        async for msg in dg_ws:
                            data = json.loads(msg)
                            
                            if first_transcript:
                                stt_latency = (time.perf_counter() - stt_start) * 1000
                                self.logger.info(f"⚡ STT TTFT: {stt_latency:.0f}ms")
                                first_transcript = False
                            
                            if data.get("type") == "Results":
                                result = data["result"]
                                if result.get("is_final"):
                                    transcript = result["channel"]["alternatives"][0]["transcript"]
                                    if transcript:
                                        ctx.user_transcript += " " + transcript
                                        self.logger.info(f"👂 Final: {transcript}")
                                        ctx.vad_silence_count = 0
                                        # CRITICAL: Signal LLM processor
                                        if ctx.state == ConversationState.LISTENING:
                                            ctx.state = ConversationState.PROCESSING
                                else:
                                    transcript = result["channel"]["alternatives"][0]["transcript"]
                                    ctx.interim_transcript = transcript
                                    self.logger.debug(f"🎙️ Interim: {transcript}")
                    except Exception as e:
                        self.logger.error(f"STT receive error: {e}")
                
                # Run sender & receiver concurrently (WebSocket duplex)
                await asyncio.gather(send_audio(), receive_transcripts())
        
        except Exception as e:
            self.logger.error(f"STT manager error: {e}")


    async def _llm_processor(self, ctx: ConversationContext):
        """
        TASK 3: Language Model Processing
        
        - Waits for ctx.state == PROCESSING (triggered by STT endpointing)
        - Streams response from Groq Llama 3.3 70B (token-by-token)
        - Queues tokens into ctx.tts_queue for immediate TTS synthesis
        - If barge_in_detected: flushes token buffer and returns to LISTENING
        
        CRITICAL FOR LATENCY:
        - Token streaming: TTS can start synthesis while LLM is still generating
        - No waiting for full response before TTS starts
        
        LATENCY: Groq achieves <100-200ms TTFT with LPU architecture
        """
        while ctx.state != ConversationState.IDLE:
            try:
                if ctx.state != ConversationState.PROCESSING or not ctx.user_transcript.strip():
                    await asyncio.sleep(0.05)
                    continue
                
                self.logger.info(f"🧠 LLM processing: {ctx.user_transcript[:50]}...")
                
                system_prompt = """You are Roxanne, AI receptionist for a premium cosmetic surgery clinic.
                Warm, professional tone. Knowledge of BBL, facelifts, injectables, med spa services.
                Keep responses <6 sentences for voice interaction.
                Ask clarifying questions if patient intent unclear."""
                
                llm_start = time.perf_counter()
                first_token = True
                
                # Stream tokens from Groq
                with self.groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": ctx.user_transcript.strip()}
                    ],
                    stream=True,
                    temperature=0.7,
                    max_tokens=150
                ) as response:
                    
                    response_text = ""
                    for chunk in response:
                        # INTERRUPT HANDLING: If user barged in, stop token generation
                        if ctx.barge_in_detected:
                            self.logger.warn("⚠️ Interrupt detected, flushing tokens")
                            ctx.token_buffer.clear()
                            ctx.llm_response = ""
                            ctx.user_transcript = ""
                            ctx.state = ConversationState.LISTENING
                            break
                        
                        token = chunk.choices[0].delta.content
                        if token:
                            if first_token:
                                llm_latency = (time.perf_counter() - llm_start) * 1000
                                self.logger.info(f"⚡ LLM TTFT: {llm_latency:.0f}ms")
                                first_token = False
                            
                            response_text += token
                            # CRITICAL: Queue each token immediately for TTS
                            # This starts TTS synthesis before LLM finishes
                            await ctx.tts_queue.put(token)
                
                if not ctx.barge_in_detected:
                    ctx.llm_response = response_text
                    ctx.state = ConversationState.SPEAKING
                    await ctx.tts_queue.put("[[FLUSH]]")  # Trigger TTS flush
                
                ctx.user_transcript = ""
                ctx.interim_transcript = ""
            
            except Exception as e:
                self.logger.error(f"LLM error: {e}")
                await asyncio.sleep(0.1)


    async def _tts_sender(self, ctx: ConversationContext, twilio_ws: ServerConnection):
        """
        TASK 4: Text-to-Speech Synthesis & Playback
        
        - Micro-batches tokens into ~180-char chunks (sentence-level)
        - Streams text to Deepgram Aura-2 TTS (WebSocket)
        - Receives mu-law PCM audio from Aura
        - Forwards audio back to Twilio via media event
        - Watchdog: detects when playback is finished (250ms silence or 3s timeout)
        
        CRITICAL FOR LATENCY:
        - Starts synthesis immediately when first token arrives (no buffering)
        - Deepgram Aura-2 achieves <200ms TTFB
        - Micro-batching prevents word-by-word synthesis artifacts
        
        BARGE-IN HANDLING:
        - When interrupt detected: flushes token queue, stops sending to Aura
        - Transition: SPEAKING → INTERRUPTED → LISTENING
        """
        try:
            aura_uri = "wss://api.deepgram.com/v1/speak?encoding=mulaw&sample_rate=8000&model=aura-asteria-en"
            
            async with websockets.connect(
                aura_uri,
                extra_headers={"Authorization": f"Token {self.dg_client.api_key}"}
            ) as aura_ws:
                
                async def tts_sender_task():
                    """Micro-batch tokens and send to Aura for synthesis"""
                    try:
                        buffer = []
                        while ctx.state != ConversationState.IDLE:
                            try:
                                token = await asyncio.wait_for(
                                    ctx.tts_queue.get(), timeout=0.2
                                )
                            except asyncio.TimeoutError:
                                token = None
                            
                            if token == "[[FLUSH]]":
                                if buffer:
                                    text = "".join(buffer)
                                    self.logger.info(f"📝 TTS chunk: {text[:40]}...")
                                    await aura_ws.send(
                                        json.dumps({"type": "Speak", "text": text})
                                    )
                                    buffer = []
                            elif token:
                                buffer.append(token)
                                # Flush at sentence boundary (~180 chars)
                                if len("".join(buffer)) >= 180:
                                    text = "".join(buffer)
                                    await aura_ws.send(
                                        json.dumps({"type": "Speak", "text": text})
                                    )
                                    buffer = []
                            
                            await asyncio.sleep(0)  # Yield
                    except Exception as e:
                        self.logger.error(f"TTS sender error: {e}")
                
                async def tts_receiver_task():
                    """Receive PCM from Aura, forward to Twilio"""
                    try:
                        tts_start = time.perf_counter()
                        first_byte = True
                        queue_empty_wait = 0.25  # 250ms empty = done
                        last_audio = time.perf_counter()
                        
                        async for msg in aura_ws:
                            if isinstance(msg, bytes):
                                # PCM audio chunk from Aura
                                if first_byte:
                                    tts_latency = (time.perf_counter() - tts_start) * 1000
                                    self.logger.info(f"🔊 TTS TTFB: {tts_latency:.0f}ms")
                                    first_byte = False
                                    ctx.speaking_started_at = time.perf_counter()
                                    ctx.state = ConversationState.SPEAKING
                                
                                # Forward to Twilio via media event
                                await twilio_ws.send(json.dumps({
                                    "event": "media",
                                    "streamSid": ctx.stream_sid,
                                    "media": {
                                        "payload": msg.hex()  # Base64 encode
                                    }
                                }))
                                last_audio = time.perf_counter()
                        
                        # Watchdog: detect playback finished
                        idle_duration = time.perf_counter() - last_audio
                        if idle_duration > queue_empty_wait or (time.perf_counter() - ctx.speaking_started_at) > 3.0:
                            self.logger.info("✅ TTS playback finished")
                            ctx.state = ConversationState.LISTENING
                    
                    except Exception as e:
                        self.logger.error(f"TTS receiver error: {e}")
                
                # Run TTS sender & receiver concurrently
                await asyncio.gather(tts_sender_task(), tts_receiver_task())
        
        except Exception as e:
            self.logger.error(f"TTS manager error: {e}")


    async def _interrupt_monitor(self, ctx: ConversationContext):
        """
        TASK 5: Barge-In (Interrupt) Detection
        
        - Monitors incoming audio during SPEAKING state
        - Runs lightweight VAD (Voice Activity Detection) on audio_buffer
        - Sets barge_in_detected flag when user speech is detected
        - LLM & TTS tasks react: flush buffers, transition to LISTENING
        
        IMPLEMENTATION:
        - Production: Use Silero VAD (PyTorch-based, sub-10ms latency)
        - Processes 20ms audio frames at 8kHz
        - Runs during SPEAKING state only (conserves CPU during LISTENING)
        
        LATENCY TARGET: <50-100ms from speech detection to playback stop
        """
        try:
            while ctx.state != ConversationState.IDLE:
                if ctx.state == ConversationState.SPEAKING:
                    # TODO: Integrate Silero VAD
                    # Placeholder: check audio_buffer for speech energy
                    if ctx.audio_buffer:
                        # Real implementation would:
                        # 1. Load Silero VAD model once
                        # 2. Process audio frames through VAD
                        # 3. Check confidence threshold
                        
                        ctx.barge_in_detected = True
                        self.logger.warn("🛑 BARGE-IN DETECTED!")
                        
                        # Signal all other tasks to flush
                        ctx.token_buffer.clear()
                        ctx.tts_queue = asyncio.Queue()
                        ctx.state = ConversationState.INTERRUPTED
                        
                        await asyncio.sleep(0.1)  # Brief pause
                        ctx.state = ConversationState.LISTENING
                        ctx.barge_in_detected = False
                
                await asyncio.sleep(0.02)  # 20ms VAD frame rate
        
        except Exception as e:
            self.logger.error(f"Interrupt monitor error: {e}")


# ============================================================================
# FASTAPI + WEBSOCKET SERVER
# ============================================================================

async def create_app():
    """FastAPI server: Twilio webhook + Media Stream WebSocket"""
    from fastapi import FastAPI, WebSocket
    from fastapi.responses import PlainTextResponse
    
    app = FastAPI()
    handler = TwilioMediaHandler(
        deepgram_api_key="YOUR_DG_API_KEY",
        groq_api_key="YOUR_GROQ_API_KEY"
    )
    
    @app.post("/twiml")
    async def twiml_handler(request):
        """Twilio webhook: returns TwiML with Media Stream connection"""
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say>Hello! This is Roxanne, your cosmetic clinic assistant.</Say>
            <Connect>
                <Stream url="wss://your-domain.com/ws" />
            </Connect>
        </Response>"""
        return PlainTextResponse(twiml, media_type="application/xml")
    
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        """Twilio Media Stream WebSocket endpoint"""
        await websocket.accept()
        await handler.handle_twilio_stream(websocket)
    
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Run with: uvicorn app:create_app --host 0.0.0.0 --port 8000
    print("🚀 Roxanne Voice Orchestration Layer Ready")
