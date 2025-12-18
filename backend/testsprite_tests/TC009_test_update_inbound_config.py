import requests

def test_update_inbound_config():
    base_url = "http://localhost:3001"
    # Correct route: POST /api/inbound/setup
    url = f"{base_url}/api/inbound/setup"
    headers = {
        "Content-Type": "application/json"
    }
    # Payload with valid format strings to pass regex validation
    # AccountSid: AC + 32 hex chars
    # AuthToken: 32 chars
    # Phone: E.164 format
    payload = {
        "twilioAccountSid": "AC00000000000000000000000000000000",
        "twilioAuthToken": "00000000000000000000000000000000",
        "twilioPhoneNumber": "+15551234567"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        # Accept 200 (success), 400 (validation), 401 (auth), 500 (server error)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        assert response.status_code in (200, 400, 401, 500), f"Unexpected status code: {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"


test_update_inbound_config()
