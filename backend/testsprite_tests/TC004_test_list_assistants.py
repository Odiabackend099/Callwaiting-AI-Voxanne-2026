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
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    # Validate status code
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    # Validate that the data is a list (list of assistants)
    assert isinstance(data, list), f"Expected response to be a list but got {type(data)}"

    # If the list is not empty, validate structure of first item
    if data:
        assistant = data[0]
        assert isinstance(assistant, dict), "Assistant item is not a dictionary"

test_list_assistants()
