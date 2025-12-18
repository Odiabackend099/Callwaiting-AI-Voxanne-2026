import requests

def test_receive_vapi_webhooks():
    base_url = "http://localhost:3001"
    endpoint = f"{base_url}/api/webhooks/vapi"
    headers = {
        "Content-Type": "application/json"
    }
    timeout = 30

    webhook_events = [
        {
            "event": "call_started",
            "call_id": "test-call-1234",
            "timestamp": "2025-12-10T12:00:00Z",
            "caller": "+1234567890",
            "callee": "+1987654321"
        },
        {
            "event": "transcript",
            "call_id": "test-call-1234",
            "timestamp": "2025-12-10T12:01:00Z",
            "transcript": "Hello, this is a live transcription."
        },
        {
            "event": "recording",
            "call_id": "test-call-1234",
            "timestamp": "2025-12-10T12:02:00Z",
            "recording_url": "https://storage.example.com/recordings/test-call-1234.mp3",
            "signed_url_expiry": "2025-12-17T12:00:00Z"
        },
        {
            "event": "call_ended",
            "call_id": "test-call-1234",
            "timestamp": "2025-12-10T12:05:00Z",
            "duration_seconds": 300,
            "call_result": "completed"
        }
    ]

    for event_payload in webhook_events:
        try:
            response = requests.post(endpoint, json=event_payload, headers=headers, timeout=timeout)
            assert response.status_code == 200, f"Expected status 200 but got {response.status_code} for event {event_payload.get('event', 'unknown')}"
        except requests.exceptions.RequestException as e:
            assert False, f"Request failed for event {event_payload.get('event', 'unknown')}: {e}"

test_receive_vapi_webhooks()
