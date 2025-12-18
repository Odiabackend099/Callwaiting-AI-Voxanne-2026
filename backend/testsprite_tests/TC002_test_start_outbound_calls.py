import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_start_outbound_calls():
    url = f"{BASE_URL}/api/calls/start"
    headers = {
        "Content-Type": "application/json"
    }

    # Adjusted leads array to array of objects with 'phone' field as string
    payload = {
        "leads": [
            {"phone": "+1234567890"},
            {"phone": "+1987654321"}
        ],
        "vapiAgentId": "agent_abc123",
        "selectedVoice": "en-US-Wavenet-D"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to start outbound calls failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        resp_json = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    # Checking response keys, callsStarted is probable key
    confirmation_keys = ['message', 'confirmation', 'status', 'callsStarted']
    assert any(key in resp_json for key in confirmation_keys), "Response JSON missing confirmation keys"

    if 'message' in resp_json:
        assert isinstance(resp_json['message'], str) and len(resp_json['message']) > 0, "Message should be a non-empty string"


test_start_outbound_calls()
