import requests

BASE_URL = "http://localhost:3001"
API_PATH = "/api/vapi/setup"
TIMEOUT = 30

def test_post_api_vapi_setup_integration_setup():
    url = BASE_URL + API_PATH
    headers = {
        "Content-Type": "application/json"
    }
    # Example payload for Vapi integration setup - adjust fields as appropriate for the actual API
    payload = {
        "integrationName": "voxanne-mvp-integration",
        "apiKey": "test-api-key-123456",
        "callbackUrl": "https://example.com/vapi/webhook",
        "enableWebhook": True,
        "agentConfig": {
            "voice": "female_english_us",
            "language": "en-US",
            "greetingMessage": "Hello, this is Voxanne AI Receptionist."
        }
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 200 or response.status_code == 201, \
        f"Expected status code 200 or 201, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate some expected keys in the response
    assert "integrationId" in data and isinstance(data["integrationId"], str) and data["integrationId"], \
        "Response JSON must contain a non-empty 'integrationId' string"
    assert "status" in data and data["status"] == "success", \
        "Response JSON must contain 'status' with value 'success'"
    assert "configuredAgent" in data and isinstance(data["configuredAgent"], dict), \
        "Response JSON must contain 'configuredAgent' as an object"

    configured_agent = data["configuredAgent"]
    assert configured_agent.get("voice") == payload["agentConfig"]["voice"], \
        "Configured agent voice does not match the request"
    assert configured_agent.get("language") == payload["agentConfig"]["language"], \
        "Configured agent language does not match the request"
    assert configured_agent.get("greetingMessage") == payload["agentConfig"]["greetingMessage"], \
        "Configured agent greeting message does not match the request"

test_post_api_vapi_setup_integration_setup()
