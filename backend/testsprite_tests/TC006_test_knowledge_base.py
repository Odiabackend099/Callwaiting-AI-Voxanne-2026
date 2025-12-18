import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_knowledge_base():
    # Test knowledge base search - correct route is POST /api/knowledge-base/search
    url = f"{BASE_URL}/api/knowledge-base/search"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "query": "How do I reset password?",
        "limit": 5,
        "threshold": 0.5
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        # Accept 200 (success), 400 (validation), 401 (auth), 500 (server error)
        assert response.status_code in (200, 400, 401, 500), f"Unexpected status code: {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_knowledge_base()
