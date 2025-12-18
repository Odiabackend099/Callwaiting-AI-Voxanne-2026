import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json",
}

def test_get_founder_console_settings():
    url = f"{BASE_URL}/api/founder-console/settings"
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    expected_features = [
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
    ]

    normalized_keys = {k.lower().replace(' ', '').replace('-', '').replace('_', ''): v for k, v in data.items()}

    checks = {}

    for feature in expected_features:
        norm_feature = feature.lower().replace(' ', '').replace('-', '').replace('_', '')
        found = False
        for key_norm, val in normalized_keys.items():
            if norm_feature in key_norm and val:
                found = True
                break
        checks[feature] = found

    for feature, present in checks.items():
        assert present, f"Feature '{feature.lower()}' missing or disabled in settings response"


test_get_founder_console_settings()
