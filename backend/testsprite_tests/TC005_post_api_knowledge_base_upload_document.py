import requests
import os

BASE_URL = "http://localhost:3001"
TIMEOUT = 30

def test_post_api_knowledge_base_upload_document():
    url = f"{BASE_URL}/api/knowledge-base/upload"
    # Simulate a simple text file upload for the document
    files = {
        "document": ("test_document.txt", b"This is a test document content for knowledge base upload.", "text/plain"),
    }
    headers = {
        # Add authentication headers here if required, for example:
        # "Authorization": f"Bearer {os.getenv('API_TOKEN')}"
    }

    response = None

    try:
        response = requests.post(url, files=files, headers=headers, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        json_resp = response.json()
        # Validate that the response contains indication of triggered processes
        # Since no schema is specified, expect some keys or status indicating chunking/embedding/indexing triggered
        assert isinstance(json_resp, dict), "Response is not a JSON object"
        # Check some expected keys or values or a success flag - as no schema, check general success keys
        # For example, expect 'success' == True or message field containing 'uploaded' or 'indexed'
        assert ("success" in json_resp and json_resp["success"] is True) or \
               ("message" in json_resp and any(sub in json_resp["message"].lower() for sub in ["uploaded", "indexed", "chunk", "embed"])), \
            "Response JSON missing expected confirmation of upload and processing"
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"
    finally:
        # If the API supported deleting an uploaded document, we would clean up here:
        # Since no delete endpoint given, no cleanup step performed.
        pass

test_post_api_knowledge_base_upload_document()