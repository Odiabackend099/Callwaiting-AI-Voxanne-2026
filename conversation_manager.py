#!/usr/bin/env python3
"""
CONVERSATION MANAGER - State Machine for Voice Orchestration
=============================================================
Central async loop managing:
  - Twilio WebSocket (mulaw 8kHz)
  - Deepgram STT WebSocket (interim + endpointing)
  - Groq streaming LLM
  - Deepgram TTS streaming

States:
  LISTENING      - Waiting for user to speak
  USER_SPEAKING  - Receiving interim transcripts
  THINKING       - Processing user input, generating response
  SPEAKING       - Streaming TTS audio to user
  INTERRUPTED    - User barged in, cancelling current response

Feature Flags (from environment):
  ENDPOINT_MS         - Silence threshold for turn completion (default: 180)
  ENABLE_BARGE_IN_V2  - Hard cancel on barge-in (default: false)
  ENABLE_HUMANIZER    - Text humanization for natural TTS (default: false)
"""

import asyncio
import json
import base64
import os
import time
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Callable

import aiohttp
import websockets
from groq import AsyncGroq

logger = logging.getLogger("roxanne.manager")


class ConversationState(Enum):
    """State machine states for conversation flow."""
    LISTENING = "listening"
    USER_SPEAKING = "user_speaking"
    THINKING = "thinking"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"


@dataclass
class ConversationMetrics:
    """Timing metrics for latency tracking."""
    turn_start_ms: float = 0
    stt_first_interim_ms: float = 0
    stt_final_ms: float = 0
    llm_first_token_ms: float = 0
    tts_first_byte_ms: float = 0
    turn_end_ms: float = 0
    barge_in_count: int = 0
    
    def reset_turn(self):
        """Reset per-turn metrics."""
        self.turn_start_ms = time.time() * 1000
        self.stt_first_interim_ms = 0
        self.stt_final_ms = 0
        self.llm_first_token_ms = 0
        self.tts_first_byte_ms = 0
        self.turn_end_ms = 0
    
    def log_turn_summary(self):
        """Log latency breakdown for this turn."""
        if self.turn_start_ms and self.turn_end_ms:
            total = self.turn_end_ms - self.turn_start_ms
            stt_latency = self.stt_final_ms - self.turn_start_ms if self.stt_final_ms else 0
            llm_ttft = self.llm_first_token_ms - self.stt_final_ms if self.llm_first_token_ms and self.stt_final_ms else 0
            tts_ttfb = self.tts_first_byte_ms - self.llm_first_token_ms if self.tts_first_byte_ms and self.llm_first_token_ms else 0
            
            logger.info(f"📊 Turn Metrics: total={total:.0f}ms | stt={stt_latency:.0f}ms | llm_ttft={llm_ttft:.0f}ms | tts_ttfb={tts_ttfb:.0f}ms")


@dataclass
class ConversationContext:
    """Holds conversation state and history."""
    call_sid: str
    stream_sid: str
    state: ConversationState = ConversationState.LISTENING
    messages: List[dict] = field(default_factory=list)
    current_transcript: str = ""
    last_transcript: str = ""  # For detecting transcript changes
    transcript_stable_count: int = 0  # How many times transcript unchanged
    metrics: ConversationMetrics = field(default_factory=ConversationMetrics)
    
    # Task handles for cancellation
    llm_task: Optional[asyncio.Task] = None
    tts_task: Optional[asyncio.Task] = None
    silence_timer: Optional[asyncio.Task] = None
    semantic_timer: Optional[asyncio.Task] = None  # For semantic VAD
    
    def __post_init__(self):
        if not self.messages:
            # System prompt will be set by manager
            pass


