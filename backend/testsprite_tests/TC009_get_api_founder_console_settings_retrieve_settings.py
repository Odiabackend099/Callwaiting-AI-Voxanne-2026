import requests

BASE_URL = "http://localhost:3001"
ENDPOINT = "/api/founder-console/settings"
TIMEOUT = 30

def test_get_founder_console_settings():
    url = BASE_URL + ENDPOINT
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        json_data = response.json()
        assert isinstance(json_data, dict), "Response JSON is not an object"
        # Basic expected keys check if any known keys are expected - 
        # Since PRD does not specify exact schema of settings, just verify non-empty dictionary
        assert len(json_data) > 0, "Settings data is empty"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_founder_console_settings()