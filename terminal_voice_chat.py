#!/usr/bin/env python3
"""
CallWaiting AI - Voxanne Terminal Voice Chat
✅ Uses REST API (no SDK conflicts)
✅ Aura-2 Thalia voice
✅ Groq Llama-3.3-70B for real responses
✅ Barge-in / Interruption Handling
"""

import asyncio
import json
import requests
import os
import sys
import queue
import time
import re
import numpy as np
import sounddevice as sd
import soundfile as sf
import io
from typing import Optional
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# Configuration
SAMPLE_RATE = 16000
CHANNELS = 1
VAD_THRESHOLD = 0.010
SILENCE_DURATION = 0.3  # Faster turn-taking
CHUNK_SIZE = 1024

# TTS Config (Approved Voice)
TTS_MODEL = "aura-2-thalia-en"
TTS_ENCODING = "linear16"
TTS_SAMPLE_RATE = 16000

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

VOXANNE_SYSTEM_PROMPT = get_voxanne_prompt()


class VoxanneTerminalChat:
    def __init__(self):
        self.dg_key = os.getenv("DEEPGRAM_API_KEY")
        self.groq_key = os.getenv("GROQ_API_KEY")
        
        if not self.dg_key or not self.groq_key:
            print("❌ Error: Missing API keys in .env")
            print("   Set DEEPGRAM_API_KEY and GROQ_API_KEY")
            sys.exit(1)

        # Initialize Groq client
        self.groq_client = Groq(api_key=self.groq_key)
        
        # Conversation history
        self.messages = [
            {"role": "system", "content": VOXANNE_SYSTEM_PROMPT}
        ]
        
        # Async objects (initialized in start)
        self.input_queue = None
        self.playback_queue = None
        self.interruption_event = None
        self.loop = None
        
        self.is_speaking = False
        self.stop_playback_flag = False
        
        # REST Session for Deepgram
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Token {self.dg_key}",
            "Content-Type": "application/json"
        })
        
        print("🚀 Voxanne Terminal Voice Chat Initialized")
        print(f"   TTS Voice: {TTS_MODEL}")
        print(f"   LLM: Groq Llama-3.3-70B")

    async def start(self):
        """Start the conversation loops"""
        self.loop = asyncio.get_running_loop()
        self.input_queue = asyncio.Queue()
        self.playback_queue = asyncio.Queue()
        self.interruption_event = asyncio.Event()

        print("\n✨ Voxanne AI Sales Agent")
        print("   - Barge-in Enabled (Speak to interrupt)")
        print("   - Press Ctrl+C to exit\n")

        # Initial Greeting
        greeting = "Hi! This is Voxanne from CallWaiting A.I. How can I help you today?"
        print(f"👩🏼‍⚕️ Voxanne: {greeting}")
        await self.synthesize_and_enqueue(greeting)
        
        # Start Tasks
        try:
            await asyncio.gather(
                self.audio_input_loop(),
                self.conversation_manager(),
                self.audio_output_loop()
            )
        except asyncio.CancelledError:
            pass
        except KeyboardInterrupt:
            pass
        finally:
            print("\n👋 Call ended.")

    async def audio_input_loop(self):
        """Capture audio, detect VAD, and send for STT"""
        # loop = asyncio.get_event_loop() # Use self.loop
        audio_queue = queue.Queue()

        def callback(indata, frames, time, status):
            if status:
                print(status, file=sys.stderr)
            audio_queue.put(indata.copy())

        stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            callback=callback
        )
        
        with stream:
            buffer = []
            silence_start = None
            speaking = False
            
            while True:
                while not audio_queue.empty():
                    data = audio_queue.get()
                    amplitude = np.linalg.norm(data) / len(data)
                    
                    # Interruption Detection (Barge-in)
                    # We only care about loud enough speech to interrupt
                    if self.is_speaking and amplitude > VAD_THRESHOLD * 2.0: 
                        if not self.interruption_event.is_set():
                            print("\n⚡ [Barge-in Detected]", end="\r", flush=True)
                            self.stop_playback_flag = True
                            self.interruption_event.set()
                    
                    if amplitude > VAD_THRESHOLD:
                        if not speaking:
                            print("👂 Listening...       ", end="\r", flush=True)
                            speaking = True
                        silence_start = None
                        buffer.append(data)
                    else:
                        if speaking:
                            if silence_start is None:
                                silence_start = time.time()
                            elif time.time() - silence_start > SILENCE_DURATION:
                                # End of speech
                                speaking = False
                                print("🧠 Thinking...        ", end="\r", flush=True)
                                
                                if buffer:
                                    audio_data = np.concatenate(buffer, axis=0)
                                    # Offload STT to thread
                                    await self.loop.run_in_executor(None, self.process_audio_chunk, audio_data)
                                    buffer = []
                                    silence_start = None
                        elif self.is_speaking:
                            pass
                        else:
                            pass
                            
                await asyncio.sleep(0.01)

    def process_audio_chunk(self, audio_data):
        """Send audio to Deepgram REST API (blocking)"""
        # Convert to WAV
        wav_io = io.BytesIO()
        sf.write(wav_io, audio_data, SAMPLE_RATE, format='WAV', subtype='PCM_16')
        wav_data = wav_io.getvalue()
        
        try:
            url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true"
            headers = {
                "Authorization": f"Token {self.dg_key}",
                "Content-Type": "audio/wav"
            }
            response = requests.post(url, headers=headers, data=wav_data, timeout=5)
            response.raise_for_status()
            result = response.json()
            transcript = result.get('results', {}).get('channels', [])[0].get('alternatives', [])[0].get('transcript', '')
            
            if transcript.strip():
                # Put in async queue for conversation manager
                asyncio.run_coroutine_threadsafe(self.input_queue.put(transcript), self.loop)
                
        except Exception as e:
            print(f"❌ STT Error: {e}")

    async def conversation_manager(self):
        """Manage conversation flow: STT -> LLM -> TTS"""
        while True:
            # Wait for user input
            text = await self.input_queue.get()
            
            # Skip if it's Voxanne's own voice (echo detection)
            if self.is_speaking:
                continue
            
            # Check interruption
            if self.interruption_event.is_set():
                self.interruption_event.clear()
            
            print(f"\n👤 You: {text}")
            
            if any(kw in text.lower() for kw in ["exit", "quit", "goodbye", "bye"]):
                farewell = "Thank you for calling! Have a wonderful day."
                print(f"👩🏼‍⚕️ Voxanne: {farewell}")
                await self.synthesize_and_enqueue(farewell)
                await asyncio.sleep(2)
                sys.exit(0)

            # Add user message to history
            self.messages.append({"role": "user", "content": text})
            
            # Get LLM response with streaming
            print("👩🏼‍⚕️ Voxanne: ", end="", flush=True)
            
            try:
                response_text = ""
                buffer = ""
                first_chunk = True
                start_time = time.time()
                
                # Stream from Groq (use smaller model for speed)
                stream = self.groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",  # Faster model
                    messages=self.messages,
                    max_tokens=100,  # Shorter responses
                    temperature=0.7,
                    stream=True
                )
                
                for chunk in stream:
                    # Check for interruption
                    if self.interruption_event.is_set():
                        print("\n[Interrupted]")
                        break
                    
                    delta = chunk.choices[0].delta.content
                    if delta:
                        if first_chunk:
                            ttfb = (time.time() - start_time) * 1000
                            print(f"[{ttfb:.0f}ms] ", end="", flush=True)
                            first_chunk = False
                        
                        print(delta, end="", flush=True)
                        response_text += delta
                        buffer += delta
                        
                        # Stream TTS immediately on sentence boundaries
                        if any(end in buffer for end in ['. ', '! ', '? ', '."', '!"', '?"']):
                            await self.synthesize_and_enqueue(buffer.strip())
                            buffer = ""
                
                # Send remaining buffer
                if buffer.strip() and not self.interruption_event.is_set():
                    await self.synthesize_and_enqueue(buffer.strip())
                
                # Add to history
                if response_text:
                    self.messages.append({"role": "assistant", "content": response_text})
                    
                    # Keep history manageable
                    if len(self.messages) > 20:
                        self.messages = [self.messages[0]] + self.messages[-18:]
                
            except Exception as e:
                print(f"\n❌ LLM Error: {e}")
                await self.synthesize_and_enqueue("Sorry, could you repeat that?")
            
            print()  # Newline after response

    async def synthesize_and_enqueue(self, text):
        """Generate TTS audio and put in playback queue"""
        if not text.strip():
            return
            
        try:
            url = f"https://api.deepgram.com/v1/speak?model={TTS_MODEL}&encoding={TTS_ENCODING}&sample_rate={TTS_SAMPLE_RATE}&container=none"
            response = self.session.post(url, json={"text": text}, timeout=10)
            
            if response.status_code == 200:
                raw_data = response.content
                audio_array = np.frombuffer(raw_data, dtype=np.int16)
                await self.playback_queue.put(audio_array)
            else:
                print(f"\n❌ TTS Error: {response.status_code} - {response.text[:100]}")
        except Exception as e:
            print(f"\n❌ TTS Exception: {e}")

    async def audio_output_loop(self):
        """Continuous audio playback with instant interruption"""
        output_stream = sd.OutputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype=np.int16
        )
        
        with output_stream:
            while True:
                # Check stop flag
                if self.stop_playback_flag:
                    while not self.playback_queue.empty():
                        try: self.playback_queue.get_nowait()
                        except: pass
                    self.stop_playback_flag = False
                    self.is_speaking = False
                
                try:
                    # Get audio chunk (wait short time to allow loop to check stop flag)
                    audio_chunk = await asyncio.wait_for(self.playback_queue.get(), timeout=0.05)
                    self.is_speaking = True
                    
                    # Play in small blocks to allow interruption
                    # audio_chunk is a numpy array of int16
                    block_size = 2048
                    total_samples = len(audio_chunk)
                    
                    for i in range(0, total_samples, block_size):
                        if self.stop_playback_flag:
                            break
                        
                        # Write small block
                        end = min(i + block_size, total_samples)
                        output_stream.write(audio_chunk[i:end])
                    
                    if self.playback_queue.empty():
                        self.is_speaking = False
                        
                except asyncio.TimeoutError:
                    self.is_speaking = False
                    continue
                except Exception as e:
                    print(f"Playback Error: {e}")
                    self.is_speaking = False

if __name__ == "__main__":
    chat = VoxanneTerminalChat()
    asyncio.run(chat.start())
