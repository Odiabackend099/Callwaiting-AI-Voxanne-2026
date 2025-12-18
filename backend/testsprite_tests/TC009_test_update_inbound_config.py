import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

# Example Bearer token for authentication; replace with valid token as needed
AUTH_TOKEN = "your_valid_jwt_token_here"

HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

def test_update_inbound_config():
    url = f"{BASE_URL}/api/inbound/config"
    payload = {
        # Example payload updating inbound call handling config with features mentioned
        "inboundCallHandling": True,
        "callRecording": {
            "enabled": True,
            "storage": "secure",
            "signedUrlExpirySeconds": 3600
        },
        "liveTranscript": True,
        "callLogDashboard": {
            "filters": ["date", "agent", "status"],
            "pagination": True,
            "analyticsEnabled": True,
            "playbackEnabled": True
        },
        "knowledgeBaseRAG": {
            "enabled": True,
            "documentUpload": True,
            "chunking": True,
            "embedding": True,
            "vectorSearch": True
        },
        "agentConfig": {
            "customizeGreeting": True,
            "voiceOptions": ["female_english", "male_spanish"],
            "languageSupport": ["en-US", "es-ES"]
        },
        "smartEscalation": {
            "enabled": True,
            "sensitiveTopics": ["medical"],
            "escalationLogging": True
        },
        "realTimeUpdates": {
            "websocketEnabled": True,
            "autoReconnect": True,
            "idempotency": True
        },
        "auth": {
            "methods": ["jwt", "google-oauth"],
            "rowLevelSecurity": True
        },
        "productionDeployment": {
            "providers": ["render", "vercel"],
            "environmentConfig": True,
            "automatedWorkflows": True
        }
    }

    try:
        response = requests.post(url, headers=HEADERS, json=payload, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to update inbound config failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}. Response: {response.text}"

    try:
        resp_json = response.json()
    except ValueError:
        assert False, "Response is not valid JSON."

    # Assuming the success response includes a field "success": true
    assert "success" in resp_json, "Response JSON missing 'success' key."
    assert resp_json["success"] is True, f"Update not successful: {resp_json}"

test_update_inbound_config()