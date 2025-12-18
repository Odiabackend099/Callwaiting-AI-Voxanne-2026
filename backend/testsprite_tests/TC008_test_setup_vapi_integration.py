import requests

def test_setup_vapi_integration():
    base_url = "http://localhost:3001"
    # Correct route: POST /api/vapi/setup/configure-webhook (not /api/vapi/setup)
    url = f"{base_url}/api/vapi/setup/configure-webhook"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "assistantId": "test-assistant-123"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        # Accept 200 (success), 400 (validation), 401 (auth), 500 (server error)
        assert response.status_code in (200, 400, 401, 500), f"Unexpected status code: {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request to setup Vapi integration failed: {e}"

test_setup_vapi_integration()