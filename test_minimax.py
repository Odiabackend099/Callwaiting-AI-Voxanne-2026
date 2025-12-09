import requests
import json
import os

# Credentials provided by user
API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJPRElBIGJhY2tlbmQiLCJVc2VyTmFtZSI6Ik9ESUEgYmFja2VuZCIsIkFjY291bnQiOiIiLCJTdWJqZWN0SUQiOiIxOTMzNTEwOTg4MDAzMjgzNzUxIiwiUGhvbmUiOiIiLCJHcm91cElEIjoiMTkzMzUxMDk4Nzk5NDg5NTE0MyIsIlBhZ2VOYW1lIjoiIiwiTWFpbCI6Im9kaWFiYWNrZW5kQGdtYWlsLmNvbSIsIkNyZWF0ZVRpbWUiOiIyMDI1LTEyLTA5IDE4OjA3OjExIiwiVG9rZW5UeXBlIjoxLCJpc3MiOiJtaW5pbWF4In0.OIkhzK95W-k_c521OFtpQXx6Q0HNMc_1IPgcML1r-NNaB6HouzE5MG24KulgIU0JDzN2QZDUAjSWwh2XYawNRAvO5bEfPvsMIa73w-uCFynnLbfDUC-cUxFP2ArD0th1dWr-CyFnPPSrWj8tg-fWFeDfW4p4eE07uzoM9DOSno0patvr9BY0GbJ0NDF8xoDvzSk7S5sasqsw5cDUMX2srPYE3OOHBnYPm9P0GY-imyj7JvNQFUHmNMHN979qquF3p7tlVWN7YtPFN-04p0pDPeSLTiKUZvM2CEy5RpXJdKWgIbawnymGdAxW1PY4WsSlo36Ckk5_inrsUTPvVTluKA"
GROUP_ID = "1933510987994895143"

def test_minimax():
    url = f"https://api.minimax.chat/v1/text_to_speech?GroupId={GROUP_ID}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Using a standard voice ID I suspect might work, if fails we will inspect response
    payload = {
        "voice_id": "female-yujie", 
        "text": "Hello, this is a test of the Minimax voice generation for Roxanne AI.",
        "model": "speech-01"
    }
    
    print(f"Testing Minimax API...")
    print(f"URL: {url}")
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        print("✅ Success! Audio generated.")
        if response.headers.get("Content-Type") == "audio/mpeg":
            with open("test_minimax.mp3", "wb") as f:
                f.write(response.content)
            print("Saved to test_minimax.mp3")
        else:
             print("Response content type:", response.headers.get("Content-Type"))
             # Sometimes they return JSON with audio url or base64
             try:
                 data = response.json()
                 print("Full Response:", json.dumps(data, indent=2))
             except:
                 print("Could not parse JSON response.")
    else:
        print(f"❌ Failed: {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    test_minimax()
