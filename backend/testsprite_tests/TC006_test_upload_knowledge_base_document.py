import requests

BASE_URL = "http://localhost:3001"
UPLOAD_ENDPOINT = f"{BASE_URL}/api/knowledge-base/upload"
TIMEOUT = 30

def test_upload_knowledge_base_document():
    # Prepare a sample document payload for upload; assuming JSON with fields needed for document upload
    # Since no specific schema provided, simulate a common document upload with filename and content
    files = {
        'file': ('test_document.txt', b'This is a test document content for knowledge base upload.', 'text/plain'),
    }

    headers = {
        # No authentication included as per instructions to expect 401 if required
        # Content-Type for multipart/form-data will be set by requests automatically.
    }

    response = None
    try:
        response = requests.post(
            UPLOAD_ENDPOINT,
            files=files,
            headers=headers,
            timeout=TIMEOUT
        )
    except requests.RequestException as e:
        assert False, f"Request to upload knowledge base document failed: {e}"

    # The endpoint may require authentication and may return 401 if missing.
    # Or it should accept the upload and return a success code (200 or 201).
    assert response is not None, "No response received from upload endpoint"
    if response.status_code == 401:
        # Authentication missing, error expected if endpoint is protected
        # Pass test as per instructions that 401 is expected without credentials
        assert True
    else:
        # For success: verify status code and response content confirming upload and processing
        assert response.status_code in (200, 201), f"Unexpected status code: {response.status_code}"
        # We expect synchronous chunking and embedding processing done, likely confirmed in response
        # Check response JSON for confirmation fields (if any)
        try:
            json_resp = response.json()
        except Exception:
            assert False, "Response is not JSON as expected for successful upload"

        # Validate json_resp has keys indicating processing status, e.g. 'documentId' or 'status'
        # Since schema isn't provided, we check minimally
        assert isinstance(json_resp, dict), "Response JSON is not an object"
        assert 'status' in json_resp or 'documentId' in json_resp, "Response JSON missing expected keys indicating upload success"

test_upload_knowledge_base_document()