import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {
    "Content-Type": "application/json",
    # If authentication is required, include here, e.g.:
    # "Authorization": "Bearer YOUR_JWT_TOKEN"
}

def test_setup_vapi_integration():
    url = f"{BASE_URL}/api/vapi/setup"
    payload = {}

    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        assert False, f"Request to setup Vapi integration failed: {e}"

    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"


test_setup_vapi_integration()
