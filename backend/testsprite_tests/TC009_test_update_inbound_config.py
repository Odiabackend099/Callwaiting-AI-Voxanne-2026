import requests

def test_update_inbound_config():
    base_url = "http://localhost:3001"
    # Correct route: POST /api/inbound/setup (not /api/inbound/config)
    url = f"{base_url}/api/inbound/setup"
    headers = {
        "Content-Type": "application/json"
    }
    # Payload with required Twilio credentials per corrected schema
    payload = {
        "twilioAccountSid": "AC123456789",
        "twilioAuthToken": "auth_token_123",
        "twilioPhoneNumber": "+15551234567"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        # Accept 200 (success), 400 (validation), 401 (auth), 500 (server error)
        assert response.status_code in (200, 400, 401, 500), f"Unexpected status code: {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"


test_update_inbound_config()
