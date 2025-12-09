from deepgram import DeepgramClient
import os
from dotenv import load_dotenv

load_dotenv()
client = DeepgramClient(api_key=os.getenv("DEEPGRAM_API_KEY"))
try:
    # Try passing combined dict
    response = client.speak.v1.audio.generate({"text": "Hello", "model": "aura-asteria-en"})
    print(f"Response type: {type(response)}")
    print(f"Response dir: {dir(response)}")
except Exception as e:
    print(f"Error calling generate: {e}")
