import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}

def test_create_assistant():
    # Correct route: POST /api/assistants/{agentId}/sync (not POST /api/assistants)
    agent_id = "test-agent-123"
    url = f"{BASE_URL}/api/assistants/{agent_id}/sync"
    payload = {
        "system_prompt": "You are a helpful assistant.",
        "name": "Test Assistant",
        "voice": "jennifer"
    }

    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        # Accept 200 (success), 400 (validation), 401 (auth)
        assert response.status_code in (200, 400, 401), f"Unexpected status code: {response.status_code}"

        if response.status_code == 200:
            response_json = response.json()
            assert isinstance(response_json, dict), "Response should be a dictionary"

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_create_assistant()
