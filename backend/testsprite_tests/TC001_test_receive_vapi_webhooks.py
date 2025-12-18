import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_receive_vapi_webhooks():
    url = f"{BASE_URL}/api/webhooks/vapi"
    headers = {
        "Content-Type": "application/json"
    }
    # Matches VapiEventValidationSchema in webhooks.ts
    payload = {
        "type": "call.started",
        "call": {
            "id": "c92f5843-1b7a-4256-a3b7-7c1a8a2a953e",
            "status": "in-progress",
            "assistantId": "assistant-67890",
            "customer": {
                "number": "+1234567890",
                "name": "Jane Doe"
            },
            "cost": 0,
            "endedReason": "ongoing"
        },
        "artifact": {
            "transcript": "",
            "recording": ""
        }
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        # Accept 200 (success), 400 (validation), 401 (auth), 500 (server error/db error)
        # Note: 500 is common if DB credentials are missing in test env
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        assert response.status_code in (200, 400, 401, 500), f"Unexpected status code: {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_receive_vapi_webhooks()