import asyncio
import os
import sys
import numpy as np
import sounddevice as sd
import requests
from dotenv import load_dotenv

load_dotenv()

# Configuration
SAMPLE_RATE = 16000
TTS_MODEL = "aura-2-thalia-en"
TEST_TEXT = (
    "Hello, this is Roxanne. I am currently performing a system check to ensure "
    "my voice synthesis is operating at peak performance. This audio sample should "
    "last approximately ten seconds, allowing us to verify playback clarity and volume levels "
    "before we begin our real-time conversation."
)

async def generate_and_play():
    dg_key = os.getenv("DEEPGRAM_API_KEY")
    if not dg_key:
        print("❌ Error: DEEPGRAM_API_KEY not found in .env")
        return

    try:
        print(f"🎙️  Generating ~10s audio with model: {TTS_MODEL}...")
        print(f"📝 Text: '{TEST_TEXT}'")

        # Use REST API directly to avoid SDK version issues
        url = f"https://api.deepgram.com/v1/speak?model={TTS_MODEL}&encoding=linear16&sample_rate={SAMPLE_RATE}&container=none"
        headers = {
            "Authorization": f"Token {dg_key}",
            "Content-Type": "application/json"
        }
        payload = {"text": TEST_TEXT}

        response = requests.post(url, headers=headers, json=payload, stream=True)
        
        if response.status_code != 200:
            print(f"❌ API Error: {response.status_code} - {response.text}")
            return

        filename = "roxanne_test.raw"
        with open(filename, "wb") as f:
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    f.write(chunk)
        
        print("✅ Audio generated.")

        # 2. Play
        print("🔊 Playing audio...")
        if os.path.exists(filename):
            with open(filename, "rb") as f:
                raw_bytes = f.read()
            
            # Convert raw bytes to numpy array (int16)
            data = np.frombuffer(raw_bytes, dtype=np.int16)
            
            # Normalize volume if too quiet (optional, but good for testing)
            # data = data * 1.5 
            
            sd.play(data, SAMPLE_RATE)
            sd.wait()
            print("✅ Playback complete.")
            
            # Cleanup
            os.remove(filename)
        else:
            print("❌ Error: Audio file was not saved.")

    except Exception as e:
        print(f"❌ Error during TTS generation/playback: {e}")

if __name__ == "__main__":
    asyncio.run(generate_and_play())
