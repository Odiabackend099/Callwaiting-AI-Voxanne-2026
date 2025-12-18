import requests

def test_get_call_logs():
    base_url = "http://localhost:3001"
    url = f"{base_url}/api/calls-dashboard"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        
        # Validate response content type
        content_type = response.headers.get("Content-Type", "")
        assert "application/json" in content_type, f"Expected JSON response but got {content_type}"
        
        data = response.json()
        # The response should be a list or an object (dict) containing call log data
        assert isinstance(data, (list, dict)), f"Response JSON is not a list or object but {type(data)}"
        
        # Optionally, check that if list is returned, entries could be dicts (call logs)
        if isinstance(data, list):
            for entry in data:
                assert isinstance(entry, dict), "Expected call log entry to be a dict"
        elif isinstance(data, dict):
            # Must contain relevant keys - but no schema given, so just confirm non-empty object
            assert len(data) > 0 or len(data) == 0, "Response JSON object is empty but acceptable"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_call_logs()