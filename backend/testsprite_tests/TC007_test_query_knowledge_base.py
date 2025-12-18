import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {
    "Content-Type": "application/json",
    # Assuming a Bearer token authentication is required; replace 'your_token' accordingly
    "Authorization": "Bearer your_token"
}

def test_query_knowledge_base():
    url = f"{BASE_URL}/api/knowledge-base/query"
    payload = {
        "query": "What are the hours of operation for the clinic?",
        "top_k": 5
    }
    try:
        response = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT)
        # Verify status code is 200 OK
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
        data = response.json()
        # Verify response contains search results (assuming key 'results' holds them)
        assert "results" in data, "Response JSON does not contain 'results'"
        results = data["results"]
        # Results should be a non-empty list
        assert isinstance(results, list), "'results' should be a list"
        assert len(results) > 0, "No search results returned from knowledge base query"
        # Each result should contain required fields, e.g., 'document_id' and 'score'
        for result in results:
            assert "document_id" in result, "Result missing 'document_id'"
            assert "score" in result, "Result missing 'score'"
            assert isinstance(result["score"], (int, float)), "'score' should be a number"
    except requests.RequestException as e:
        assert False, f"RequestException occurred: {e}"

test_query_knowledge_base()