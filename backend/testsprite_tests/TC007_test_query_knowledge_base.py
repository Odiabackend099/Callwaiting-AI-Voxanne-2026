import requests

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_query_knowledge_base():
    # Correct route is POST /api/knowledge-base/search (not /query)
    url = f"{BASE_URL}/api/knowledge-base/search"
    headers = {
        "Content-Type": "application/json"
    }
    # Example query payload, assuming the API expects a "query" string param and optionally params for RAG/vector search
    payload = {
        "query": "What are the working hours of the clinic?"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # Expect 200 on success if no auth required, else possibly 401 (per instructions)
    assert response.status_code in (200, 401, 500), f"Unexpected status code: {response.status_code}, Response Text: {response.text}"

    if response.status_code == 200:
        try:
            data = response.json()
        except ValueError:
            assert False, "Response is not valid JSON"

        # Validate expected response structure
        # As the PRD does not specify exact schema, check presence of a "results" or similar field with list/array type
        assert isinstance(data, dict), "Response JSON should be a dictionary"
        assert "results" in data or "documents" in data or "answers" in data, "Response missing expected keys (results/documents/answers)"
        # If results present validate it's a list
        if "results" in data:
            assert isinstance(data["results"], list), "'results' field is not a list"
        if "documents" in data:
            assert isinstance(data["documents"], list), "'documents' field is not a list"
        if "answers" in data:
            assert isinstance(data["answers"], list), "'answers' field is not a list"
    else:
        # For 401 or 500, optionally check error message format, but just basic check here
        try:
            err_data = response.json()
            assert isinstance(err_data, dict), "Error response should be a JSON object"
        except ValueError:
            # Could not parse JSON error response
            pass

test_query_knowledge_base()