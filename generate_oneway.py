import requests
import json
import os

# Using the working Deepgram key
API_KEY = "5cbcc27f93e9482539024d285133f0dc47bf7dab"
HEADERS = {
    "Authorization": f"Token {API_KEY}",
    "Content-Type": "application/json"
}
OUTPUT_DIR = "public/audio/demos"

# Voxanne's Voice: Aura Thalia (As requested)
VOICE_MODEL = "aura-asteria-en" # Fallback/Reference
# We will use the specific URL params for Thalia

# One-Way Scripts (Voxanne's responses only)
scripts = [
    {
        "filename": "bbl-inquiry-pricing.wav",
        "text": "I completely understand why you'd ask about pricing first. It's a significant investment in yourself. Dr. Chen's all-inclusive BBL packages start at eight thousand, five hundred pounds. That covers everything—anesthesia, facility fees, and your post-op care—so there are absolutely no hidden costs. I'd love to schedule a consultation so you can get a personalized quote. I have an opening this Thursday at 2 PM. Shall I book that for you?"
    },
    {
        "filename": "after-hours-triage.wav",
        "text": "I hear that your leg is red and hot three days post-op. I am flagging this immediately. While I don't want you to panic, standard protocol requires us to assess this right away to rule out any complications. I am connecting you directly to Nurse Sarah on our emergency line now. Please stay on the line."
    },
    {
        "filename": "instagram-lead-conversion.wav",
        "text": "Thanks for reaching out! The 'Lunch Break' Botox is honestly a game changer. It only takes about 15 minutes, so you can come in, get refreshed, and be back to your day instantly. We have a 'Glow and Go' spot available this Thursday at 2 PM. Would you like to grab it?"
    }
]

def generate_audio(text, filename):
    # Using Thalia with linear16 encoding in a WAV container (browser playable)
    # user asked for container=none but that won't play in <html> audio tags, so using wav
    url = f"https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=16000&container=wav"
    data = {"text": text}
    response = requests.post(url, json=data, headers=HEADERS)
    
    if response.status_code == 200:
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(response.content)
        print(f"✅ Generated: {filename}")
    else:
        print(f"❌ Error {filename}: {response.text}")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("🚀 Generating One-Way Voxanne Samples with Deepgram Aura...")
    
    for item in scripts:
        generate_audio(item["text"], item["filename"])

if __name__ == "__main__":
    main()
