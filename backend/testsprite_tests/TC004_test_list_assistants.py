import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_list_assistants():
    url = f"{BASE_URL}/api/assistants"
    headers = {
        "Accept": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request to list assistants failed: {e}"
    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"
    assert isinstance(data, (list, dict)), f"Expected response data to be list or dict, got {type(data)}"

test_list_assistants()