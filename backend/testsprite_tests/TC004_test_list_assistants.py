import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json",
    # Include Authorization header if authentication is required, e.g.:
    # "Authorization": "Bearer <token>",
}

def test_list_assistants():
    url = f"{BASE_URL}/api/assistants"
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(data, list), f"Expected response to be a list, got {type(data)}"

    # For each assistant, verify presence and type of expected fields related to configurations and statuses
    expected_fields = {
        "id",
        "name",
        "configuration",
        "status",
        "features"
    }

    # Since PRD doesn't define explicit assistant schema, check for at least presence of keys related to requirements
    for assistant in data:
        assert isinstance(assistant, dict), "Each assistant should be a dictionary"
        # Must have at least some identifying keys
        assert "id" in assistant or "name" in assistant, "Assistant must have 'id' or 'name'"
        # Check keys presence if present
        if "configuration" in assistant:
            assert isinstance(assistant["configuration"], dict), "'configuration' should be a dict"
        if "status" in assistant:
            assert isinstance(assistant["status"], (str, int)), "'status' should be string or int"
        if "features" in assistant:
            assert isinstance(assistant["features"], list), "'features' should be a list"
            features_set = set(assistant["features"])
            # Verify the feature list includes required key features from instructions
            required_features = {
                "Inbound call handling",
                "Call recording",
                "Live transcript",
                "Call log dashboard",
                "Knowledge Base RAG",
                "Agent config",
                "Smart Escalation",
                "Real-time updates",
                "Auth",
                "Production deployment"
            }
            # Check for intersection, not necessarily all present, but at least some features relevant
            assert features_set & required_features, (
                f"Assistant features {features_set} do not contain any required key features"
            )

test_list_assistants()