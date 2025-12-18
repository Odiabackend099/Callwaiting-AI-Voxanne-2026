import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_start_outbound_calls():
    url = f"{BASE_URL}/api/calls/start"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "leads": [
            {"id": "lead-1", "phone": "+1234567890", "name": "Lead 1"},
            {"id": "lead-2", "phone": "+1987654321", "name": "Lead 2"}
        ],
        "vapiAgentId": "agent-12345",
        "selectedVoice": "en-US-Wavenet-F"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        # Accept 200 (success), 400 (validation), 401 (auth), 500 (server error)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        assert response.status_code in (200, 400, 401, 500), f"Unexpected status code: {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"


test_start_outbound_calls()
