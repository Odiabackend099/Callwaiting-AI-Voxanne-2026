import requests

BASE_URL = "http://localhost:3001"
CALLS_DASHBOARD_ENDPOINT = f"{BASE_URL}/api/calls-dashboard"
TIMEOUT = 30

# Assuming JWT auth token is needed for authentication, replace with a valid token.
AUTH_TOKEN = "YOUR_VALID_JWT_TOKEN_HERE"

def test_get_call_logs():
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Accept": "application/json"
    }
    params = {
        # Example pagination params:
        "page": 1,
        "pageSize": 10,
        # Example filters (adjust keys as per actual API):
        "filterInbound": "true",
        "filterRecorded": "true",
        # Additional filters can be added if API supports them
    }

    try:
        response = requests.get(CALLS_DASHBOARD_ENDPOINT, headers=headers, params=params, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to get call logs failed: {e}"

    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    # Validate that data is a dictionary
    assert isinstance(data, dict), "Response JSON root should be a dictionary"

    # Check for call logs list presence and type
    call_logs = data.get("items") or data.get("calls") or data.get("callLogs")
    assert call_logs is not None, "Response JSON missing 'items' or equivalent call logs list"
    assert isinstance(call_logs, list), "'items' should be a list"

    # Validate at least one call log has expected keys reflecting core features
    if call_logs:
        sample = call_logs[0]
        # Adjust key names to accept alternatives due to inconsistencies
        direction_key = "direction" if "direction" in sample else "callDirection" if "callDirection" in sample else None
        escalation_flag_key = "escalationFlag" if "escalationFlag" in sample else "escalation_flag" if "escalation_flag" in sample else None

        expected_keys = ["id", direction_key, "recordingUrl", "transcript", "agentId", "startTime", "endTime", escalation_flag_key]

        for key in expected_keys:
            assert key is not None, "Expected key for 'direction' or 'escalationFlag' not found in call log item"
            assert key in sample, f"Call log item missing expected key: {key}"

        # direction validation for inbound call handling feature
        assert sample[direction_key] in ["inbound", "outbound"], f"'{direction_key}' should be 'inbound' or 'outbound'"

        # recordingUrl presence (can be None or valid URL string)
        if sample["recordingUrl"] is not None:
            assert isinstance(sample["recordingUrl"], str) and sample["recordingUrl"].startswith("http"), "'recordingUrl' should be a valid URL string or None"

        # Transcript should be string or null (indicating live transcript or recorded)
        assert sample["transcript"] is None or isinstance(sample["transcript"], str), "'transcript' should be null or string"

        # escalationFlag bool for Smart Escalation feature validation
        assert isinstance(sample.get(escalation_flag_key, False), bool), f"'{escalation_flag_key}' should be boolean"

def run_test():
    test_get_call_logs()

run_test()
