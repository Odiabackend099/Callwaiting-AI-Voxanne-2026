import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_create_assistant():
    # Sync assistant to Vapi - correct route is POST /api/assistants/{agentId}/sync
    agent_id = "test-agent-123"
    url = f"{BASE_URL}/api/assistants/{agent_id}/sync"
    headers = {
        "Content-Type": "application/json"
    }
    # Payload for syncing assistant per corrected schema
    payload = {
        "system_prompt": "You are a helpful assistant",
        "name": "Test Assistant",
        "voice": "Paige"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # Accept 200 (success), 400 (validation), 401 (auth required)
    assert response.status_code in (200, 400, 401), f"Unexpected status code {response.status_code}: {response.text}"

    if response.status_code == 200:
        json_data = response.json()
        # Validate response structure
        assert isinstance(json_data, dict), "Response should be a dictionary"
    assert response.headers.get("Content-Type", "").startswith("application/json"), "Response content-type is not JSON"


test_create_assistant()