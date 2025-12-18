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

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"
    # Additional validations can be added here if schema was provided

test_get_founder_console_settings()