#!/usr/bin/env python3
"""
Specific Query Test: Nigeria's President
Verifies LLM logic and TTS generation for a specific general knowledge question.
"""

import os
import time
import asyncio
import json
from dotenv import load_dotenv
from deepgram import DeepgramClient
from groq import Groq

# Load environment variables
load_dotenv()

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

async def get_llm_response(query):
    """Get response from Groq LLM"""
    print(f"🤖 Asking LLM: '{query}'...")
    try:
        if not GROQ_API_KEY:
            raise ValueError("Groq API Key not found")

        client = Groq(api_key=GROQ_API_KEY)
        
        start = time.perf_counter()
        chat_completion = await asyncio.to_thread(
            client.chat.completions.create,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant. Answer directly and concisely."
                },
                {
                    "role": "user",
                    "content": query
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1 # Low temperature for factual accuracy
        )
        duration = (time.perf_counter() - start) * 1000
        content = chat_completion.choices[0].message.content
        
        print(f"✅ LLM Response ({duration:.0f}ms): {content}")
        return content

    except Exception as e:
        print(f"❌ LLM Error: {e}")
        return None

import requests

async def generate_tts(text, filename="response_nigeria.wav"):
    """Generate TTS audio from text using Deepgram REST API directly"""
    print(f"🔊 Generating TTS for: '{text[:50]}...'")
    try:
        if not DEEPGRAM_API_KEY:
            raise ValueError("Deepgram API Key not found")

        url = "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&container=wav"
        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "text": text
        }

        start = time.perf_counter()
        
        # Make direct REST call
        response = await asyncio.to_thread(
            requests.post,
            url,
            headers=headers,
            json=payload
        )
        
        if response.status_code != 200:
            raise ValueError(f"Deepgram API returned {response.status_code}: {response.text}")

        duration = (time.perf_counter() - start) * 1000
        
        # Write to file
        with open(filename, "wb") as f:
            f.write(response.content)
            
        file_size = os.path.getsize(filename)
        print(f"✅ TTS Audio saved to {filename} ({file_size} bytes) in {duration:.0f}ms")
        return True

    except Exception as e:
        print(f"❌ TTS Error: {e}")
        return False

async def main():
    print("🚀 Starting Nigeria President Query Test")
    print("----------------------------------------")
    
    query = "What is the name of Nigeria's president?"
    
    # 1. Get LLM Response
    llm_response = await get_llm_response(query)
    
    if llm_response:
        # 2. Generate TTS
        await generate_tts(llm_response)
    else:
        print("❌ Skipping TTS due to LLM failure")

if __name__ == "__main__":
    asyncio.run(main())
