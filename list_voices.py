import requests
import json

api_key = "sk_8187dd94f6ef163fea31e34b99c33525d560af3a25211759"
headers = {"xi-api-key": api_key}
response = requests.get("https://api.elevenlabs.io/v1/voices", headers=headers)

if response.status_code == 200:
    voices = response.json()["voices"]
    print(f"Found {len(voices)} voices.")
    for v in voices:
        labels = v.get('labels', {})
        if labels.get('gender') == 'female' and labels.get('age') == 'young':
             print(f"ID: {v['voice_id']} | Name: {v['name']} | Accent: {labels.get('accent')} | Desc: {v.get('description')}")
else:
    print("Error:", response.text)
