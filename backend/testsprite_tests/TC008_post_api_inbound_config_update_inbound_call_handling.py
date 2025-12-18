import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_post_api_inbound_config_update_inbound_call_handling():
    url = f"{BASE_URL}/api/inbound/config"
    headers = {
        "Content-Type": "application/json"
    }

    # Example payload to update inbound call handling configuration
    payload = {
        "callHandlingMode": "auto-answer",
        "greetingMessage": "Welcome to the clinic, how can we assist you?",
        "escalationRules": {
            "medicalQuery": True,
            "sensitiveTopic": True
        },
        "transcriptionEnabled": True,
        "recordingEnabled": True,
        "agentVoice": "calm_female",
        "language": "en-US"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"POST /api/inbound/config request failed: {e}"

    # Verify response status code is 200 OK
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Optionally verify response content if API returns updated config
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not in JSON format"

    # Validate that response JSON matches updated fields
    for key, value in payload.items():
        assert key in data, f"Response JSON missing key: {key}"
        assert data[key] == value, f"Response JSON key '{key}' expected value '{value}', got '{data[key]}'"


test_post_api_inbound_config_update_inbound_call_handling()