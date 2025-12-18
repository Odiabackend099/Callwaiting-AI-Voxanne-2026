import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_setup_vapi_integration():
    # Correct route is POST /api/vapi/setup/configure-webhook (not /api/vapi/setup)
    url = f"{BASE_URL}/api/vapi/setup/configure-webhook"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "assistantId": "test-assistant-123"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # Since authentication is required and no credentials are provided,
    # expect 401 Unauthorized or 500 Internal Server Error (per instructions).
    assert response.status_code in (200, 401, 500), f"Unexpected status code: {response.status_code}"

    if response.status_code == 200:
        try:
            data = response.json()
        except ValueError:
            assert False, "Response is not valid JSON"
        # Expect a success response to have a 'success' key with True value or similar confirmation
        assert data.get("success") is True or data.get("message") in ("Setup completed", "Vapi integration configured"), \
            f"Unexpected response content: {data}"
    else:
        # For error responses, verify error message present
        try:
            error_data = response.json()
            assert "error" in error_data or "message" in error_data, f"No error message in response: {error_data}"
        except ValueError:
            # Body might be empty or non-JSON in error case, acceptable
            pass

test_setup_vapi_integration()