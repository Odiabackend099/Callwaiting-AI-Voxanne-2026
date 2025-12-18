import requests
import uuid

BASE_URL = "http://localhost:3001"
ASSISTANTS_ENDPOINT = f"{BASE_URL}/api/assistants"
TIMEOUT = 30

HEADERS = {
    "Content-Type": "application/json"
}


def test_create_assistant():
    # Minimal required payload based on PRD since no exact payload schema provided
    assistant_data = {
        "name": f"TestAssistant-{uuid.uuid4()}"
    }

    created_assistant_id = None

    try:
        response = requests.post(
            ASSISTANTS_ENDPOINT,
            headers=HEADERS,
            json=assistant_data,
            timeout=TIMEOUT
        )
        assert response.status_code == 201 or response.status_code == 200, f"Unexpected status code: {response.status_code}"

        resp_json = response.json()
        assert "id" in resp_json, "Response JSON missing 'id'"

        created_assistant_id = resp_json["id"]

        assert resp_json.get("name") == assistant_data["name"], "Assistant name mismatch"

    finally:
        if created_assistant_id:
            try:
                delete_url = f"{ASSISTANTS_ENDPOINT}/{created_assistant_id}"
                del_resp = requests.delete(delete_url, headers=HEADERS, timeout=TIMEOUT)
                assert del_resp.status_code in (200, 204), f"Failed to delete assistant with id {created_assistant_id}"
            except Exception:
                pass


test_create_assistant()
