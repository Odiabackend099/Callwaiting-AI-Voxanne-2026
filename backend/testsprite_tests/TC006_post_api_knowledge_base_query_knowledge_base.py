import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_post_api_knowledge_base_query_knowledge_base():
    url = f"{BASE_URL}/api/knowledge-base/query"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "query": "What are the clinic's operating hours?"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    try:
        json_response = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # The response should be a dict with relevant results for the query.
    # Since the PRD does not specify exact schema, check for key presence and non-empty results
    assert isinstance(json_response, dict), "Response JSON is not a dictionary"
    assert "results" in json_response or "data" in json_response, "Response does not contain expected keys 'results' or 'data'"

    results = json_response.get("results") or json_response.get("data")
    assert isinstance(results, list), "Results should be a list"
    assert len(results) > 0, "Results list is empty"

    # Check that each result is a dictionary and contains at least some content field
    for item in results:
        assert isinstance(item, dict), "Each result item should be a dictionary"
        # check for typical fields - textual content or snippet expected
        assert any(k in item for k in ("content", "text", "snippet", "answer")), "Result item missing content field"

test_post_api_knowledge_base_query_knowledge_base()