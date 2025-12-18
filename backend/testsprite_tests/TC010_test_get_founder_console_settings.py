import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_get_founder_console_settings():
    url = f"{BASE_URL}/api/founder-console/settings"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # The endpoint is authenticated in the description, so unauthenticated calls likely return 401 or 500.
    # But instructions say 404s should be resolved.
    # We assert success status 200 and validate content.

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate the response content type is dict and has at least some keys, as settings expected to be an object
    assert isinstance(data, dict), "Response JSON is not an object"

    # Optional: check some expected keys if known, here skip since not specified

test_get_founder_console_settings()