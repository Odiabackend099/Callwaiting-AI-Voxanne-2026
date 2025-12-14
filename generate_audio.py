import requests
import json
import os

api_key = "sk_8187dd94f6ef163fea31e34b99c33525d560af3a25211759"
headers = {
    "xi-api-key": api_key,
    "Content-Type": "application/json"
}
voice_id = "EXAVITQu4vr4xnSDxMaL"  # Sarah - Professional/Reassuring

scripts = [
    {
        "filename": "bbl-inquiry-pricing.mp3",
        "text": "Hello! Thanks for calling Dr. Chen's office. This is Voxanne. I hear you're interested in a BBL, that's exciting. It is a big decision, and I completely understand wanting to get the price just right. Many of our patients feel the same way initially. We share our clear pricing upfront because we want you to feel absolutely confident and comfortable with your choice. To answer your question directly, Dr. Chen's all-inclusive BBL packages start at eight thousand five hundred pounds. This includes your anesthesia, surgical facility, post-op garments, and all follow-up care, so there are no surprise fees. Since every body is unique, the best way to get an exact quote is a quick consultation. I have an opening this Thursday at 2 PM. Shall we lock that in for you to meet Dr. Chen?"
    },
    {
        "filename": "after-hours-triage.mp3",
        "text": "I hear you saying there is swelling three days post-op. I am flagging this immediately. I know this can be really scary to see, but stick with me. We are going to take care of you right now. You are not alone in this. Standard protocol for day 3 swelling is an immediate assessment to ensure you are healing safely. I am connecting you directly to Nurse Sarah on the emergency line. Please stay on the line, I'm transferring you now. Do not hang up."
    },
    {
        "filename": "instagram-lead-conversion.mp3",
        "text": "Hey! Thanks so much for the DM. I caught your message about Botox right away. It’s amazing what a little refresh can do for confidence. Whether it’s smoothing forehead lines or softening crow’s feet, we love helping people look as vibrant as they feel. What specific look are you going for?... Oh, I love that natural look too. For the forehead and eyes, typically we recommend about 30 units, but we customize it perfectly for you. We actually have a 'Lunch Break' special opening this Thursday at 2 PM. It only takes 15 minutes. Would you like to grab that spot with Nurse Sarah before it goes?"
    }
]

output_dir = "public/audio/demos"
os.makedirs(output_dir, exist_ok=True)

for item in scripts:
    print(f"Generating {item['filename']}...")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    data = {
        "text": item["text"],
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.5,
            "use_speaker_boost": True
        }
    }
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code == 200:
        with open(f"{output_dir}/{item['filename']}", "wb") as f:
            f.write(response.content)
        print(f"Saved {item['filename']}")
    else:
        print(f"Error generating {item['filename']}: {response.text}")
