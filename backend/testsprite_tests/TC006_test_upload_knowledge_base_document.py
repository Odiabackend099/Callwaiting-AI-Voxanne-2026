import requests
import uuid

BASE_URL = "http://localhost:3001"
UPLOAD_ENDPOINT = f"{BASE_URL}/api/knowledge-base/upload"
DELETE_ENDPOINT = f"{BASE_URL}/api/knowledge-base"  # Assuming DELETE /api/knowledge-base/{docId} exists for cleanup
TIMEOUT = 30

# Authentication setup - placeholder, adjust as needed (e.g., Bearer token)
HEADERS = {
    # Example Authorization header if required:
    # "Authorization": "Bearer YOUR_JWT_TOKEN",
}

def test_upload_knowledge_base_document():
    # Prepare a sample document content and metadata
    document_id = None
    files = {
        'file': ('sample_doc.txt', b'This is a test document content for knowledge base.', 'text/plain'),
    }
    data = {
        # If the API requires metadata or other fields, include here
    }
    try:
        response = requests.post(
            UPLOAD_ENDPOINT,
            headers=HEADERS,
            files=files,
            data=data,
            timeout=TIMEOUT
        )
        # Validate HTTP status
        assert response.status_code == 200, f"Unexpected status code: {response.status_code} - {response.text}"

        # Validate response content
        json_resp = response.json()
        # Expect a document ID or success confirmation in response
        assert 'documentId' in json_resp or 'id' in json_resp or 'success' in json_resp, \
            f"Response missing expected keys: {json_resp}"

        # Extract document_id if available to clean up after test
        document_id = json_resp.get('documentId') or json_resp.get('id')

        # Further validations: Assuming the API response returns info about chunking and embedding synchronously processed
        # Common keys might be 'chunkCount', 'embeddingStatus' or similar - adjust as per actual API response

        # Example assertions (ignore if keys not present)
        if 'chunkCount' in json_resp:
            assert isinstance(json_resp['chunkCount'], int) and json_resp['chunkCount'] > 0, \
                "chunkCount should be a positive integer"
        if 'embeddingStatus' in json_resp:
            assert json_resp['embeddingStatus'] == "completed", "Embedding status should be completed"

    finally:
        # Cleanup: Delete uploaded document if API and document_id allow it
        if document_id:
            try:
                del_response = requests.delete(
                    f"{DELETE_ENDPOINT}/{document_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT
                )
                # Accept 200 or 204 for successful deletion
                assert del_response.status_code in [200, 204], \
                    f"Failed to cleanup uploaded document {document_id}, status: {del_response.status_code}"
            except Exception as e:
                # Log cleanup error but do not fail test due to cleanup issues
                print(f"Cleanup error for document {document_id}: {e}")

test_upload_knowledge_base_document()