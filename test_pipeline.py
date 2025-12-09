#!/usr/bin/env python3
"""
Pipeline Health Check
Verifies STT (Deepgram), LLM (Groq), and TTS (Deepgram) connectivity and latency.
"""

import os
import time
import asyncio
import json
import requests
from dotenv import load_dotenv
from deepgram import DeepgramClient
from groq import Groq

# Load environment variables
load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def print_status(component, status, latency=None, details=None):
    icon = "✅" if status == "OK" else "❌"
    latency_str = f" | Latency: {latency:.0f}ms" if latency is not None else ""
    details_str = f" | {details}" if details else ""
    print(f"{icon} {component}: {status}{latency_str}{details_str}")

async def test_stt():
    """Test Deepgram STT"""
    try:
        if not DEEPGRAM_API_KEY:
            return "MISSING_KEY", 0, "Deepgram API Key not found"

        start = time.perf_counter()
        deepgram = DeepgramClient(DEEPGRAM_API_KEY)
        
        # Use a hosted sample file for testing STT
        audio_url = "https://static.deepgram.com/examples/interview_speech-analytics.wav"
        
        # Using dictionary for options
        options = {
            "model": "nova-2",
            "smart_format": True,
            "utterances": True,
            "punctuate": True,
        }

        response = await asyncio.to_thread(
            deepgram.listen.prerecorded.v("1").transcribe_url,
            {"url": audio_url},
            options
        )
        
        duration = (time.perf_counter() - start) * 1000
        
        # Accessing results safely
        try:
            transcript = response.results.channels[0].alternatives[0].transcript
        except:
            # Fallback for dictionary access if response is a dict
            transcript = response['results']['channels'][0]['alternatives'][0]['transcript']
        
        if transcript:
            return "OK", duration, f"Transcript sample: {transcript[:30]}..."
        else:
            return "FAIL", duration, "No transcript received"
            
    except Exception as e:
        return "FAIL", 0, str(e)

async def test_llm():
    """Test Groq LLM"""
    try:
        if not GROQ_API_KEY:
            return "MISSING_KEY", 0, "Groq API Key not found"

        start = time.perf_counter()
        client = Groq(api_key=GROQ_API_KEY)
        
        chat_completion = await asyncio.to_thread(
            client.chat.completions.create,
            messages=[
                {
                    "role": "system",
                    "content": "You are a health check bot. Respond with 'OK'."
                },
                {
                    "role": "user",
                    "content": "Status report?"
                }
            ],
            model="llama-3.3-70b-versatile",
        )
        
        duration = (time.perf_counter() - start) * 1000
        content = chat_completion.choices[0].message.content
        
        if content:
            return "OK", duration, f"Response: {content}"
        else:
            return "FAIL", duration, "Empty response"

    except Exception as e:
        return "FAIL", 0, str(e)

async def test_tts(text="Hello world"):
    """Test Deepgram TTS via REST API"""
    try:
        if not DEEPGRAM_API_KEY:
            return "MISSING_KEY", 0, "Deepgram API Key not found"

        url = "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&container=wav"
        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {"text": text}

        start = time.perf_counter()
        
        # Make direct REST call
        response = await asyncio.to_thread(
            requests.post,
            url,
            headers=headers,
            json=payload
        )
        
        duration = (time.perf_counter() - start) * 1000
        
        if response.status_code == 200:
            audio_size = len(response.content)
            return "OK", duration, f"Generated {audio_size} bytes"
        else:
            return "FAIL", duration, f"API Error: {response.status_code}"
            
    except Exception as e:
        return "FAIL", 0, str(e)

async def main():
    print("🚀 Starting Pipeline Health Check...")
    print("-----------------------------------")
    
    # Run tests concurrently
    stt_task = asyncio.create_task(test_stt())
    llm_task = asyncio.create_task(test_llm())
    tts_task = asyncio.create_task(test_tts())
    
    stt_res, llm_res, tts_res = await asyncio.gather(stt_task, llm_task, tts_task)
    
    print_status("STT (Deepgram)", *stt_res)
    print_status("LLM (Groq)    ", *llm_res)
    print_status("TTS (Deepgram)", *tts_res)
    
    print("-----------------------------------")
    if all(res[0] == "OK" for res in [stt_res, llm_res, tts_res]):
        print("✅ SYSTEM OPERATIONAL")
    else:
        print("⚠️ SYSTEM ISSUES DETECTED")

if __name__ == "__main__":
    asyncio.run(main())
