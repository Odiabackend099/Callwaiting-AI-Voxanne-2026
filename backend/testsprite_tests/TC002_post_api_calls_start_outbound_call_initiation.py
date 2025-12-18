import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {
    "Content-Type": "application/json"
}

def test_post_api_calls_start_outbound_call_initiation():
    url = f"{BASE_URL}/api/calls/start"
    payload = {
        "leads": [
            {"phone": "+1234567890"},
            {"phone": "+1987654321"}
        ],
        "vapiAgentId": "agent123",
        "selectedVoice": "female_english_us"
    }

    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        json_response = response.json()
        assert json_response is not None, "Response JSON is None"
        assert isinstance(json_response, dict), "Response JSON is not a dict"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"


test_post_api_calls_start_outbound_call_initiation()
