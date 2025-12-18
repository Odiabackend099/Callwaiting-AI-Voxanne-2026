import requests
import uuid

BASE_URL = "http://localhost:3001"
TIMEOUT = 30
HEADERS = {
    "Content-Type": "application/json"
}

def test_get_post_api_assistants_manage_ai_assistants():
    # Test GET /api/assistants endpoint
    try:
        get_resp = requests.get(f"{BASE_URL}/api/assistants", headers=HEADERS, timeout=TIMEOUT)
        assert get_resp.status_code == 200, f"Expected status 200, got {get_resp.status_code}"
        assistants_list = get_resp.json()
        assert isinstance(assistants_list, list), "Response for GET /api/assistants should be a list"
    except Exception as e:
        assert False, f"GET /api/assistants request failed: {e}"

    # Prepare payload for POST /api/assistants to create a new assistant
    # Minimal valid data based on common AI assistant config knowledge (as no schema details provided)
    # Generate a unique assistant name for uniqueness
    new_assistant_data = {
        "name": f"TestAssistant-{uuid.uuid4()}",
        "description": "Automated test assistant created by test_get_post_api_assistants_manage_ai_assistants",
        "language": "en-US",
        "voice": "female",
        "greeting": "Hello, how can I assist you today?",
        "personality": "friendly"
    }

    created_assistant_id = None
    try:
        post_resp = requests.post(
            f"{BASE_URL}/api/assistants",
            headers=HEADERS,
            json=new_assistant_data,
            timeout=TIMEOUT
        )
        assert post_resp.status_code == 201 or post_resp.status_code == 200, \
            f"Expected status 200 or 201, got {post_resp.status_code}"
        created_assistant = post_resp.json()
        # Validate response fields
        assert "id" in created_assistant and isinstance(created_assistant["id"], (str, int)), "Missing or invalid 'id' in response"
        created_assistant_id = created_assistant["id"]
        assert created_assistant.get("name") == new_assistant_data["name"], "Assistant name does not match"
        # Optionally verify other returned fields if present
    except Exception as e:
        assert False, f"POST /api/assistants request failed: {e}"
    finally:
        # Cleanup: delete the created assistant if ID was returned
        if created_assistant_id is not None:
            try:
                delete_resp = requests.delete(
                    f"{BASE_URL}/api/assistants/{created_assistant_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT
                )
                # Accept 200, 202, 204 as success for delete
                assert delete_resp.status_code in (200, 202, 204), \
                    f"Expected status 200/202/204 on delete, got {delete_resp.status_code}"
            except Exception as e:
                # Ignore deletion failure but print warning
                print(f"Warning: Failed to delete test assistant with id {created_assistant_id}: {e}")

test_get_post_api_assistants_manage_ai_assistants()