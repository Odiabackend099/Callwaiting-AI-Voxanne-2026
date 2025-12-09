import requests
import json
import os

# Credentials provided
API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJPRElBIGJhY2tlbmQiLCJVc2VyTmFtZSI6Ik9ESUEgYmFja2VuZCIsIkFjY291bnQiOiIiLCJTdWJqZWN0SUQiOiIxOTMzNTEwOTg4MDAzMjgzNzUxIiwiUGhvbmUiOiIiLCJHcm91cElEIjoiMTkzMzUxMDk4Nzk5NDg5NTE0MyIsIlBhZ2VOYW1lIjoiIiwiTWFpbCI6Im9kaWFiYWNrZW5kQGdtYWlsLmNvbSIsIkNyZWF0ZVRpbWUiOiIyMDI1LTEyLTA5IDE4OjA3OjExIiwiVG9rZW5UeXBlIjoxLCJpc3MiOiJtaW5pbWF4In0.OIkhzK95W-k_c521OFtpQXx6Q0HNMc_1IPgcML1r-NNaB6HouzE5MG24KulgIU0JDzN2QZDUAjSWwh2XYawNRAvO5bEfPvsMIa73w-uCFynnLbfDUC-cUxFP2ArD0th1dWr-CyFnPPSrWj8tg-fWFeDfW4p4eE07uzoM9DOSno0patvr9BY0GbJ0NDF8xoDvzSk7S5sasqsw5cDUMX2srPYE3OOHBnYPm9P0GY-imyj7JvNQFUHmNMHN979qquF3p7tlVWN7YtPFN-04p0pDPeSLTiKUZvM2CEy5RpXJdKWgIbawnymGdAxW1PY4WsSlo36Ckk5_inrsUTPvVTluKA"
GROUP_ID = "1933510987994895143"

def test_minimax_v2():
    # Try the T2A v2 endpoint
    url = f"https://api.minimax.chat/v1/t2a_v2?GroupId={GROUP_ID}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "speech-01-turbo",
        "text": "Hello, this is a test of the Minimax voice generation.",
        "stream": False,
        "voice_setting": {
            "voice_id": "female-yujie",
            "speed": 1.0,
            "vol": 1.0,
            "pitch": 0
        }
    }
    
    print(f"Testing Minimax T2A v2...")
    print(f"URL: {url}")
    
    # Debug: print token first 10 chars
    print(f"Token: {API_KEY[:10]}...")

    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print("Response JSON:", json.dumps(data, indent=2))
        
        # Check if successful
        if data.get('base_resp', {}).get('status_code') == 0:
            print("✅ Success! Audio generated (check data/audio_file in JSON)")
        else:
            print(f"❌ API Error: {data.get('base_resp', {}).get('status_msg')}")
    else:
        print(f"❌ HTTP Failed: {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    test_minimax_v2()
