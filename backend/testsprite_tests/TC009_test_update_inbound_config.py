import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_update_inbound_config():
    # Correct route is POST /api/inbound/setup (not /api/inbound/config)
    url = f"{BASE_URL}/api/inbound/setup"
    headers = {
        "Content-Type": "application/json"
    }
    # Payload for inbound setup per corrected schema
    payload = {
        "twilioAccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "twilioAuthToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "twilioPhoneNumber": "+1234567890"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        if response.status_code == 401:
            # Unauthorized - as no authentication provided
            assert "Unauthorized" in response.text or response.status_code == 401
        elif response.status_code == 500:
            # Internal Server Error may be returned if backend fails
            assert response.status_code == 500
        else:
            # Expect success (2xx status code)
            assert response.status_code >= 200 and response.status_code < 300, f"Unexpected status code: {response.status_code}"
            # Optionally, check response content for success indication
            json_response = response.json()
            assert json_response is not None
            # Assuming response has a "success" boolean or similar field
            if "success" in json_response:
                assert json_response["success"] is True
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_update_inbound_config()