import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_get_call_logs():
    url = f"{BASE_URL}/api/calls-dashboard"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    # Validate status code
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Validate response is JSON and contains expected data structure
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Data should be a dict containing at least keys for pagination and call logs
    assert isinstance(data, dict), "Response JSON root is not an object"

    # Expect keys that relate to call logs list and pagination info
    expected_keys = ["calls", "pagination"]
    for key in expected_keys:
        assert key in data, f"Response JSON missing expected key '{key}'"

    # Validate that 'calls' is a list
    assert isinstance(data["calls"], list), "'calls' should be a list"

    # Validate that 'pagination' is a dict with expected pagination fields
    pagination = data["pagination"]
    assert isinstance(pagination, dict), "'pagination' should be an object"
    for field in ["page", "total", "totalPages"]:
        assert field in pagination, f"'pagination' missing field '{field}'"

    # Optionally check a sample call log object if exists
    if data["calls"]:
        call = data["calls"][0]
        assert isinstance(call, dict), "Each call log entry should be an object"
        for required_field in ["id", "startTime", "duration", "callerNumber"]:
            assert required_field in call, f"Call log entry missing field '{required_field}'"

test_get_call_logs()
