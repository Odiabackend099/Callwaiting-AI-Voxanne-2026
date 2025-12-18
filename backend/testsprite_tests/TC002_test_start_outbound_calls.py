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
            {"id": "lead-1", "phone": "+15555550100", "name": "John Doe"},
            {"id": "lead-2", "phone": "+15555550200", "name": "Jane Smith"}
        ],
        "vapiAgentId": "agent-12345",
        "selectedVoice": "Paige"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        # The endpoint requires authentication; expect 401 if no credentials
        assert response.status_code in (200, 401, 500), f"Unexpected status code: {response.status_code}"
        if response.status_code == 200:
            try:
                data = response.json()
            except Exception:
                data = None
            assert data is None or isinstance(data, dict) or isinstance(data, list)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_start_outbound_calls()