class ConversationManager:
    """
    Central orchestrator for voice conversations.
    
    Manages the async event loop across:
    - Twilio Media Stream (inbound/outbound audio)
    - Deepgram STT (speech-to-text)
    - Groq LLM (response generation)
    - Deepgram TTS (text-to-speech)
    """
    
    def __init__(
        self,
        twilio_ws,
        deepgram_key: str,
        groq_key: str,
        system_prompt: str,
        endpoint_ms: int = 180,
        enable_barge_in_v2: bool = False,
        enable_humanizer: bool = False,
    ):
        self.twilio_ws = twilio_ws
        self.deepgram_key = deepgram_key
        self.groq_key = groq_key
        self.system_prompt = system_prompt
        self.endpoint_ms = endpoint_ms
        self.enable_barge_in_v2 = enable_barge_in_v2
        self.enable_humanizer = enable_humanizer
        
        # Connections
        self.deepgram_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.groq_client: Optional[AsyncGroq] = None
        self.http_session: Optional[aiohttp.ClientSession] = None
        
        # Context
        self.ctx: Optional[ConversationContext] = None
        
        # Background tasks
        self.tasks: List[asyncio.Task] = []
        
        # Callbacks (for extensibility)
        self.on_state_change: Optional[Callable] = None
        self.on_transcript: Optional[Callable] = None
        self.on_response: Optional[Callable] = None
        
        logger.info(f"ConversationManager initialized | endpoint_ms={endpoint_ms} | barge_in_v2={enable_barge_in_v2} | humanizer={enable_humanizer}")
    
    # =========================================================================
    # LIFECYCLE
    # =========================================================================
    
    async def start(self, call_sid: str, stream_sid: str):
        """Initialize connections and start the conversation loop."""
        logger.info(f"🎙️ Starting conversation | call={call_sid}")
        
        # Initialize context
        self.ctx = ConversationContext(
            call_sid=call_sid,
            stream_sid=stream_sid,
            messages=[{"role": "system", "content": self.system_prompt}]
        )
        
        # Initialize clients
        self.groq_client = AsyncGroq(api_key=self.groq_key)
        self.http_session = aiohttp.ClientSession()
        
        # Connect to Deepgram STT
        await self._connect_deepgram_stt()
        
        # Start background listeners
        stt_task = asyncio.create_task(self._listen_deepgram_stt())
        self.tasks.append(stt_task)
        
        self._set_state(ConversationState.LISTENING)
        logger.info("✅ Conversation started")

        # Generate and speak a dynamic greeting via LLM
        try:
            greeting = await self._generate_greeting()
            if greeting:
                logger.info(f"🎙️ Dynamic greeting: {greeting}")
                self._set_state(ConversationState.SPEAKING)
                await self._speak_sentence(greeting)
                self._set_state(ConversationState.LISTENING)
                logger.info("👂 Now listening for caller...")
        except Exception as e:
            logger.error(f"Greeting generation failed: {e}")
    
    async def stop(self):
        """Clean up all connections and tasks."""
        logger.info("🛑 Stopping conversation...")
        
        # Cancel all background tasks
        for task in self.tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        # Cancel any in-progress work
        if self.ctx:
            if self.ctx.llm_task:
                self.ctx.llm_task.cancel()
            if self.ctx.tts_task:
                self.ctx.tts_task.cancel()
            if self.ctx.silence_timer:
                self.ctx.silence_timer.cancel()
            if self.ctx.semantic_timer:
                self.ctx.semantic_timer.cancel()
        
        # Close connections
        if self.deepgram_ws:
            await self.deepgram_ws.close()
        if self.http_session:
            await self.http_session.close()
        
        # Log final metrics
        if self.ctx:
            logger.info(f"📊 Session complete | barge_ins={self.ctx.metrics.barge_in_count}")
        
        logger.info("✅ Conversation stopped")
    
    # =========================================================================
    # STATE MANAGEMENT
    # =========================================================================
    
    def _set_state(self, new_state: ConversationState):
        """Transition to a new state with logging."""
        if self.ctx:
            old_state = self.ctx.state
            self.ctx.state = new_state
            logger.info(f"🔄 State: {old_state.value} → {new_state.value}")
            
            if self.on_state_change:
                self.on_state_change(old_state, new_state)
    
    # =========================================================================
    # AUDIO INPUT (from Twilio)
    # =========================================================================
    
    async def handle_audio(self, audio_payload: str):
        """
        Handle incoming audio from Twilio Media Stream.
        
        Args:
            audio_payload: Base64-encoded mulaw audio
        """
        if not self.ctx:
            return
        
        # BARGE-IN DETECTION
        if self.ctx.state == ConversationState.SPEAKING:
            if self.enable_barge_in_v2:
                await self._handle_barge_in()
            else:
                # Legacy: just note it but don't hard cancel
                logger.debug("Audio during SPEAKING (barge-in v1 - soft)")
        
        # Forward audio to Deepgram STT
        if self.deepgram_ws and self.ctx.state in (
            ConversationState.LISTENING,
            ConversationState.USER_SPEAKING,
            ConversationState.INTERRUPTED,
        ):
            try:
                audio_bytes = base64.b64decode(audio_payload)
                await self.deepgram_ws.send(audio_bytes)
            except Exception as e:
                logger.error(f"Error sending audio to Deepgram: {e}")
    
    async def _handle_barge_in(self):
        """Handle user interruption during agent speech."""
        logger.info("🚨 BARGE-IN DETECTED - Cancelling response")
        
        self.ctx.metrics.barge_in_count += 1
        self._set_state(ConversationState.INTERRUPTED)
        
        # Cancel LLM task
        if self.ctx.llm_task and not self.ctx.llm_task.done():
            self.ctx.llm_task.cancel()
            try:
                await self.ctx.llm_task
            except asyncio.CancelledError:
                pass
            self.ctx.llm_task = None
        
        # Cancel TTS task
        if self.ctx.tts_task and not self.ctx.tts_task.done():
            self.ctx.tts_task.cancel()
            try:
                await self.ctx.tts_task
            except asyncio.CancelledError:
                pass
            self.ctx.tts_task = None
        
        # Clear Twilio audio buffer
        await self._send_clear_audio()
        
        # Transition to listening for new input
        self._set_state(ConversationState.USER_SPEAKING)
    
    # =========================================================================
    # DEEPGRAM STT
    # =========================================================================
    
    async def _connect_deepgram_stt(self):
        """Connect to Deepgram STT WebSocket."""
        url = (
            "wss://api.deepgram.com/v1/listen?"
            f"model=nova-2&encoding=mulaw&sample_rate=8000&"
            f"interim_results=true&endpointing={self.endpoint_ms}&"
            "utterance_end_ms=1000&smart_format=true&punctuate=true"
        )
        
        try:
            self.deepgram_ws = await websockets.connect(
                url,
                extra_headers={"Authorization": f"Token {self.deepgram_key}"}
            )
            logger.info(f"🎤 Deepgram STT connected | endpointing={self.endpoint_ms}ms")
        except TypeError:
            # Fallback for older websockets
            self.deepgram_ws = await websockets.connect(
                url,
                additional_headers={"Authorization": f"Token {self.deepgram_key}"}
            )
            logger.info(f"🎤 Deepgram STT connected (legacy) | endpointing={self.endpoint_ms}ms")
    
    async def _listen_deepgram_stt(self):
        """Listen for transcripts from Deepgram."""
        try:
            async for message in self.deepgram_ws:
                if not self.ctx:
                    break
                
                data = json.loads(message)
                await self._handle_stt_result(data)
                
        except asyncio.CancelledError:
            logger.info("STT listener cancelled")
        except Exception as e:
            logger.error(f"STT listener error: {e}")
    
    async def _handle_stt_result(self, data: dict):
        """Process STT result from Deepgram."""
        if data.get("type") != "Results":
            # Check for utterance_end event (speech_final)
            if data.get("type") == "UtteranceEnd":
                await self._handle_utterance_end()
            return
        
        alt = data.get("channel", {}).get("alternatives", [{}])[0]
        transcript = alt.get("transcript", "").strip()
        is_final = data.get("is_final", False)
        speech_final = data.get("speech_final", False)
        
        now_ms = time.time() * 1000
        
        # Handle empty transcript (silence detected)
        if not transcript:
            if is_final and self.ctx.state == ConversationState.USER_SPEAKING:
                # Empty final = potential end of speech
                await self._check_semantic_endpoint()
            return
        
        # Track first interim
        if not is_final and not self.ctx.metrics.stt_first_interim_ms:
            self.ctx.metrics.stt_first_interim_ms = now_ms
        
        # Interim transcript
        if not is_final:
            if self.ctx.state == ConversationState.LISTENING:
                self.ctx.metrics.reset_turn()
                self._set_state(ConversationState.USER_SPEAKING)
            
            # Track transcript stability (for semantic VAD)
            if transcript == self.ctx.last_transcript:
                self.ctx.transcript_stable_count += 1
            else:
                self.ctx.transcript_stable_count = 0
                self.ctx.last_transcript = transcript
            
            self.ctx.current_transcript = transcript
            logger.debug(f"📝 Interim: {transcript} (stable={self.ctx.transcript_stable_count})")
            
            # Reset silence timer on new speech
            if self.ctx.silence_timer:
                self.ctx.silence_timer.cancel()
            self.ctx.silence_timer = asyncio.create_task(
                self._silence_timeout()
            )
            
            # Check for semantic completion (question marks, complete sentences)
            if self._looks_complete(transcript):
                await self._start_semantic_timer(transcript)
        
        # Final transcript from Deepgram's endpointing
        if is_final and transcript:
            self.ctx.metrics.stt_final_ms = now_ms
            self.ctx.current_transcript = transcript
            
            logger.info(f"📝 Final: {transcript}")
            
            if self.on_transcript:
                self.on_transcript(transcript, is_final=True)
            
            # Cancel timers
            self._cancel_all_timers()
            
            # Process if we're in speaking state
            if self.ctx.state == ConversationState.USER_SPEAKING:
                await self._process_user_input(transcript)
    
    def _looks_complete(self, transcript: str) -> bool:
        """
        Semantic VAD: Check if transcript looks like a complete utterance.
        Returns True if we should start the semantic timer.
        """
        if not transcript:
            return False
        
        # Ends with terminal punctuation
        if transcript.rstrip()[-1] in '.?!':
            return True
        
        # Common complete phrases (greetings, short answers)
        complete_phrases = [
            'hello', 'hi', 'hey', 'yes', 'no', 'yeah', 'nope', 'okay', 'ok',
            'sure', 'thanks', 'thank you', 'bye', 'goodbye', 'please',
            'i see', 'got it', 'sounds good', 'that works', 'perfect',
        ]
        lower = transcript.lower().strip()
        if lower in complete_phrases:
            return True
        
        # Question patterns (who, what, when, where, why, how, can, do, is, are)
        question_starters = ['who ', 'what ', 'when ', 'where ', 'why ', 'how ',
                            'can ', 'do ', 'does ', 'is ', 'are ', 'will ', 'would ']
        for starter in question_starters:
            if lower.startswith(starter) and len(transcript.split()) >= 3:
                return True
        
        return False
    
    async def _start_semantic_timer(self, transcript: str):
        """Start a short timer for semantic completion."""
        # Cancel existing semantic timer
        if self.ctx.semantic_timer:
            self.ctx.semantic_timer.cancel()
        
        # Use shorter delay for semantically complete utterances
        semantic_delay_ms = min(self.endpoint_ms, 150)  # Max 150ms for complete phrases
        
        self.ctx.semantic_timer = asyncio.create_task(
            self._semantic_timeout(transcript, semantic_delay_ms)
        )
    
    async def _semantic_timeout(self, transcript: str, delay_ms: int):
        """Semantic VAD timeout - process if transcript still matches."""
        await asyncio.sleep(delay_ms / 1000)
        
        if self.ctx and self.ctx.state == ConversationState.USER_SPEAKING:
            # Only process if transcript hasn't changed
            if self.ctx.current_transcript == transcript:
                logger.info(f"⚡ Semantic endpoint ({delay_ms}ms): {transcript}")
                self._cancel_all_timers()
                await self._process_user_input(transcript)
    
    async def _silence_timeout(self):
        """Manual endpointing fallback - trigger after silence."""
        await asyncio.sleep(self.endpoint_ms / 1000 + 0.05)  # Small buffer
        
        if self.ctx and self.ctx.state == ConversationState.USER_SPEAKING:
            transcript = self.ctx.current_transcript
            if transcript:
                logger.info(f"⏱️ Silence timeout ({self.endpoint_ms}ms): {transcript}")
                self._cancel_all_timers()
                await self._process_user_input(transcript)
    
    async def _handle_utterance_end(self):
        """Handle Deepgram's utterance_end event."""
        if self.ctx and self.ctx.state == ConversationState.USER_SPEAKING:
            transcript = self.ctx.current_transcript
            if transcript:
                logger.info(f"🎯 Utterance end: {transcript}")
                self._cancel_all_timers()
                await self._process_user_input(transcript)
    
    async def _check_semantic_endpoint(self):
        """Check if we should endpoint based on empty final."""
        if self.ctx and self.ctx.state == ConversationState.USER_SPEAKING:
            transcript = self.ctx.current_transcript
            if transcript and self._looks_complete(transcript):
                logger.info(f"🎯 Semantic endpoint (empty final): {transcript}")
                self._cancel_all_timers()
                await self._process_user_input(transcript)
    
    def _cancel_all_timers(self):
        """Cancel all endpointing timers."""
        if self.ctx.silence_timer:
            self.ctx.silence_timer.cancel()
            self.ctx.silence_timer = None
        if self.ctx.semantic_timer:
            self.ctx.semantic_timer.cancel()
            self.ctx.semantic_timer = None
    
    # =========================================================================
    # LLM PROCESSING
    # =========================================================================

    async def _generate_greeting(self) -> str:
        """Generate a short, natural greeting using the LLM.

        Uses the system prompt plus a dedicated greeting instruction so
        greetings can vary between calls while staying on-brand.
        """
        if not self.groq_client:
            return ""

        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": (
                    "The caller has just dialed in. "
                    "Generate ONE short spoken greeting line only. "
                    "Vary your wording between calls. Stay under 20 words."
                ),
            },
        ]

        resp = await self.groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=60,
            temperature=0.9,
            stream=False,
        )

        text = (resp.choices[0].message.content or "").strip()
        return text

    async def _process_user_input(self, text: str):
        """Process user input and generate response."""
        if not text or len(text) < 2:
            return
        
        self._set_state(ConversationState.THINKING)
        
        # Add to conversation history
        self.ctx.messages.append({"role": "user", "content": text})
        
        # Start LLM generation
        self.ctx.llm_task = asyncio.create_task(
            self._generate_response()
        )
    
    async def _generate_response(self):
        """Generate LLM response and stream to TTS."""
        try:
            response_text = ""
            sentence_buffer = ""
            first_token = True
            
            stream = await self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=self.ctx.messages,
                temperature=0.9,
                max_tokens=200,
                stream=True
            )
            
            self._set_state(ConversationState.SPEAKING)
            
            async for chunk in stream:
                if self.ctx.state == ConversationState.INTERRUPTED:
                    logger.info("LLM stream interrupted by barge-in")
                    break
                
                delta = chunk.choices[0].delta.content or ""
                
                if first_token and delta:
                    self.ctx.metrics.llm_first_token_ms = time.time() * 1000
                    first_token = False
                
                response_text += delta
                sentence_buffer += delta
                
                # Check for sentence boundaries
                for punct in [". ", "! ", "? ", ".\n", "!\n", "?\n"]:
                    if punct in sentence_buffer:
                        parts = sentence_buffer.split(punct, 1)
                        sentence = parts[0] + punct.strip()
                        sentence_buffer = parts[1] if len(parts) > 1 else ""
                        
                        if sentence.strip():
                            await self._speak_sentence(sentence.strip())
                        break
            
            # Handle remaining text
            if sentence_buffer.strip() and self.ctx.state != ConversationState.INTERRUPTED:
                await self._speak_sentence(sentence_buffer.strip())
            
            # Save response to history
            if response_text:
                self.ctx.messages.append({"role": "assistant", "content": response_text})
                
                if self.on_response:
                    self.on_response(response_text)
            
            # Done speaking
            if self.ctx.state == ConversationState.SPEAKING:
                self.ctx.metrics.turn_end_ms = time.time() * 1000
                self.ctx.metrics.log_turn_summary()
                self._set_state(ConversationState.LISTENING)
                
        except asyncio.CancelledError:
            logger.info("LLM generation cancelled")
        except Exception as e:
            logger.error(f"LLM error: {e}")
            self._set_state(ConversationState.LISTENING)
    
    # =========================================================================
    # TTS OUTPUT
    # =========================================================================
    
    async def _speak_sentence(self, text: str):
        """Generate TTS for a sentence and stream to Twilio."""
        if self.ctx.state == ConversationState.INTERRUPTED:
            return
        
        logger.info(f"🗣️ Speaking: {text}")
        
        # Apply humanizer if enabled
        if self.enable_humanizer:
            text = self._humanize_text(text)
        
        try:
            url = "https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mulaw&sample_rate=8000"
            
            first_byte = True
            
            async with self.http_session.post(
                url,
                headers={
                    "Authorization": f"Token {self.deepgram_key}",
                    "Content-Type": "application/json"
                },
                json={"text": text}
            ) as resp:
                if resp.status != 200:
                    logger.error(f"TTS error: {resp.status}")
                    return
                
                async for audio_chunk in resp.content.iter_chunked(640):  # 40ms chunks
                    if self.ctx.state == ConversationState.INTERRUPTED:
                        logger.info("TTS stream interrupted")
                        break
                    
                    if first_byte:
                        self.ctx.metrics.tts_first_byte_ms = time.time() * 1000
                        first_byte = False
                    
                    await self._send_audio(audio_chunk)
                    
        except asyncio.CancelledError:
            logger.info("TTS cancelled")
        except Exception as e:
            logger.error(f"TTS error: {e}")
    
    def _humanize_text(self, text: str) -> str:
        """Apply humanization rules for natural TTS (placeholder for Stage 5)."""
        # TODO: Implement full humanizer in Stage 5
        return text
    
    # =========================================================================
    # TWILIO AUDIO OUTPUT
    # =========================================================================
    
    async def _send_audio(self, audio_bytes: bytes):
        """Send audio chunk to Twilio."""
        if not self.ctx:
            return
        
        payload = base64.b64encode(audio_bytes).decode("utf-8")
        
        await self.twilio_ws.send_json({
            "event": "media",
            "streamSid": self.ctx.stream_sid,
            "media": {"payload": payload}
        })
    
    async def _send_clear_audio(self):
        """Send clear message to stop any queued audio on Twilio."""
        if not self.ctx:
            return
        
        await self.twilio_ws.send_json({
            "event": "clear",
            "streamSid": self.ctx.stream_sid
        })
        logger.debug("Sent clear audio command to Twilio")
