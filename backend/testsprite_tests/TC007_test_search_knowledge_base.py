import requests

def test_search_knowledge_base():
    base_url = "http://localhost:3001"
    url = f"{base_url}/api/knowledge-base/search"
    headers = {"Content-Type": "application/json"}
    payload = {
        "query": "clinic hours"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        json_data = response.json()
        assert isinstance(json_data, dict) or isinstance(json_data, list), "Response is not JSON object or list"
        # Optional: Check that results contain expected keys if any specific structure is expected
        # Here we only check response presence.
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_search_knowledge_base()